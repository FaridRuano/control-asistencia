"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { addDays, format } from "date-fns";
import { ArrowLeft, CalendarDays, Save } from "lucide-react";

import FloatingNotice from "@/components/ui/FloatingNotice";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  getMonthWeekOptions,
  getWeekStartKey,
  sortTemplatesByVariant,
} from "@/lib/planning/scheduleAssignments";
import { planningModulePath } from "@/lib/modules/planning/routes";
import { WEEK_DAYS } from "@/lib/schedules";
import styles from "./EmployeeScheduleDetail.module.scss";

const DAY_LABELS = new Map(WEEK_DAYS.map((day) => [day.dayOfWeek, day.label]));

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function scheduleLine(day) {
  if (!day) {
    return "Sin horario";
  }

  if (day.dayType === "holiday") {
    return "Feriado";
  }

  if (day.dayType === "off_day") {
    return "Descanso";
  }

  if (!day.startTime || !day.endTime) {
    return "Horario incompleto";
  }

  const lunch = day.lunchDurationMinutes ? `, almuerzo ${day.lunchDurationMinutes} min` : "";
  const extra = day.authorizedExtraMinutes ? `, extra ${day.authorizedExtraMinutes} min` : "";

  return `${day.startTime} - ${day.endTime}${lunch}${extra}`;
}

function dayTone(dayType) {
  if (!dayType) {
    return styles.toneMissing;
  }

  if (dayType === "weekend_overtime") {
    return styles.toneExtra;
  }

  if (dayType === "holiday") {
    return styles.toneHoliday;
  }

  if (dayType === "off_day") {
    return styles.toneOff;
  }

  return styles.toneWork;
}

function buildDraftPlan(assignment, weeks) {
  const planByWeek = new Map((assignment?.weeklyPlan || []).map((week) => [week.weekStartKey, week.templateId]));

  return Object.fromEntries(weeks.map((week) => [week.weekStartKey, planByWeek.get(week.weekStartKey) || ""]));
}

function plansAreEqual(leftPlan, rightPlan, weeks) {
  return weeks.every((week) => (leftPlan[week.weekStartKey] || "") === (rightPlan[week.weekStartKey] || ""));
}

function buildFullWeekDays(weekStartKey, plannedDays = []) {
  const plannedByDate = new Map(plannedDays.map((day) => [day.dateKey, day]));
  const weekStartDate = new Date(`${weekStartKey}T12:00:00`);

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStartDate, index);
    const dateKey = format(date, "yyyy-MM-dd");
    const plannedDay = plannedByDate.get(dateKey);

    if (plannedDay) {
      return plannedDay;
    }

    const dayOfWeek = date.getDay();

    return {
      dateKey,
      dayOfWeek,
      label: DAY_LABELS.get(dayOfWeek) || "",
      dayType: "",
      startTime: "",
      endTime: "",
      lunchDurationMinutes: 0,
      authorizedExtraMinutes: 0,
      source: "empty",
    };
  });
}

function buildReturnUrl(monthKey, filters = {}) {
  const params = new URLSearchParams({ month: monthKey });

  if (filters.branchCode) {
    params.set("branchCode", filters.branchCode);
  }

  if (filters.areaCode) {
    params.set("areaCode", filters.areaCode);
  }

  if (filters.roleCode) {
    params.set("roleCode", filters.roleCode);
  }

  return `${planningModulePath("/planning/monthly")}?${params.toString()}`;
}

export default function EmployeeScheduleDetail({ employeeId, initialMonth = "", returnFilters = {} }) {
  const [monthKey, setMonthKey] = useState(initialMonth || currentMonthKey());
  const [employee, setEmployee] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [draftPlan, setDraftPlan] = useState({});
  const [savedPlan, setSavedPlan] = useState({});
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [isPending, startTransition] = useTransition();
  const noticeExitTimeoutRef = useRef(null);
  const noticeRemoveTimeoutRef = useRef(null);
  const weeks = useMemo(() => getMonthWeekOptions(monthKey), [monthKey]);
  const returnHref = useMemo(() => buildReturnUrl(monthKey, returnFilters), [monthKey, returnFilters]);
  const hasChanges = useMemo(() => !plansAreEqual(draftPlan, savedPlan, weeks), [draftPlan, savedPlan, weeks]);
  const roleTemplates = useMemo(
    () =>
      sortTemplatesByVariant(
        templates.filter((template) =>
          template.areaCode === employee?.areaCode && template.roleCode === employee?.roleCode,
        ),
      ),
    [employee?.areaCode, employee?.roleCode, templates],
  );
  const daysByWeek = useMemo(() => {
    const grouped = new Map(weeks.map((week) => [week.weekStartKey, []]));

    (assignment?.generatedDays || []).forEach((day) => {
      const weekStartKey = getWeekStartKey(day.dateKey);

      if (!grouped.has(weekStartKey)) {
        grouped.set(weekStartKey, []);
      }

      grouped.get(weekStartKey).push(day);
    });

    return grouped;
  }, [assignment?.generatedDays, weeks]);

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

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      setIsLoading(true);

      try {
        const [employeeResponse, assignmentResponse, templatesResponse] = await Promise.all([
          fetch(`/api/employees/${employeeId}`),
          fetch(`/api/planning/schedule-assignments?month=${monthKey}&employeeId=${employeeId}`),
          fetch("/api/planning/base-schedules"),
        ]);
        const [employeePayload, assignmentPayload, templatesPayload] = await Promise.all([
          employeeResponse.json(),
          assignmentResponse.json(),
          templatesResponse.json(),
        ]);

        if (!employeeResponse.ok) {
          throw new Error(employeePayload.error || "No se pudo cargar el empleado.");
        }

        if (!assignmentResponse.ok) {
          throw new Error(assignmentPayload.error || "No se pudo cargar el horario.");
        }

        if (!templatesResponse.ok) {
          throw new Error(templatesPayload.error || "No se pudieron cargar las plantillas.");
        }

        if (!isCancelled) {
          const loadedAssignment = assignmentPayload.assignments?.[0] || null;

          setEmployee(employeePayload.employee || null);
          setAssignment(loadedAssignment);
          setTemplates(templatesPayload.templates || []);
          const loadedPlan = buildDraftPlan(loadedAssignment, weeks);

          setDraftPlan(loadedPlan);
          setSavedPlan(loadedPlan);
          setIsConfirmOpen(false);
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
  }, [clearNoticeTimers, employeeId, monthKey, showNotice, weeks]);

  function updateWeekTemplate(weekStartKey, templateId) {
    setDraftPlan((current) => ({ ...current, [weekStartKey]: templateId }));
  }

  function savePlan() {
    if (!hasChanges) {
      showNotice("error", "No hay cambios pendientes para guardar.");
      return;
    }

    const weeklyPlan = weeks.map((week) => ({
      ...week,
      templateId: draftPlan[week.weekStartKey] || "",
    }));

    if (weeklyPlan.some((week) => !week.templateId)) {
      showNotice("error", "Selecciona una plantilla para cada semana.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/planning/schedule-assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            monthKey,
            employeeId,
            weeklyPlan,
          }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo guardar el horario.");
        }

        setAssignment(payload.assignment);
        const nextSavedPlan = buildDraftPlan(payload.assignment, weeks);

        setDraftPlan(nextSavedPlan);
        setSavedPlan(nextSavedPlan);
        setIsConfirmOpen(false);
        showNotice("success", payload.message);
      } catch (error) {
        showNotice("error", error.message);
      }
    });
  }

  return (
    <div className={styles.stack}>
      <FloatingNotice notice={notice} onClose={dismissNotice} />
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Guardar horario"
        message={`Se actualizaran las plantillas semanales de ${employee?.fullName || "este empleado"} para ${monthKey}.`}
        confirmLabel={isPending ? "Guardando..." : "Guardar horario"}
        cancelLabel="Revisar"
        tone="neutral"
        isPending={isPending}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={savePlan}
      />

      {isLoading ? (
        <section className={styles.loadingPanel} aria-live="polite">
          <div className={styles.skeletonToolbar}>
            <span className={styles.skeletonBack} />
            <span className={styles.skeletonIdentity} />
            <span className={styles.skeletonMonth} />
            <span className={styles.skeletonSave} />
          </div>
          <div className={styles.skeletonGrid}>
            {Array.from({ length: 3 }, (_, index) => (
              <article key={index} className={styles.skeletonCard}>
                <span className={styles.skeletonTitle} />
                <span className={styles.skeletonSelect} />
                <span className={styles.skeletonLine} />
                <span className={styles.skeletonLine} />
                <span className={styles.skeletonLineShort} />
              </article>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className={styles.toolbar}>
            <Link href={returnHref} className={styles.backLink}>
              <ArrowLeft size={16} />
              Volver
            </Link>
            <div className={styles.identity}>
              <p className={styles.eyebrow}>Empleado</p>
              <h2>{employee?.fullName || "Horario mensual"}</h2>
              <span>
                {[employee?.branchName || employee?.branchCode, employee?.areaName, employee?.roleName]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <label className={styles.monthField}>
              <span>Mes</span>
              <input type="month" value={monthKey} onChange={(event) => setMonthKey(event.target.value)} />
            </label>
            <button
              type="button"
              className={styles.saveButton}
              onClick={() => setIsConfirmOpen(true)}
              disabled={isPending || !roleTemplates.length || !hasChanges}
            >
              <Save size={16} />
              {isPending ? "Guardando..." : hasChanges ? "Guardar horario" : "Sin cambios"}
            </button>
          </section>
          <section className={styles.weekGrid}>
            {weeks.map((week) => {
              const days = buildFullWeekDays(week.weekStartKey, daysByWeek.get(week.weekStartKey) || []);
              const weekPlan = assignment?.weeklyPlan?.find((item) => item.weekStartKey === week.weekStartKey);
              const selectedTemplateId = draftPlan[week.weekStartKey] || "";
              const selectedTemplate = roleTemplates.find((template) => template.id === selectedTemplateId);

              return (
                <article key={week.weekStartKey} className={styles.weekCard}>
                  <div className={styles.weekHeader}>
                    <div>
                      <p>{week.label}</p>
                      <h3>{week.rangeLabel}</h3>
                    </div>
                    <span>{selectedTemplate?.name || weekPlan?.templateName || "Sin plantilla"}</span>
                  </div>
                  <label className={styles.templateField}>
                    <span>Horario de la semana</span>
                    <select
                      value={selectedTemplateId}
                      onChange={(event) => updateWeekTemplate(week.weekStartKey, event.target.value)}
                    >
                      <option value="">Seleccionar horario</option>
                      {roleTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className={styles.dayList}>
                    {days.map((day) => (
                      <div key={day.dateKey} className={`${styles.dayRow} ${day.source === "empty" ? styles.dayRowMissing : ""}`}>
                        <div>
                          <strong>{day.label}</strong>
                          <span>{`${day.dateKey.slice(8, 10)}/${day.dateKey.slice(5, 7)}`}</span>
                        </div>
                        <p className={dayTone(day.dayType)}>{scheduleLine(day.source === "empty" ? null : day)}</p>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}
      {!isLoading && !roleTemplates.length ? (
        <section className={styles.emptyState}>
          <CalendarDays size={20} />
          <p>No hay plantillas activas para el rol de este empleado.</p>
        </section>
      ) : null}
    </div>
  );
}
