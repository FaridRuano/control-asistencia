"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { format, startOfDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Database,
  Save,
  Search,
  X,
} from "lucide-react";

import styles from "./NormalizeAttendanceView.module.scss";

function formatDateTime(value) {
  if (!value) {
    return "N/D";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "N/D";
  }

  return format(parsed, "dd/MM/yyyy HH:mm", { locale: es });
}

function formatDate(value) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "N/D";
  }

  return format(parsed, "dd/MM/yyyy", { locale: es });
}

function formatTime(value) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "N/D";
  }

  return format(parsed, "HH:mm", { locale: es });
}

function formatDayName(value) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "N/D";
  }

  return format(parsed, "EEEE", { locale: es });
}

function formatWeekLabel(value) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Semana desconocida";
  }

  const weekStart = startOfWeek(parsed, { weekStartsOn: 1 });
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return `${format(weekStart, "d MMM", { locale: es })} al ${format(weekEnd, "d MMM yyyy", {
    locale: es,
  })}`;
}

function groupPunchesByWeek(punches) {
  const grouped = new Map();

  punches.forEach((punch) => {
    const parsed = new Date(punch.punchedAt);

    if (Number.isNaN(parsed.getTime())) {
      return;
    }

    const weekStart = startOfWeek(parsed, { weekStartsOn: 1 });
    const weekKey = weekStart.toISOString();

    if (!grouped.has(weekKey)) {
      grouped.set(weekKey, []);
    }

    grouped.get(weekKey).push(punch);
  });

  return [...grouped.entries()]
    .sort((left, right) => new Date(left[0]).getTime() - new Date(right[0]).getTime())
    .map(([weekKey, weekPunches]) => ({
      weekKey,
      label: formatWeekLabel(weekKey),
      punches: weekPunches.sort(
        (left, right) => new Date(left.punchedAt).getTime() - new Date(right.punchedAt).getTime(),
      ),
    }));
}

function groupPunchesByDay(punches) {
  const grouped = new Map();

  punches.forEach((punch) => {
    const parsed = new Date(punch.punchedAt);

    if (Number.isNaN(parsed.getTime())) {
      return;
    }

    const dayKey = startOfDay(parsed).toISOString();

    if (!grouped.has(dayKey)) {
      grouped.set(dayKey, []);
    }

    grouped.get(dayKey).push(punch);
  });

  return [...grouped.entries()]
    .sort((left, right) => new Date(left[0]).getTime() - new Date(right[0]).getTime())
    .map(([dayKey, dayPunches]) => ({
      dayKey,
      punches: dayPunches.sort(
        (left, right) => new Date(left.punchedAt).getTime() - new Date(right.punchedAt).getTime(),
      ),
    }));
}

export default function NormalizeAttendanceView({ uploadId }) {
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishingPunches, setIsPublishingPunches] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const totalRows = useMemo(
    () => response?.employees?.reduce((sum, employee) => sum + employee.punches.length, 0) || 0,
    [response],
  );

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return response?.employees || [];
    }

    return (response?.employees || []).filter((employee) => {
      const haystack = `${employee.fullName} ${employee.biometricCode} ${employee.department}`
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [response?.employees, search]);
  const isNormalizationSaved = response?.source === "saved";

  function showToast(type, message) {
    setToast({ type, message });

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 5000);
  }

  async function handleSaveNormalization() {
    try {
      setIsSaving(true);
      const request = await fetch(`/api/attendance/upload/${uploadId}/normalize`, {
        method: "POST",
      });
      const payload = await request.json();

      if (!request.ok) {
        throw new Error(payload.error || "No se pudo guardar la normalización.");
      }

      setResponse(payload);
      showToast("success", payload.message || "Normalización guardada correctamente.");
    } catch (requestError) {
      showToast("error", requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublishPunches() {
    try {
      setIsPublishingPunches(true);
      const request = await fetch(`/api/attendance/upload/${uploadId}/publish-punches`, {
        method: "POST",
      });
      const payload = await request.json();

      if (!request.ok) {
        throw new Error(payload.error || "No se pudieron cargar las picadas.");
      }

      setResponse((current) =>
        current
          ? {
              ...current,
              upload: {
                ...current.upload,
                punchesPublishedAt: payload.publishedAt,
              },
            }
          : current,
      );

      showToast(
        "success",
        `Se cargaron ${payload.publishedPunches} picadas para ${payload.publishedEmployees} empleados.`,
      );
    } catch (requestError) {
      showToast("error", requestError.message);
    } finally {
      setIsPublishingPunches(false);
    }
  }

  useEffect(() => {
    let isCancelled = false;

    async function fetchNormalizedUpload() {
      try {
        if (!isCancelled) {
          setIsLoading(true);
        }

        const request = await fetch(`/api/attendance/upload/${uploadId}/normalize`);
        const payload = await request.json();

        if (!request.ok) {
          throw new Error(payload.error || "No se pudo normalizar la carga.");
        }

        if (!isCancelled) {
          setResponse(payload);
        }
      } catch (requestError) {
        if (!isCancelled) {
          showToast("error", requestError.message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchNormalizedUpload();

    return () => {
      isCancelled = true;

      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [uploadId]);

  useEffect(() => {
    if (!isPublishingPunches) {
      return undefined;
    }

    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
      return "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isPublishingPunches]);

  return (
    <>
      {isPublishingPunches ? (
        <div className={styles.blockingOverlay} role="alert" aria-live="assertive">
          <div className={styles.blockingCard}>
            <div className={styles.loadingSpinner} />
            <h2 className={styles.blockingTitle}>Cargando picadas al sistema</h2>
            <p className={styles.blockingMessage}>
              No cierres esta página ni navegues a otra sección hasta que termine el proceso.
            </p>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`${styles.toast} ${
            toast.type === "success" ? styles.toastSuccess : styles.toastError
          }`}
          role="status"
          aria-live="polite"
        >
          <div className={styles.toastIcon}>
            {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          </div>
          <div className={styles.toastContent}>
            <p className={styles.toastTitle}>
              {toast.type === "success" ? "Operación exitosa" : "Algo necesita atención"}
            </p>
            <p className={styles.toastMessage}>{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className={styles.toastClose}
            aria-label="Cerrar notificación"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.topBar}>
          <Link href="/dashboard/uploads" className={styles.backLink}>
            <ArrowLeft size={16} />
            Volver a cargas
          </Link>
        </div>

        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner} />
            <span>Normalizando archivo guardado...</span>
          </div>
        ) : response ? (
          <>
            <div className={styles.actionBar}>
              <div className={styles.badgeStack}>
                <div className={styles.sourceBadge}>
                  {response.source === "saved"
                    ? `Normalización guardada${
                        response.upload?.normalizedAt
                          ? ` · ${formatDateTime(response.upload.normalizedAt)}`
                          : ""
                      }`
                    : "Normalización temporal en memoria"}
                </div>

                <div className={styles.sourceBadgeSecondary}>
                  {response.upload?.punchesPublishedAt
                    ? `Picadas publicadas · ${formatDateTime(response.upload.punchesPublishedAt)}`
                    : "Picadas aún no publicadas en el SISTEMA"}
                </div>
              </div>

              <div className={styles.actionButtons}>
                {!isNormalizationSaved ? (
                  <button
                    type="button"
                    onClick={handleSaveNormalization}
                    disabled={isSaving}
                    className={styles.saveButton}
                  >
                    <Save size={16} />
                    {isSaving ? "Guardando..." : "Guardar normalización"}
                  </button>
                ) : null}

                {isNormalizationSaved
                  ? response.upload?.punchesPublishedAt ? (
                      <div className={styles.publishedTag}>
                        <CheckCircle2 size={16} />
                        <span>
                          Picadas cargadas · {formatDateTime(response.upload.punchesPublishedAt)}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePublishPunches}
                        disabled={isPublishingPunches}
                        className={styles.publishButton}
                      >
                        <Database size={16} />
                        {isPublishingPunches
                          ? "Cargando picadas..."
                          : "Cargar picadas al Sistema"}
                      </button>
                    )
                  : null}
              </div>
            </div>

            <div className={styles.summaryGrid}>
              {[
                { label: "Archivo", value: response.upload?.fileName || "N/D" },
                { label: "Empleados", value: response.summary?.totalEmployees || 0 },
                { label: "Picadas", value: response.summary?.totalPunches || 0 },
                { label: "Registros", value: totalRows },
              ].map((item) => (
                <div key={item.label} className={styles.summaryCard}>
                  <p className={styles.summaryLabel}>{item.label}</p>
                  <p className={styles.summaryValue}>{item.value}</p>
                </div>
              ))}
            </div>

            <label className={styles.searchField}>
              <span className={styles.searchLabel}>Filtrar empleado encontrado</span>
              <div className={styles.searchInputWrap}>
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre, código o departamento"
                  className={styles.searchInput}
                />
              </div>
            </label>

            <div className={styles.employeeList}>
              {filteredEmployees.map((employee) => (
                <article key={`${employee.biometricCode}-${employee.fullName}`} className={styles.employeeCard}>
                  <div className={styles.employeeHeader}>
                    <div>
                      <p className={styles.employeeName}>{employee.fullName}</p>
                      <p className={styles.employeeMeta}>
                        {employee.biometricCode || "s/n"} · {employee.department || "Sin departamento"}
                      </p>
                    </div>
                    <div className={styles.employeeCount}>
                      <FileSpreadsheet size={16} />
                      <span>{employee.punchCount} picadas</span>
                    </div>
                  </div>

                  <div className={styles.punchList}>
                    {employee.punches.length ? (
                      groupPunchesByWeek(employee.punches).map((week) => (
                        <section key={`${employee.biometricCode}-${week.weekKey}`} className={styles.weekGroup}>
                          <div className={styles.weekHeader}>
                            <span className={styles.weekTitle}>{week.label}</span>
                            <span className={styles.weekCount}>{week.punches.length} picadas</span>
                          </div>

                          <div className={styles.punchTableWrap}>
                            <table className={styles.punchTable}>
                              <colgroup>
                                <col className={styles.colDay} />
                                <col className={styles.colDate} />
                                <col className={styles.colPunches} />
                              </colgroup>
                              <thead>
                                <tr>
                                  <th>Día</th>
                                  <th>Fecha</th>
                                  <th>Picadas</th>
                                </tr>
                              </thead>
                              <tbody>
                                {groupPunchesByDay(week.punches).map((day) => (
                                  <tr
                                    key={`${employee.biometricCode}-${week.weekKey}-${day.dayKey}`}
                                  >
                                    <td className={styles.punchDay}>
                                      {formatDayName(day.punches[0]?.punchedAt)}
                                    </td>
                                    <td className={styles.punchDate}>
                                      {formatDate(day.punches[0]?.punchedAt)}
                                    </td>
                                    <td>
                                      <div className={styles.punchChips}>
                                        {day.punches.length ? (
                                          day.punches.map((punch, index) => (
                                            <span
                                              key={`${day.dayKey}-${punch.punchedAt}-${index}`}
                                              className={styles.punchChip}
                                            >
                                              {formatTime(punch.punchedAt)}
                                            </span>
                                          ))
                                        ) : (
                                          <span className={styles.punchChipEmpty}>--</span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      ))
                    ) : (
                      <div className={styles.emptyPunches}>No se encontraron picadas para este empleado.</div>
                    )}
                  </div>
                </article>
              ))}

              {!filteredEmployees.length ? (
                <div className={styles.emptyEmployees}>
                  No hay empleados que coincidan con el filtro actual.
                </div>
              ) : null}
            </div>

            {response.parserLogs?.length ? (
              <div className={styles.logs}>
                <h3 className={styles.logsTitle}>Trazas del parser</h3>
                <ul className={styles.logsList}>
                  {response.parserLogs.slice(0, 16).map((log, index) => (
                    <li key={`${log}-${index}`}>{log}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </>
  );
}
