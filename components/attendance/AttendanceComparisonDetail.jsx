"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

import { planningModulePath } from "@/lib/modules/planning/routes";
import styles from "./AttendanceComparisonDetail.module.scss";

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function minutesBadge(value) {
  return value && value !== "0m" ? value : "--";
}

function formatMinutes(value) {
  const minutes = Number(value) || 0;

  if (!minutes) return "--";

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function punchLabel(index) {
  const labels = ["ENT", "ALM", "REG", "SAL"];

  return labels[index] || "Extra";
}

function buildReturnHref(filters) {
  const params = new URLSearchParams();
  params.set("month", filters.month || currentMonthKey());

  if (filters.branchCode) params.set("branchCode", filters.branchCode);
  if (filters.areaCode) params.set("areaCode", filters.areaCode);
  if (filters.roleCode) params.set("roleCode", filters.roleCode);

  return `${planningModulePath("/attendance/comparison")}?${params.toString()}`;
}

export default function AttendanceComparisonDetail({ employeeId, initialFilters = {} }) {
  const initialFiltersRef = useRef({
    month: initialFilters.month || currentMonthKey(),
    branchCode: initialFilters.branchCode || "",
    areaCode: initialFilters.areaCode || "",
    roleCode: initialFilters.roleCode || "",
  });
  const [month, setMonth] = useState(initialFiltersRef.current.month);
  const [row, setRow] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const filters = {
    ...initialFiltersRef.current,
    month,
  };

  function syncUrl(nextMonth) {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams();
    params.set("month", nextMonth);

    if (filters.branchCode) params.set("branchCode", filters.branchCode);
    if (filters.areaCode) params.set("areaCode", filters.areaCode);
    if (filters.roleCode) params.set("roleCode", filters.roleCode);

    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  async function loadReport(nextMonth = month) {
    try {
      setIsLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.set("month", nextMonth);
      params.set("employeeId", employeeId);

      const response = await fetch(`/api/attendance/comparison?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "No se pudo cargar el reporte.");
      }

      setRow(payload.rows?.[0] || null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleMonthChange(value) {
    setMonth(value);
    syncUrl(value);
    loadReport(value);
  }

  useEffect(() => {
    loadReport(initialFiltersRef.current.month);
  }, []);

  return (
    <section className={styles.panel}>
      <div className={styles.topbar}>
        <Link href={buildReturnHref(filters)} className={styles.backLink}>
          <ArrowLeft size={16} />
          Resumen
        </Link>

        <label className={styles.monthControl}>
          <span>Mes</span>
          <input type="month" value={month} onChange={(event) => handleMonthChange(event.target.value)} />
        </label>
      </div>

      {error ? (
        <div className={styles.errorBox}>
          <AlertTriangle size={17} />
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className={styles.loadingScene} aria-hidden="true">
          <span className={styles.skeletonTitle} />
          {Array.from({ length: 10 }).map((_, index) => <span key={index} className={styles.skeletonRow} />)}
        </div>
      ) : row ? (
        <>
          <div className={styles.identity}>
            <div>
              <strong>{row.employee.fullName}</strong>
              <span>{row.employee.branchName} · {row.employee.areaName} · {row.employee.roleName}</span>
            </div>
            <div className={styles.summaryLine}>
              <span>{row.summary.issueDays} días con novedades</span>
              <span>{row.summary.missingPunchDays} incompletos</span>
              <span>{row.summary.lateDays} atrasos</span>
              <span>Sup. {minutesBadge(row.summary.supplementaryLabel)}</span>
              <span>Adic. {minutesBadge(row.summary.additionalSupplementaryLabel)}</span>
              <span>Ext. {minutesBadge(row.summary.extraordinaryLabel)}</span>
            </div>
          </div>

          <div className={styles.tableShell}>
            <div className={styles.tableScroller}>
              <table>
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Horario y picadas</th>
                    <th>Planificado</th>
                    <th>Trabajado</th>
                    <th>Atraso</th>
                    <th>Adicional</th>
                  </tr>
                </thead>
                <tbody>
                  {row.days.map((day) => (
                    <tr key={day.dateKey} className={day.hasIssue ? styles.issueRow : ""}>
                      <td>
                        <strong>{day.dayLabel}</strong>
                        <span>{day.dateLabel}</span>
                      </td>
                      <td>
                        <div className={styles.timelineCell}>
                          <div className={styles.scheduleLine}>
                            {day.startTime && day.endTime ? (
                              <>
                                <span>{day.startTime}</span>
                                {day.lunchDurationMinutes > 0 ? <span>Almuerzo {formatMinutes(day.lunchDurationMinutes)}</span> : null}
                                {day.plannedSupplementaryMinutes > 0 ? <span>Sup. {formatMinutes(day.plannedSupplementaryMinutes)}</span> : null}
                                <span>{day.endTime}</span>
                              </>
                            ) : (
                              <>
                                <span>{day.dayTypeLabel}</span>
                                {day.tags.includes("Trabajo sin horario") || day.tags.includes("Trabajo en feriado") ? (
                                  <span className={styles.unplannedWork}>Trabajo sin horario</span>
                                ) : null}
                              </>
                            )}
                          </div>
                          <div className={styles.punchLine}>
                            {day.punches.length
                              ? day.punches.map((punch, index) => (
                                <span key={punch.id}>
                                  <small>{punchLabel(index)} </small>
                                  {punch.time}
                                </span>
                              ))
                              : <span><small>Picadas </small>Sin registros</span>}
                            {day.actualLunchMinutes !== null ? (
                              <span className={styles.lunchTotal}>
                                <small>ALM TOTAL</small>
                                {day.actualLunchLabel}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        {day.dayType === "weekend_overtime" ? (
                          <>
                            <strong>{day.scheduledWorkedLabel}</strong>
                            <span>Extra {day.scheduledWorkedLabel}</span>
                          </>
                        ) : day.dayType === "workday" ? (
                          <>
                            <strong>{day.scheduledWorkedLabel}</strong>
                            <span>Normal {day.plannedRegularLabel}</span>
                            <span>Sup. plan. {day.plannedSupplementaryLabel}</span>
                          </>
                        ) : (
                          <>
                            <strong>{day.dayTypeLabel}</strong>
                            {day.workedMinutes > 0 ? <span>Trabajo sin horario</span> : null}
                          </>
                        )}
                      </td>
                      <td>
                        <strong>{day.workedLabel}</strong>
                        <span>{day.punchCount} picadas</span>
                      </td>
                      <td>
                        <strong>{day.lateMinutes ? `${day.lateMinutes}m` : "--"}</strong>
                        <span>Gracia {day.graceMinutes}m</span>
                      </td>
                      <td>
                        <div className={styles.extraList}>
                          <span>Sup. {day.additionalSupplementaryLabel}</span>
                          <span>Ext. {day.extraordinaryLabel}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className={styles.errorBox}>
          <RefreshCw size={17} />
          No se encontró información para este empleado en el mes seleccionado.
        </div>
      )}
    </section>
  );
}
