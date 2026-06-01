"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

import CatalogDrawer from "@/components/catalog/CatalogDrawer";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { formatEcuadorMonthKey } from "@/lib/datetime/ecuador";
import { planningModulePath } from "@/lib/modules/planning/routes";
import styles from "./AttendanceComparisonDetail.module.scss";

function currentMonthKey() {
  return formatEcuadorMonthKey();
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

function moneyLabel(value) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function punchLabel(index, punchCount) {
  const labels = punchCount === 2
    ? ["ENT", "SAL"]
    : ["ENT", "ALM", "REG", "SAL"];

  return labels[index] || "Extra";
}

const DEFAULT_LUNCH_LIMIT_MINUTES = 60;

function lunchTotalClass(day) {
  const plannedLunchMinutes = Number(day.lunchDurationMinutes) || DEFAULT_LUNCH_LIMIT_MINUTES;
  const actualLunchMinutes = Number(day.actualLunchMinutes) || 0;
  const isOverPlannedLunch = actualLunchMinutes > plannedLunchMinutes;

  return isOverPlannedLunch
    ? `${styles.lunchTotal} ${styles.lunchTotalWarning}`
    : styles.lunchTotal;
}

function isIgnorableRestDay(day) {
  return day.dayType === "off_day" && day.punchCount === 0;
}

function hasPlannedStart(day) {
  return ["workday", "weekend_overtime"].includes(day.dayType);
}

function dayRowClass(day) {
  if (isIgnorableRestDay(day)) return styles.ignoredRestRow;
  if (canOpenDayDecision(day)) return `${day.hasIssue ? styles.issueRow : ""} ${styles.actionableRow}`;
  if (day.hasIssue) return styles.issueRow;
  return "";
}

function hasAuthorizableTime(day) {
  return (Number(day.detectedSupplementaryMinutes) || 0) > 0 || (Number(day.detectedExtraordinaryMinutes) || 0) > 0;
}

function canManuallyAuthorizeHours(day) {
  if (hasAuthorizableTime(day)) return true;

  if (day.dayType === "workday") {
    return day.payrollPolicy?.appliesSupplementaryHours !== false;
  }

  return ["holiday", "weekend_overtime", "off_day"].includes(day.dayType) &&
    day.payrollPolicy?.appliesExtraordinaryHours !== false;
}

function canOpenDayDecision(day) {
  return !isIgnorableRestDay(day) && canManuallyAuthorizeHours(day);
}

function issueTagClass(tag) {
  if (tag === "Suplementarias adicionales") return `${styles.issueTag} ${styles.additionalTag}`;
  return styles.issueTag;
}

function valueHintClass(day) {
  const decision = day.authorization?.decision;

  if (decision === "full") return `${styles.valueHint} ${styles.valueHintAuthorized}`;
  if (day.authorization?.hasUnauthorizedSupplementaryTime || day.authorization?.hasUnauthorizedExtraordinaryTime) {
    return `${styles.valueHint} ${styles.valueHintWarning}`;
  }

  return styles.valueHint;
}

function minutesToHourInput(value) {
  const totalMinutes = Math.max(0, Number(value) || 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours && !minutes) return "";
  if (!minutes) return String(hours);
  return `${hours}.${String(minutes).padStart(2, "0")}`;
}

function hourInputToMinutes(value) {
  const rawValue = String(value ?? "").trim().replace(",", ".");

  if (!rawValue) return 0;

  const [hourPart = "0", minutePart = ""] = rawValue.split(".");
  const hours = Math.max(0, Number.parseInt(hourPart, 10) || 0);
  const normalizedMinutePart = minutePart.length === 1 ? `${minutePart}0` : minutePart.slice(0, 2);
  const minutes = Math.min(59, Math.max(0, Number.parseInt(normalizedMinutePart || "0", 10) || 0));

  return (hours * 60) + minutes;
}

function buildActionDrafts(days = []) {
  return Object.fromEntries(days.map((day) => [
    day.dateKey,
    {
      supplementary: minutesToHourInput(day.authorization?.authorizedSupplementaryMinutes ?? day.detectedSupplementaryMinutes ?? day.supplementaryMinutes ?? 0),
      extraordinary: minutesToHourInput(day.authorization?.authorizedExtraordinaryMinutes ?? day.detectedExtraordinaryMinutes ?? day.extraordinaryMinutes ?? 0),
      note: day.authorization?.note || "",
      decision: day.authorization?.decision || "custom",
    },
  ]));
}

function plannedAuthorizationMinutes(day) {
  const plannedSupplementaryMinutes = Math.min(
    Number(day.detectedSupplementaryMinutes) || 0,
    Math.max(0, (Number(day.plannedSupplementaryMinutes) || 0) - (Number(day.lunchOverageRemainderMinutes) || 0)),
  );
  const plannedExtraordinaryMinutes = Math.min(
    Number(day.detectedExtraordinaryMinutes) || 0,
    day.dayType === "holiday" && (Number(day.punchCount) || 0) > 0
      ? 8 * 60
      : day.dayType === "weekend_overtime"
        ? Number(day.scheduledWorkedMinutes) || 0
        : Number(day.plannedExtraordinaryMinutes) || 0,
  );

  return {
    plannedSupplementaryMinutes,
    plannedExtraordinaryMinutes,
  };
}

function authorizationPayloadForDay(employeeId, day, decision, draft = {}) {
  const draftSupplementaryMinutes = hourInputToMinutes(draft.supplementary);
  const draftExtraordinaryMinutes = hourInputToMinutes(draft.extraordinary);
  const detectedSupplementaryMinutes = Math.max(Number(day.detectedSupplementaryMinutes) || 0, draftSupplementaryMinutes);
  const detectedExtraordinaryMinutes = Math.max(Number(day.detectedExtraordinaryMinutes) || 0, draftExtraordinaryMinutes);
  const plannedMinutes = plannedAuthorizationMinutes(day);
  const authorizedSupplementaryMinutes = decision === "full"
    ? detectedSupplementaryMinutes
    : decision === "planned"
      ? plannedMinutes.plannedSupplementaryMinutes
      : Math.min(detectedSupplementaryMinutes, draftSupplementaryMinutes);
  const authorizedExtraordinaryMinutes = decision === "full"
    ? detectedExtraordinaryMinutes
    : decision === "planned"
      ? plannedMinutes.plannedExtraordinaryMinutes
      : Math.min(detectedExtraordinaryMinutes, draftExtraordinaryMinutes);

  return {
    employeeId,
    dateKey: day.dateKey,
    decision,
    authorizedSupplementaryMinutes,
    authorizedExtraordinaryMinutes,
    detectedSupplementaryMinutes,
    detectedExtraordinaryMinutes,
    note: draft.note || "",
  };
}

function buildDecisionPreview(day, draft = {}, summary = {}) {
  const draftSupplementaryMinutes = hourInputToMinutes(draft.supplementary);
  const draftExtraordinaryMinutes = hourInputToMinutes(draft.extraordinary);
  const detectedSupplementaryMinutes = Math.max(Number(day?.detectedSupplementaryMinutes) || 0, draftSupplementaryMinutes);
  const detectedExtraordinaryMinutes = Math.max(Number(day?.detectedExtraordinaryMinutes) || 0, draftExtraordinaryMinutes);
  const supplementaryMinutes = Math.min(detectedSupplementaryMinutes, draftSupplementaryMinutes);
  const extraordinaryMinutes = Math.min(detectedExtraordinaryMinutes, draftExtraordinaryMinutes);
  const hourlyRate = Number(summary.hourlyRateRaw ?? summary.hourlyRate) || 0;
  const supplementaryMultiplier = Number(summary.supplementaryMultiplier) || 1.5;
  const extraordinaryMultiplier = Number(summary.extraordinaryMultiplier) || 2;
  const isWorkedHoliday = day?.dayType === "holiday" && (extraordinaryMinutes > 0 || (Number(day?.punchCount) || 0) > 0);
  const regularAmount = isWorkedHoliday ? 0 : ((Number(day?.regularWorkedMinutes) || 0) / 60) * hourlyRate;
  const supplementaryAmount = (supplementaryMinutes / 60) * hourlyRate * supplementaryMultiplier;
  const extraordinaryAmount = (extraordinaryMinutes / 60) * hourlyRate * extraordinaryMultiplier;
  const lateAmount = ((Number(day?.lateMinutes) || 0) / 60) * hourlyRate;
  const isDiscountedDay = draft.decision === "discount_day";
  const previewRegularAmount = isDiscountedDay ? 0 : regularAmount;
  const previewSupplementaryAmount = isDiscountedDay ? 0 : supplementaryAmount;
  const previewExtraordinaryAmount = isDiscountedDay ? 0 : extraordinaryAmount;
  const previewLateAmount = isDiscountedDay ? 0 : lateAmount;
  const total = draft.decision === "discount_day"
    ? 0
    : regularAmount + supplementaryAmount + extraordinaryAmount - lateAmount;

  return {
    supplementaryLabel: supplementaryMinutes ? formatMinutes(supplementaryMinutes) : "--",
    extraordinaryLabel: extraordinaryMinutes ? formatMinutes(extraordinaryMinutes) : "--",
    breakdown: [
      { label: "Laborales", valueLabel: moneyLabel(previewRegularAmount) },
      { label: "Suplementarias", valueLabel: moneyLabel(previewSupplementaryAmount) },
      { label: "Extraordinarias", valueLabel: moneyLabel(previewExtraordinaryAmount) },
      ...(previewLateAmount > 0 ? [{ label: "Atraso", valueLabel: `-${moneyLabel(previewLateAmount)}` }] : []),
      { label: "Sumatoria", value: total, valueLabel: moneyLabel(total), isTotal: true },
    ],
    totalLabel: moneyLabel(total),
    statusLabel: draft.decision === "full"
      ? "Vista previa: todo"
      : draft.decision === "planned"
        ? "Vista previa: plan"
        : draft.decision === "discount_day"
          ? "Vista previa: descontar dia"
          : draft.decision === "none"
            ? "Vista previa: no pagar"
            : "Vista previa: ajuste",
  };
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
  const [stableInitialFilters] = useState(() => ({
    month: initialFilters.month || currentMonthKey(),
    branchCode: initialFilters.branchCode || "",
    areaCode: initialFilters.areaCode || "",
    roleCode: initialFilters.roleCode || "",
  }));
  const initialFiltersRef = useRef(stableInitialFilters);
  const [month, setMonth] = useState(() => stableInitialFilters.month);
  const [row, setRow] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [actionDrafts, setActionDrafts] = useState({});
  const [savingDay, setSavingDay] = useState("");
  const [savingBulkAction, setSavingBulkAction] = useState("");
  const [pendingBulkDecision, setPendingBulkDecision] = useState("");
  const [selectedDayKey, setSelectedDayKey] = useState("");

  const filters = {
    ...stableInitialFilters,
    month,
  };
  const selectedDay = row?.days?.find((day) => day.dateKey === selectedDayKey) || null;
  const authorizableDays = row?.days?.filter((day) => hasAuthorizableTime(day) && !isIgnorableRestDay(day)) || [];
  const selectedDraft = selectedDay ? actionDrafts[selectedDay.dateKey] || {} : {};
  const selectedPreview = selectedDay ? buildDecisionPreview(selectedDay, selectedDraft, row?.summary || {}) : null;

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

      const nextRow = payload.rows?.[0] || null;
      setRow(nextRow);
      setActionDrafts(buildActionDrafts(nextRow?.days || []));
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

  function updateActionDraft(dateKey, field, value) {
    setActionDrafts((current) => ({
      ...current,
      [dateKey]: {
        ...(current[dateKey] || {}),
        [field]: value,
      },
    }));
  }

  function applyQuickAction(day, decision) {
    const plannedMinutes = plannedAuthorizationMinutes(day);
    setActionDrafts((current) => ({
      ...current,
      [day.dateKey]: {
        ...(current[day.dateKey] || {}),
        supplementary: decision === "full"
          ? minutesToHourInput(day.detectedSupplementaryMinutes || 0)
          : decision === "planned"
            ? minutesToHourInput(plannedMinutes.plannedSupplementaryMinutes)
            : "",
        extraordinary: decision === "full"
          ? minutesToHourInput(day.detectedExtraordinaryMinutes || 0)
          : decision === "planned"
            ? minutesToHourInput(plannedMinutes.plannedExtraordinaryMinutes)
            : "",
        decision,
      },
    }));
  }

  function openDayDecision(day) {
    if (!canOpenDayDecision(day)) return;
    setSelectedDayKey(day.dateKey);
  }

  async function saveDayAction(day) {
    const draft = actionDrafts[day.dateKey] || {};
    const decision = ["full", "planned", "none", "discount_day"].includes(draft.decision) ? draft.decision : "custom";

    try {
      setSavingDay(day.dateKey);
      setError("");

      const response = await fetch("/api/attendance/day-decisions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(authorizationPayloadForDay(employeeId, day, decision, draft)),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "No se pudo guardar la decisión.");
      }

      setSelectedDayKey("");
      await loadReport(month);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingDay("");
    }
  }

  async function saveBulkDecision(decision) {
    const daysToSave = authorizableDays;

    if (!daysToSave.length) return;

    try {
      setSavingBulkAction(decision);
      setError("");

      for (const day of daysToSave) {
        const response = await fetch("/api/attendance/day-decisions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(authorizationPayloadForDay(employeeId, day, decision, {
            note: decision === "full" ? "Autorización global: todo autorizado." : "Autorización global: ajustado al plan.",
          })),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo guardar la autorización global.");
        }
      }

      await loadReport(month);
      setPendingBulkDecision("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingBulkAction("");
    }
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
          <div className={styles.identityPanel}>
            <div className={styles.employeeIdentity}>
              <strong>{row.employee.fullName}</strong>
              <div className={styles.identityMeta}>
                <span>{row.employee.branchName}</span>
                <span>{row.employee.areaName}</span>
                <span>{row.employee.roleName}</span>
              </div>
            </div>

            <label className={styles.monthControl}>
              <span>Mes</span>
              <input type="month" value={month} onChange={(event) => handleMonthChange(event.target.value)} />
            </label>
          </div>

          <div className={styles.metricGrid}>
            <article>
              <span>Sueldo</span>
              <strong>{row.summary.salaryProjectedLabel}</strong>
              <small>Base {row.summary.salaryExpectedLabel}</small>
            </article>
            <article>
              <span>Laborales</span>
              <strong>{minutesBadge(row.summary.regularWorkedLabel)}</strong>
              <small>Plan. {minutesBadge(row.summary.plannedRegularLabel)}</small>
            </article>
            <article>
              <span>Suplementarias</span>
              <strong>{minutesBadge(row.summary.supplementaryLabel)}</strong>
              <small>Plan. {minutesBadge(row.summary.plannedSupplementaryLabel)}</small>
            </article>
            <article>
              <span>Extraordinarias</span>
              <strong>{minutesBadge(row.summary.extraordinaryLabel)}</strong>
              <small>Plan. {minutesBadge(row.summary.plannedExtraordinaryLabel)}</small>
            </article>
            <article>
              <span>Atraso total</span>
              <strong>{minutesBadge(row.summary.lateLabel)}</strong>
              <small>{row.summary.lateDays} días con atraso</small>
            </article>
            <article>
              <span>Novedades</span>
              <strong>{row.summary.issueDays} días</strong>
              <small>Revisar antes del cierre</small>
            </article>
          </div>

          <div className={styles.bulkActions}>
            <div>
              <strong>Autorización global</strong>
              <span>{authorizableDays.length} días con horas para revisar</span>
            </div>
            <div className="catalog-actions">
              <button
                type="button"
                className="catalog-button-ghost"
                onClick={() => setPendingBulkDecision("full")}
                disabled={!authorizableDays.length || Boolean(savingBulkAction)}
              >
                {savingBulkAction === "full" ? "Autorizando..." : "Autorizar todo"}
              </button>
              <button
                type="button"
                className="catalog-button-primary"
                onClick={() => setPendingBulkDecision("planned")}
                disabled={!authorizableDays.length || Boolean(savingBulkAction)}
              >
                {savingBulkAction === "planned" ? "Ajustando..." : "Ajustar todo al plan"}
              </button>
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
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {row.days.map((day) => (
                    <tr
                      key={day.dateKey}
                      className={dayRowClass(day)}
                      onClick={() => openDayDecision(day)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openDayDecision(day);
                        }
                      }}
                      tabIndex={canOpenDayDecision(day) ? 0 : undefined}
                      role={canOpenDayDecision(day) ? "button" : undefined}
                    >
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
                              </>
                            )}
                          </div>
                          <div className={styles.punchLine}>
                            {day.punches.length
                              ? day.punches.map((punch, index) => (
                                <span key={punch.id}>
                                  <small>{punchLabel(index, day.punchCount)} </small>
                                  {punch.time}
                                </span>
                              ))
                              : <span><small>Picadas </small>Sin registros</span>}
                            {day.actualLunchMinutes !== null ? (
                              <span className={lunchTotalClass(day)}>
                                <small>ALM TOTAL</small>
                                {day.actualLunchLabel}
                              </span>
                            ) : null}
                          </div>
                          {day.tags.length ? (
                            <div className={styles.issueTags}>
                              {day.tags.map((tag) => <span key={tag} className={issueTagClass(tag)}>{tag}</span>)}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        {isIgnorableRestDay(day) ? (
                          <strong>--</strong>
                        ) : day.dayType === "holiday" ? (
                          <>
                            <strong>{day.plannedRegularLabel}</strong>
                            <span>Feriado pagado</span>
                          </>
                        ) : day.dayType === "weekend_overtime" ? (
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
                            {day.workedMinutes > 0 ? (
                              <span>{day.dayType === "off_day" ? "Trabajo en descanso" : "Trabajo sin horario"}</span>
                            ) : null}
                          </>
                        )}
                      </td>
                      <td>
                        <strong>{isIgnorableRestDay(day) ? "--" : day.dayType === "holiday" && day.punchCount === 0 ? day.regularWorkedLabel : day.workedLabel}</strong>
                        {isIgnorableRestDay(day) ? null : (
                          <span>{day.dayType === "holiday" && day.punchCount === 0 ? "Feriado sin picadas" : `${day.punchCount} picadas`}</span>
                        )}
                      </td>
                      <td>
                        {hasPlannedStart(day) ? (
                          <>
                            <strong>{day.lateMinutes ? `${day.lateMinutes}m` : "--"}</strong>
                            <span>Gracia {day.graceMinutes}m</span>
                          </>
                        ) : (
                          <strong>--</strong>
                        )}
                      </td>
                      <td>
                        {isIgnorableRestDay(day) ? (
                          <strong>--</strong>
                        ) : (
                          <div className={styles.extraList}>
                            <span>Sup. {day.additionalSupplementaryLabel}</span>
                            <span>Ext. {day.extraordinaryLabel}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        {isIgnorableRestDay(day) ? (
                          <strong>--</strong>
                        ) : (
                          <div className={styles.valueCell}>
                            <strong>{day.pay?.totalLabel || "$0.00"}</strong>
                            {hasAuthorizableTime(day) || day.authorization?.isSaved ? (
                              <span className={valueHintClass(day)}>{day.authorization?.statusLabel || "Según plan"}</span>
                            ) : null}
                            {day.pay?.items?.length ? (
                              <div className={styles.valueBreakdown}>
                                {day.pay.items.map((item) => (
                                  <span key={`${item.label}-${item.minutes}-${item.amount}`}>
                                    <small>{item.label}</small>
                                    <b className={item.isDeduction ? styles.deductionValue : undefined}>
                                      {item.amountLabel}
                                    </b>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span>Sin valores</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <CatalogDrawer
            isOpen={Boolean(selectedDay)}
            title={selectedDay ? `${selectedDay.dayLabel} ${selectedDay.dateLabel}` : "Decisión del día"}
            eyebrow="Autorización de horas"
            onClose={() => setSelectedDayKey("")}
          >
            {selectedDay ? (
              <div className={styles.decisionModal}>
                <div className={styles.decisionSummary}>
                  <article>
                    <span>Trabajado</span>
                    <strong>{selectedDay.workedLabel}</strong>
                    <small>{selectedDay.punchCount} picadas</small>
                  </article>
                  <article>
                    <span>Detectado</span>
                    <strong>Sup. {selectedDay.detectedSupplementaryLabel}</strong>
                    <small>Ext. {selectedDay.detectedExtraordinaryLabel}</small>
                  </article>
                  <article>
                    <span>Vista previa</span>
                    <strong>Sup. {selectedPreview?.supplementaryLabel || "--"}</strong>
                    <small>Ext. {selectedPreview?.extraordinaryLabel || "--"}</small>
                  </article>
                  <article>
                    <span>Valor previsto</span>
                    <strong>{selectedPreview?.totalLabel || "$0.00"}</strong>
                    <small>{selectedPreview?.statusLabel || "Vista previa"}</small>
                  </article>
                </div>

                <div className={styles.previewBreakdown}>
                  {(selectedPreview?.breakdown || []).map((item) => (
                    <div key={item.label} className={item.isTotal ? styles.previewTotal : undefined}>
                      <span>{item.label}</span>
                      <strong>{item.valueLabel}</strong>
                    </div>
                  ))}
                </div>

                <div className={styles.modalPunches}>
                  {selectedDay.punches.map((punch, index) => (
                    <span key={punch.id}>
                      <small>{punchLabel(index, selectedDay.punchCount)}</small>
                      {punch.time}
                    </span>
                  ))}
                </div>

                <div className={styles.modalForm}>
                  <label>
                    <span>Suplementarias autorizadas (h)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Ej. 1.30"
                      value={actionDrafts[selectedDay.dateKey]?.supplementary ?? ""}
                      onChange={(event) => {
                        updateActionDraft(selectedDay.dateKey, "supplementary", event.target.value);
                        updateActionDraft(selectedDay.dateKey, "decision", "custom");
                      }}
                    />
                  </label>
                  <label>
                    <span>Extraordinarias autorizadas (h)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Ej. 1.30"
                      value={actionDrafts[selectedDay.dateKey]?.extraordinary ?? ""}
                      onChange={(event) => {
                        updateActionDraft(selectedDay.dateKey, "extraordinary", event.target.value);
                        updateActionDraft(selectedDay.dateKey, "decision", "custom");
                      }}
                    />
                  </label>
                  <label className={styles.modalNote}>
                    <span>Motivo</span>
                    <textarea
                      rows={3}
                      placeholder="Ej. Se autorizaron solo 4 horas por cierre de inventario."
                      value={actionDrafts[selectedDay.dateKey]?.note || ""}
                      onChange={(event) => updateActionDraft(selectedDay.dateKey, "note", event.target.value)}
                    />
                  </label>
                </div>

                <div className="catalog-actions-block catalog-actions-separated">
                  <span className="catalog-actions-label">Acciones rápidas</span>
                  <div className="catalog-actions">
                    <button type="button" className="catalog-button-ghost" onClick={() => applyQuickAction(selectedDay, "full")} disabled={savingDay === selectedDay.dateKey}>Autorizar todo</button>
                    <button type="button" className="catalog-button-ghost" onClick={() => applyQuickAction(selectedDay, "planned")} disabled={savingDay === selectedDay.dateKey}>Ajustar al plan</button>
                    <button type="button" className="catalog-button-danger" onClick={() => applyQuickAction(selectedDay, "discount_day")} disabled={savingDay === selectedDay.dateKey}>Descontar dia</button>
                  </div>
                </div>

                <div className="catalog-actions catalog-actions-end catalog-actions-separated">
                  <button type="button" className="catalog-button-primary" onClick={() => saveDayAction(selectedDay)} disabled={savingDay === selectedDay.dateKey}>
                    {savingDay === selectedDay.dateKey ? "Guardando..." : "Guardar ajuste"}
                  </button>
                </div>
              </div>
            ) : null}
          </CatalogDrawer>

          <ConfirmDialog
            isOpen={Boolean(pendingBulkDecision)}
            title={pendingBulkDecision === "full" ? "Autorizar todo" : "Ajustar todo al plan"}
            message={`Se guardará una decisión para ${authorizableDays.length} días con horas autorizables. Cada cambio quedará registrado en auditoría.`}
            confirmLabel={pendingBulkDecision === "full" ? "Autorizar todo" : "Ajustar al plan"}
            cancelLabel="Cancelar"
            tone="default"
            isPending={Boolean(savingBulkAction)}
            confirmDisabled={!authorizableDays.length}
            onCancel={() => {
              if (!savingBulkAction) setPendingBulkDecision("");
            }}
            onConfirm={() => saveBulkDecision(pendingBulkDecision)}
          >
            <div className={styles.confirmDetails}>
              <span>Empleado</span>
              <strong>{row.employee.fullName}</strong>
              <span>Mes</span>
              <strong>{month}</strong>
              <span>Acción</span>
              <strong>{pendingBulkDecision === "full" ? "Autorizar todas las horas detectadas" : "Respetar solo las horas planificadas"}</strong>
            </div>
          </ConfirmDialog>
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
