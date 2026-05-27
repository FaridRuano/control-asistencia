"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Copy, Edit3, Plus, Save, Trash2, X } from "lucide-react";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FloatingNotice from "@/components/ui/FloatingNotice";
import { DEFAULT_TEMPLATE_ROWS } from "@/lib/planning/baseSchedules";
import { DAY_TYPES } from "@/lib/schedules";
import styles from "./BaseSchedulesManager.module.scss";

const EMPTY_FORM = {
  id: "",
  name: "",
  areaCode: "",
  roleCode: "",
  rotationGroup: "",
  weeklyRows: DEFAULT_TEMPLATE_ROWS,
  notes: "",
  isActive: true,
};

const DEFAULT_RULES = {
  dailyBaseHours: 8,
  weeklyBaseHours: 40,
  maxSupplementaryMinutesPerDay: 60,
  maxSupplementaryMinutesPerWeek: 300,
  defaultGraceMinutes: 10,
  areaLunchRules: [],
};
const MANDATORY_WEEKLY_REST_DAYS = 2;

function cloneRows(rows) {
  return rows.map((row) => ({ ...row }));
}

function minutesLabel(minutes) {
  const value = Number(minutes) || 0;
  const hours = Math.floor(value / 60);
  const rest = value % 60;

  if (!hours) {
    return `${rest}m`;
  }

  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function parseTimeToMinutes(value) {
  if (!/^\d{2}:\d{2}$/.test(String(value || ""))) {
    return null;
  }

  const [hours, minutes] = String(value).split(":").map(Number);
  return hours * 60 + minutes;
}

function calculatePresenceMinutes(row) {
  const start = parseTimeToMinutes(row.startTime);
  const end = parseTimeToMinutes(row.endTime);

  if (start === null || end === null || end <= start) {
    return null;
  }

  return Math.max(end - start - (Number(row.lunchDurationMinutes) || 0), 0);
}

function calculatePlannedNetMinutes(row, baseDailyMinutes) {
  const authorizedExtraMinutes = Number(row.authorizedExtraMinutes) || 0;

  if (row.dayType === "weekend_overtime") {
    return authorizedExtraMinutes;
  }

  return Math.max(baseDailyMinutes + authorizedExtraMinutes, 0);
}

function buildFormSignature(form) {
  return JSON.stringify({
    name: String(form.name || "").trim(),
    areaCode: form.areaCode || "",
    roleCode: form.roleCode || "",
    rotationGroup: String(form.rotationGroup || "").trim(),
    weeklyRows: (form.weeklyRows || []).map((row) => ({
      dayOfWeek: row.dayOfWeek,
      dayType: row.dayType,
      startTime: row.startTime || "",
      lunchDurationMinutes: Number(row.lunchDurationMinutes) || 0,
      hasLunch: Boolean(row.hasLunch),
      endTime: row.endTime || "",
      authorizedExtraMinutes: Number(row.authorizedExtraMinutes) || 0,
      graceMinutes: Number(row.graceMinutes) || 0,
    })),
    notes: String(form.notes || "").trim(),
    isActive: form.isActive !== false,
  });
}

export default function BaseSchedulesManager() {
  const [templates, setTemplates] = useState([]);
  const [areas, setAreas] = useState([]);
  const [roles, setRoles] = useState([]);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [form, setForm] = useState({ ...EMPTY_FORM, weeklyRows: cloneRows(DEFAULT_TEMPLATE_ROWS) });
  const [savedFormSignature, setSavedFormSignature] = useState("");
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const noticeExitTimeoutRef = useRef(null);
  const noticeRemoveTimeoutRef = useRef(null);

  const selectedArea = areas.find((area) => area.code === form.areaCode);
  const selectedRole = roles.find((role) => role.code === form.roleCode && role.areaCode === form.areaCode);
  const canEditScheduleRows = Boolean(selectedArea && selectedRole);
  const formSignature = buildFormSignature(form);
  const hasChanges = formSignature !== savedFormSignature;

  const rolesForArea = useMemo(
    () => roles.filter((role) => !form.areaCode || role.areaCode === form.areaCode),
    [form.areaCode, roles],
  );

  const validation = useMemo(() => {
    const baseDailyMinutes = (Number(rules.dailyBaseHours) || 8) * 60;
    const weeklyBaseMinutes = (Number(rules.weeklyBaseHours) || 40) * 60;
    const dailySupplementaryLimit = Number(rules.maxSupplementaryMinutesPerDay) || 0;
    const weeklySupplementaryLimit = Number(rules.maxSupplementaryMinutesPerWeek) || 0;
    let workingDays = 0;
    let restDays = 0;
    let netMinutes = 0;
    let supplementaryMinutes = 0;
    let extraordinaryDays = 0;
    const warnings = [];

    form.weeklyRows.forEach((row) => {
      const type = DAY_TYPES.find((item) => item.value === row.dayType);

      if (!type?.isWorkingDay) {
        restDays += 1;
        return;
      }

      workingDays += 1;

      if (row.dayType === "weekend_overtime") {
        extraordinaryDays += 1;
      }

      const presenceMinutes = calculatePresenceMinutes(row);

      if (presenceMinutes === null) {
        warnings.push(`${row.label}: falta entrada/salida valida.`);
        return;
      }

      const dayNetMinutes = calculatePlannedNetMinutes(row, baseDailyMinutes);
      netMinutes += dayNetMinutes;

      if (row.dayType === "workday") {
        const daySupplementary = Number(row.authorizedExtraMinutes) || 0;
        supplementaryMinutes += daySupplementary;

        if (daySupplementary > dailySupplementaryLimit) {
          warnings.push(`${row.label}: supera la suplementaria diaria permitida.`);
        }
      }

      if (dayNetMinutes > presenceMinutes) {
        warnings.push(`${row.label}: la presencia no cubre el neto autorizado.`);
      }
    });

    if (restDays < MANDATORY_WEEKLY_REST_DAYS) {
      warnings.push("La semana no cumple los descansos obligatorios.");
    }

    if (supplementaryMinutes > weeklySupplementaryLimit) {
      warnings.push("La semana supera el limite de suplementarias.");
    }

    if (netMinutes < weeklyBaseMinutes && workingDays > 0) {
      warnings.push("La plantilla queda por debajo de las horas base semanales.");
    }

    return {
      workingDays,
      restDays,
      netMinutes,
      supplementaryMinutes,
      extraordinaryDays,
      warnings,
      isValid: warnings.length === 0,
    };
  }, [form.weeklyRows, rules]);

  const templatesByArea = useMemo(() => {
    const grouped = new Map();

    templates.forEach((template) => {
      const key = template.areaName || "Sin area";

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }

      grouped.get(key).push(template);
    });

    return [...grouped.entries()];
  }, [templates]);

  const clearNoticeTimers = useCallback(() => {
    if (noticeExitTimeoutRef.current) {
      window.clearTimeout(noticeExitTimeoutRef.current);
      noticeExitTimeoutRef.current = null;
    }

    if (noticeRemoveTimeoutRef.current) {
      window.clearTimeout(noticeRemoveTimeoutRef.current);
      noticeRemoveTimeoutRef.current = null;
    }
  }, []);

  const dismissNotice = useCallback(() => {
    clearNoticeTimers();
    setNotice((current) => (current ? { ...current, isLeaving: true } : null));
    noticeRemoveTimeoutRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeRemoveTimeoutRef.current = null;
    }, 240);
  }, [clearNoticeTimers]);

  const showNotice = useCallback((type, message) => {
    clearNoticeTimers();
    setNotice({ type, message, isLeaving: false });
    noticeExitTimeoutRef.current = window.setTimeout(() => {
      dismissNotice();
    }, 4000);
  }, [clearNoticeTimers, dismissNotice]);

  function buildInitialForm(nextForm = EMPTY_FORM) {
    return {
      ...nextForm,
      weeklyRows: cloneRows(nextForm.weeklyRows?.length === 7 ? nextForm.weeklyRows : DEFAULT_TEMPLATE_ROWS),
    };
  }

  function setCurrentForm(nextForm) {
    const preparedForm = buildInitialForm(nextForm);
    setForm(preparedForm);
    setSavedFormSignature(buildFormSignature(preparedForm));
  }

  function resetForm() {
    setCurrentForm(EMPTY_FORM);
  }

  function applyAreaLunchToRows(areaCode, rows) {
    const rule = (rules.areaLunchRules || []).find((item) => item.areaCode === areaCode);

    if (!rule) {
      return rows;
    }

    const lunchDurationMinutes = Number(rule.lunchDurationMinutes) || 0;

    return rows.map((row) => {
      const type = DAY_TYPES.find((item) => item.value === row.dayType);

      if (!type?.isWorkingDay) {
        return row;
      }

      return {
        ...row,
        hasLunch: lunchDurationMinutes > 0,
        lunchDurationMinutes,
      };
    });
  }

  function updateField(name, value) {
    setForm((current) => {
      if (name !== "areaCode") {
        return { ...current, [name]: value };
      }

      return {
        ...current,
        areaCode: value,
        roleCode: "",
        weeklyRows: applyAreaLunchToRows(value, current.weeklyRows),
      };
    });
  }

  function updateRow(dayOfWeek, updates) {
    setForm((current) => ({
      ...current,
      weeklyRows: current.weeklyRows.map((row) => {
        if (row.dayOfWeek !== dayOfWeek) {
          return row;
        }

        const nextRow = { ...row, ...updates };
        const dayType = DAY_TYPES.find((item) => item.value === nextRow.dayType);

        if (!dayType?.isWorkingDay) {
          nextRow.startTime = "";
          nextRow.endTime = "";
          nextRow.hasLunch = false;
          nextRow.lunchDurationMinutes = 0;
          nextRow.authorizedExtraMinutes = 0;
        }

        if (Number(updates.lunchDurationMinutes) > 0) {
          nextRow.hasLunch = true;
        }

        return nextRow;
      }),
    }));
  }

  function editTemplate(template) {
    setCurrentForm(template);
  }

  function duplicateTemplate(template) {
    const duplicated = {
      ...template,
      id: "",
      name: `${template.name} COPIA`,
      weeklyRows: cloneRows(template.weeklyRows?.length === 7 ? template.weeklyRows : DEFAULT_TEMPLATE_ROWS),
    };

    setForm(duplicated);
    setSavedFormSignature(buildFormSignature(EMPTY_FORM));
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      try {
        const [templatesResponse, areasResponse, rolesResponse, rulesResponse] = await Promise.all([
          fetch("/api/planning/base-schedules"),
          fetch("/api/areas"),
          fetch("/api/roles"),
          fetch("/api/planning/labor-rules"),
        ]);
        const [templatesPayload, areasPayload, rolesPayload, rulesPayload] = await Promise.all([
          templatesResponse.json(),
          areasResponse.json(),
          rolesResponse.json(),
          rulesResponse.json(),
        ]);

        if (!templatesResponse.ok) {
          throw new Error(templatesPayload.error || "No se pudieron cargar las plantillas.");
        }

        if (!areasResponse.ok) {
          throw new Error(areasPayload.error || "No se pudieron cargar las areas.");
        }

        if (!rolesResponse.ok) {
          throw new Error(rolesPayload.error || "No se pudieron cargar los roles.");
        }

        if (!rulesResponse.ok) {
          throw new Error(rulesPayload.error || "No se pudieron cargar las reglas laborales.");
        }

        if (!isCancelled) {
          setTemplates(templatesPayload.templates || []);
          setAreas(areasPayload.areas || []);
          setRoles(rolesPayload.roles || []);
          setRules({ ...DEFAULT_RULES, ...(rulesPayload.rules || {}) });
          setForm({ ...EMPTY_FORM, weeklyRows: cloneRows(DEFAULT_TEMPLATE_ROWS) });
          setSavedFormSignature(buildFormSignature(EMPTY_FORM));
        }
      } catch (error) {
        if (!isCancelled) {
          showNotice("error", error.message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
      clearNoticeTimers();
    };
  }, [clearNoticeTimers, showNotice]);

  function handleSubmit(event) {
    event.preventDefault();

    if (!hasChanges || isPending) {
      return;
    }

    setIsSaveConfirmOpen(true);
  }

  function confirmSave() {
    startTransition(async () => {
      try {
        const endpoint = form.id
          ? `/api/planning/base-schedules/${form.id}`
          : "/api/planning/base-schedules";
        const response = await fetch(endpoint, {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo guardar la plantilla.");
        }

        setTemplates((current) => {
          const saved = payload.template;
          const exists = current.some((template) => template.id === saved.id);

          return exists
            ? current.map((template) => (template.id === saved.id ? saved : template))
            : [...current, saved].sort((left, right) =>
                `${left.areaName}${left.roleName}${left.name}`.localeCompare(
                  `${right.areaName}${right.roleName}${right.name}`,
                ),
              );
        });
        setCurrentForm(payload.template);
        setIsSaveConfirmOpen(false);
        showNotice("success", payload.message);
      } catch (error) {
        showNotice("error", error.message);
      }
    });
  }

  function confirmDeleteTemplate() {
    if (!templateToDelete) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/planning/base-schedules/${templateToDelete.id}`, {
          method: "DELETE",
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo eliminar la plantilla.");
        }

        setTemplates((current) => current.filter((template) => template.id !== templateToDelete.id));

        if (form.id === templateToDelete.id) {
          resetForm();
        }

        setTemplateToDelete(null);
        showNotice("success", "Plantilla eliminada correctamente.");
      } catch (error) {
        showNotice("error", error.message);
      }
    });
  }

  if (isLoading) {
    return <div className={styles.loading}>Cargando plantillas de horario...</div>;
  }

  return (
    <div className={styles.layout}>
      <FloatingNotice notice={notice} onClose={dismissNotice} />
      <ConfirmDialog
        isOpen={isSaveConfirmOpen}
        title="Guardar plantilla"
        message="La plantilla quedara guardada como base para planificacion por area y rol. Revisa las alertas antes de confirmar."
        confirmLabel={isPending ? "Guardando..." : "Guardar"}
        cancelLabel="Revisar"
        tone="info"
        isPending={isPending}
        onCancel={() => setIsSaveConfirmOpen(false)}
        onConfirm={confirmSave}
      />
      <ConfirmDialog
        isOpen={Boolean(templateToDelete)}
        title="Eliminar plantilla"
        message={`Deseas eliminar "${templateToDelete?.name || ""}"? Esta accion no se puede deshacer.`}
        confirmLabel={isPending ? "Eliminando..." : "Eliminar"}
        isPending={isPending}
        onCancel={() => setTemplateToDelete(null)}
        onConfirm={confirmDeleteTemplate}
      />

      <form className={styles.formPanel} onSubmit={handleSubmit}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>Plantilla</p>
            <h2 className={styles.title}>{form.id ? "Editar horario base" : "Nuevo horario base"}</h2>
            <p className={styles.description}>
              Define turnos por rol. El almuerzo se toma de reglas laborales del area y puede ajustarse por plantilla.
            </p>
          </div>
          {form.id ? (
            <button type="button" className={styles.iconButton} onClick={resetForm} title="Limpiar formulario">
              <X size={16} />
            </button>
          ) : null}
        </div>

        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Nombre</span>
            <input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Ej. VENTAS CAJERA SEMANA A" />
          </label>
          <label className={styles.field}>
            <span>Area</span>
            <select value={form.areaCode} onChange={(event) => updateField("areaCode", event.target.value)}>
              <option value="">Seleccionar area</option>
              {areas.map((area) => <option key={area.code} value={area.code}>{area.name}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span>Rol</span>
            <select value={form.roleCode} onChange={(event) => updateField("roleCode", event.target.value)}>
              <option value="">Seleccionar rol</option>
              {rolesForArea.map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span>Grupo de rotacion</span>
            <input value={form.rotationGroup} onChange={(event) => updateField("rotationGroup", event.target.value)} placeholder="Ej. Semana A / Backup" />
          </label>
        </div>

        {canEditScheduleRows ? (
          <section className={`${styles.validationPanel} ${validation.isValid ? styles.validationOk : styles.validationWarn}`}>
            <div className={styles.validationHeader}>
              {validation.isValid ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <div>
                <strong>{validation.isValid ? "Cumple reglas base" : "Revisar reglas base"}</strong>
                <span>
                  {minutesLabel(validation.netMinutes)} netas, {minutesLabel(validation.supplementaryMinutes)} suplementarias, {validation.restDays} descansos.
                </span>
              </div>
            </div>
            {validation.warnings.length ? (
              <ul>
                {validation.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            ) : null}
          </section>
        ) : null}

        <div className={`${styles.tableWrap} ${!canEditScheduleRows ? styles.tableWrapDisabled : ""}`}>
          {!canEditScheduleRows ? (
            <div className={styles.tableOverlay}>
              Selecciona primero un area y un rol para habilitar la edicion del horario.
            </div>
          ) : null}
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Dia</th>
                <th>Tipo</th>
                <th>Entrada</th>
                <th>Almuerzo</th>
                <th>Salida</th>
                <th>Extra autorizado</th>
                <th>Neto</th>
              </tr>
            </thead>
            <tbody>
              {form.weeklyRows.map((row) => {
                const type = DAY_TYPES.find((item) => item.value === row.dayType);
                const disabled = !type?.isWorkingDay;
                const baseDailyMinutes = (Number(rules.dailyBaseHours) || 8) * 60;
                const netMinutes = disabled ? null : calculatePlannedNetMinutes(row, baseDailyMinutes);
                const presenceMinutes = disabled ? null : calculatePresenceMinutes(row);
                const isShortPresence = netMinutes !== null && presenceMinutes !== null && netMinutes > presenceMinutes;

                return (
                  <tr key={row.dayOfWeek}>
                    <td>{row.label}</td>
                    <td>
                      <select disabled={!canEditScheduleRows} value={row.dayType} onChange={(event) => updateRow(row.dayOfWeek, { dayType: event.target.value })}>
                        {DAY_TYPES.map((dayType) => <option key={dayType.value} value={dayType.value}>{dayType.label}</option>)}
                      </select>
                    </td>
                    <td><input type="time" value={row.startTime} disabled={!canEditScheduleRows || disabled} onChange={(event) => updateRow(row.dayOfWeek, { startTime: event.target.value })} /></td>
                    <td><input className={styles.compactNumberInput} type="number" min="0" disabled={!canEditScheduleRows || disabled} value={row.lunchDurationMinutes} onChange={(event) => updateRow(row.dayOfWeek, { lunchDurationMinutes: event.target.value })} /></td>
                    <td><input type="time" value={row.endTime} disabled={!canEditScheduleRows || disabled} onChange={(event) => updateRow(row.dayOfWeek, { endTime: event.target.value })} /></td>
                    <td><input className={styles.compactNumberInput} type="number" min="0" disabled={!canEditScheduleRows || disabled} value={row.authorizedExtraMinutes} onChange={(event) => updateRow(row.dayOfWeek, { authorizedExtraMinutes: event.target.value })} /></td>
                    <td><span className={`${styles.netTag} ${isShortPresence ? styles.netTagWarn : ""}`}>{netMinutes === null ? "--" : minutesLabel(netMinutes)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <label className={styles.field}>
          <span>Notas</span>
          <textarea rows={3} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="Ej. Intercalar semanalmente con el turno de backup." />
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.ghostButton} onClick={resetForm}>
            <Plus size={16} />
            Nueva
          </button>
          <button type="submit" className={styles.primaryButton} disabled={isPending || !hasChanges || !canEditScheduleRows}>
            <Save size={16} />
            {isPending ? "Guardando..." : hasChanges ? "Guardar plantilla" : "Sin cambios"}
          </button>
        </div>
      </form>

      <section className={styles.listPanel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>Biblioteca</p>
            <h2 className={styles.title}>Plantillas disponibles</h2>
          </div>
        </div>

        <div className={styles.templateGroups}>
          {templatesByArea.map(([areaName, areaTemplates]) => (
            <div key={areaName} className={styles.group}>
              <h3>{areaName}</h3>
              <div className={styles.templateList}>
                {areaTemplates.map((template) => (
                  <article key={template.id} className={styles.templateCard}>
                    <div>
                      <span className={styles.roleTag}>{template.roleName}</span>
                      <h4>{template.name}</h4>
                      <p>{template.rotationGroup || "Sin rotacion"}</p>
                    </div>
                    <div className={styles.dayChips}>
                      {template.weeklyRows.map((row) => (
                        <span key={row.dayOfWeek}>{row.label.slice(0, 3)} {row.startTime || "--"}-{row.endTime || "--"} / {minutesLabel(row.authorizedExtraMinutes)}</span>
                      ))}
                    </div>
                    <div className={styles.cardActions}>
                      <button type="button" onClick={() => editTemplate(template)} title="Editar"><Edit3 size={15} /></button>
                      <button type="button" onClick={() => duplicateTemplate(template)} title="Duplicar"><Copy size={15} /></button>
                      <button type="button" className={styles.dangerButton} onClick={() => setTemplateToDelete(template)} title="Eliminar"><Trash2 size={15} /></button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}

          {!templates.length ? (
            <div className={styles.emptyState}>
              Todavia no hay plantillas. Crea la primera para empezar a modelar los turnos por area y rol.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
