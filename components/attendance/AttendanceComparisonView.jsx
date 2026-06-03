"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { formatEcuadorMonthKey } from "@/lib/datetime/ecuador";
import { planningModulePath } from "@/lib/modules/planning/routes";
import styles from "./AttendanceComparisonView.module.scss";

function currentMonthKey() {
  return formatEcuadorMonthKey();
}

function readInitialFilters() {
  if (typeof window === "undefined") {
    return {
      month: currentMonthKey(),
      branchCode: "",
      areaCode: "",
      roleCode: "",
      employeeId: "",
      onlyIssues: false,
    };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    month: params.get("month") || currentMonthKey(),
    branchCode: params.get("branchCode") || "",
    areaCode: params.get("areaCode") || "",
    roleCode: params.get("roleCode") || "",
    employeeId: params.get("employeeId") || "",
    onlyIssues: params.get("onlyIssues") === "1",
  };
}

function syncUrl(filters) {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams();
  params.set("month", filters.month);

  if (filters.branchCode) params.set("branchCode", filters.branchCode);
  if (filters.areaCode) params.set("areaCode", filters.areaCode);
  if (filters.roleCode) params.set("roleCode", filters.roleCode);
  if (filters.employeeId) params.set("employeeId", filters.employeeId);
  if (filters.onlyIssues) params.set("onlyIssues", "1");

  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

function minutesBadge(value) {
  return value && value !== "0m" ? value : "--";
}

function minutes(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isExtraordinaryDay(day) {
  return ["holiday", "weekend_overtime", "off_day"].includes(day?.dayType);
}

function detectedLateIssueMinutes(day) {
  if (isExtraordinaryDay(day)) return 0;

  return Math.max(
    0,
    (Number(day?.lateMinutes) || 0) + (Number(day?.lunchOverageRemainderMinutes) || 0),
    Number(day?.authorization?.detectedLateMinutes) || 0,
  );
}

function currentAuthorizedSupplementaryMinutes(day) {
  return minutes(day?.authorization?.authorizedSupplementaryMinutes ?? day?.supplementaryMinutes);
}

function currentAuthorizedExtraordinaryMinutes(day) {
  return minutes(day?.authorization?.authorizedExtraordinaryMinutes ?? day?.extraordinaryMinutes);
}

function detectedSupplementaryMinutes(day) {
  return minutes(day?.detectedSupplementaryMinutes);
}

function detectedExtraordinaryMinutes(day) {
  return minutes(day?.detectedExtraordinaryMinutes);
}

function buildDayDecisionPayload(employeeId, day, type) {
  const detectedSupplementary = detectedSupplementaryMinutes(day);
  const detectedExtraordinary = detectedExtraordinaryMinutes(day);
  const authorizeSupplementary = ["all", "supplementary"].includes(type);
  const authorizeExtraordinary = ["all", "extraordinary"].includes(type);

  return {
    employeeId,
    dateKey: day.dateKey,
    decision: "custom",
    detectedSupplementaryMinutes: detectedSupplementary,
    detectedExtraordinaryMinutes: detectedExtraordinary,
    authorizedSupplementaryMinutes: authorizeSupplementary
      ? detectedSupplementary
      : currentAuthorizedSupplementaryMinutes(day),
    authorizedExtraordinaryMinutes: authorizeExtraordinary
      ? detectedExtraordinary
      : currentAuthorizedExtraordinaryMinutes(day),
    detectedLateMinutes: detectedLateIssueMinutes(day),
    adjustedLateMinutes: minutes(day?.authorization?.adjustedLateMinutes ?? detectedLateIssueMinutes(day)),
    detectedEarlyLeaveMinutes: minutes(day?.authorization?.detectedEarlyLeaveMinutes ?? day?.earlyLeaveMinutes),
    adjustedEarlyLeaveMinutes: minutes(day?.authorization?.adjustedEarlyLeaveMinutes ?? day?.earlyLeaveMinutes),
    note: type === "all"
      ? "Autorización desde comparativo: todas las horas detectadas."
      : type === "supplementary"
        ? "Autorización desde comparativo: suplementarias detectadas."
        : "Autorización desde comparativo: extraordinarias detectadas.",
  };
}

function authorizationTypeLabel(type) {
  const labels = {
    all: "Autorizar todo",
    supplementary: "Autorizar suplementarias",
    extraordinary: "Autorizar extraordinarias",
  };

  return labels[type] || "Autorizar";
}

function authorizableDaysForRow(row, type) {
  return (row.days || []).filter((day) => {
    if (day.authorization?.isSaved) return false;
    if (type === "supplementary") {
      return detectedSupplementaryMinutes(day) > currentAuthorizedSupplementaryMinutes(day);
    }
    if (type === "extraordinary") {
      return detectedExtraordinaryMinutes(day) > currentAuthorizedExtraordinaryMinutes(day);
    }

    return (
      detectedSupplementaryMinutes(day) > currentAuthorizedSupplementaryMinutes(day) ||
      detectedExtraordinaryMinutes(day) > currentAuthorizedExtraordinaryMinutes(day)
    );
  });
}

function MetricColumn({ label, value, tone = "neutral" }) {
  return (
    <span className={`${styles.metricItem} ${styles[`metricItem_${tone}`]}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

export default function AttendanceComparisonView() {
  const router = useRouter();
  const [initialFilters] = useState(() => readInitialFilters());
  const initialFiltersRef = useRef(initialFilters);
  const [filters, setFilters] = useState(() => initialFilters);
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [rows, setRows] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);
  const [isLoadingComparison, setIsLoadingComparison] = useState(true);
  const [isResettingDecisions, setIsResettingDecisions] = useState(false);
  const [pendingAuthorization, setPendingAuthorization] = useState(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [error, setError] = useState("");
  const isLoading = isLoadingCatalogs || isLoadingComparison || isResettingDecisions || isAuthorizing;

  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        if (employee.isActive === false) return false;
        if (filters.branchCode && employee.branchCode !== filters.branchCode) return false;
        if (filters.areaCode && employee.areaCode !== filters.areaCode) return false;
        if (filters.roleCode && employee.roleCode !== filters.roleCode) return false;
        return true;
      }),
    [employees, filters.areaCode, filters.branchCode, filters.roleCode],
  );

  const areaOptions = useMemo(() => {
    const options = new Map();

    employees.forEach((employee) => {
      if (employee.isActive === false) return;
      if (filters.branchCode && employee.branchCode !== filters.branchCode) return;
      if (employee.areaCode) options.set(employee.areaCode, employee.areaName || employee.areaCode);
    });

    return [...options.entries()].sort((left, right) => left[1].localeCompare(right[1], "es"));
  }, [employees, filters.branchCode]);

  const roleOptions = useMemo(() => {
    const options = new Map();

    employees.forEach((employee) => {
      if (employee.isActive === false) return;
      if (filters.branchCode && employee.branchCode !== filters.branchCode) return;
      if (filters.areaCode && employee.areaCode !== filters.areaCode) return;
      if (employee.roleCode) options.set(employee.roleCode, employee.roleName || employee.roleCode);
    });

    return [...options.entries()].sort((left, right) => left[1].localeCompare(right[1], "es"));
  }, [employees, filters.areaCode, filters.branchCode]);

  const visibleRows = useMemo(
    () => {
      const search = normalizeSearch(employeeSearch);

      return rows.filter((row) => {
        if (filters.onlyIssues && !((Number(row.summary?.issueDays) || 0) > 0)) return false;
        if (filters.employeeId || !search) return true;

        return normalizeSearch(row.employee?.fullName).includes(search);
      });
    },
    [employeeSearch, filters.employeeId, filters.onlyIssues, rows],
  );
  const hasActiveResultFilter = Boolean(
    filters.branchCode ||
    filters.areaCode ||
    filters.roleCode ||
    filters.employeeId ||
    filters.onlyIssues ||
    normalizeSearch(employeeSearch),
  );
  const groupedRows = useMemo(() => {
    const groups = new Map();

    visibleRows.forEach((row) => {
      const key = row.employee?.areaCode || "SIN_AREA";
      const label = row.employee?.areaName || "Sin área";

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label,
          rows: [],
        });
      }

      groups.get(key).rows.push(row);
    });

    return [...groups.values()].sort((left, right) => left.label.localeCompare(right.label, "es"));
  }, [visibleRows]);
  const globalAuthorizationCounts = useMemo(() => ({
    all: visibleRows.reduce((total, row) => total + authorizableDaysForRow(row, "all").length, 0),
    supplementary: visibleRows.reduce((total, row) => total + authorizableDaysForRow(row, "supplementary").length, 0),
    extraordinary: visibleRows.reduce((total, row) => total + authorizableDaysForRow(row, "extraordinary").length, 0),
  }), [visibleRows]);

  const employeeDatalistId = "attendance-comparison-employees";
  const selectedEmployeeName = useMemo(
    () => employees.find((employee) => employee.id === filters.employeeId)?.fullName || "",
    [employees, filters.employeeId],
  );

  function updateFilters(nextValues) {
    const nextFilters = {
      ...filters,
      ...nextValues,
    };

    setFilters(nextFilters);
    syncUrl(nextFilters);

    if (!Object.prototype.hasOwnProperty.call(nextValues, "onlyIssues")) {
      loadComparison(nextFilters);
    }
  }

  async function loadCatalogs() {
    try {
      setIsLoadingCatalogs(true);
      const [employeesResponse, branchesResponse] = await Promise.all([
        fetch("/api/employees"),
        fetch("/api/branches"),
      ]);
      const [employeesPayload, branchesPayload] = await Promise.all([
        employeesResponse.json(),
        branchesResponse.json(),
      ]);

      if (!employeesResponse.ok) {
        throw new Error(employeesPayload.error || "No se pudieron cargar los empleados.");
      }

      if (!branchesResponse.ok) {
        throw new Error(branchesPayload.error || "No se pudieron cargar las sucursales.");
      }

      setEmployees(employeesPayload.employees || []);
      setBranches(branchesPayload.branches || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoadingCatalogs(false);
    }
  }

  async function loadComparison(nextFilters = filters) {
    try {
      setIsLoadingComparison(true);
      setError("");

      const params = new URLSearchParams();
      params.set("month", nextFilters.month);

      if (nextFilters.branchCode) params.set("branchCode", nextFilters.branchCode);
      if (nextFilters.areaCode) params.set("areaCode", nextFilters.areaCode);
      if (nextFilters.roleCode) params.set("roleCode", nextFilters.roleCode);
      if (nextFilters.employeeId) params.set("employeeId", nextFilters.employeeId);

      const response = await fetch(`/api/attendance/comparison?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "No se pudo comparar la asistencia.");
      }

      setRows(payload.rows || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoadingComparison(false);
    }
  }

  function handleFilterChange(key, value) {
    const nextValues = { [key]: value };

    if (key === "branchCode") {
      nextValues.areaCode = "";
      nextValues.roleCode = "";
      nextValues.employeeId = "";
      setEmployeeSearch("");
    }

    if (key === "areaCode") {
      nextValues.roleCode = "";
      nextValues.employeeId = "";
      setEmployeeSearch("");
    }

    if (key === "roleCode") {
      nextValues.employeeId = "";
      setEmployeeSearch("");
    }

    updateFilters(nextValues);
  }

  function handleEmployeeSearchChange(value) {
    setEmployeeSearch(value);

    const search = normalizeSearch(value);
    const matchedEmployee = search
      ? filteredEmployees.find((employee) => normalizeSearch(employee.fullName) === search)
      : null;
    const nextEmployeeId = matchedEmployee?.id || "";

    if (nextEmployeeId !== filters.employeeId) {
      updateFilters({ employeeId: nextEmployeeId });
    }
  }

  function buildEmployeeReportHref(employeeId) {
    const params = new URLSearchParams();
    params.set("month", filters.month);

    if (filters.branchCode) params.set("branchCode", filters.branchCode);
    if (filters.areaCode) params.set("areaCode", filters.areaCode);
    if (filters.roleCode) params.set("roleCode", filters.roleCode);

    return `${planningModulePath(`/attendance/comparison/${employeeId}`)}?${params.toString()}`;
  }

  async function resetMonthDecisions() {
    try {
      setIsResettingDecisions(true);
      setError("");

      const response = await fetch("/api/attendance/day-decisions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scope: "month",
          month: filters.month,
          branchCode: filters.branchCode,
          areaCode: filters.areaCode,
          roleCode: filters.roleCode,
          employeeId: filters.employeeId,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "No se pudieron reiniciar las decisiones.");
      }

      setShowResetConfirm(false);
      await loadComparison(filters);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsResettingDecisions(false);
    }
  }

  function openAuthorizationConfirm(type, row = null) {
    const days = row
      ? authorizableDaysForRow(row, type)
      : visibleRows.flatMap((visibleRow) => authorizableDaysForRow(visibleRow, type).map((day) => ({
        ...day,
        employeeId: visibleRow.employee.id,
      })));

    if (!days.length) return;

    setPendingAuthorization({
      type,
      scope: row ? "employee" : "global",
      row,
      daysCount: days.length,
    });
  }

  async function applyPendingAuthorization() {
    if (!pendingAuthorization) return;

    const targetRows = pendingAuthorization.row ? [pendingAuthorization.row] : visibleRows;
    const payloads = targetRows.flatMap((row) =>
      authorizableDaysForRow(row, pendingAuthorization.type).map((day) =>
        buildDayDecisionPayload(row.employee.id, day, pendingAuthorization.type),
      ),
    );

    if (!payloads.length) {
      setPendingAuthorization(null);
      return;
    }

    try {
      setIsAuthorizing(true);
      setError("");

      for (const payload of payloads) {
        const response = await fetch("/api/attendance/day-decisions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "No se pudo guardar la autorización.");
        }
      }

      setPendingAuthorization(null);
      await loadComparison(filters);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsAuthorizing(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadCatalogs();
      loadComparison(initialFiltersRef.current);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  function renderComparisonRows(rowsToRender) {
    return rowsToRender.map((row) => {
      const rowCounts = {
        all: authorizableDaysForRow(row, "all").length,
        supplementary: authorizableDaysForRow(row, "supplementary").length,
        extraordinary: authorizableDaysForRow(row, "extraordinary").length,
      };

      return (
        <tr
          key={row.employee.id}
          className={styles.clickableRow}
          role="button"
          tabIndex={0}
          onClick={() => router.push(buildEmployeeReportHref(row.employee.id))}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              router.push(buildEmployeeReportHref(row.employee.id));
            }
          }}
        >
          <td>
            <strong>{row.employee.fullName}</strong>
            <span>{row.employee.branchName} · {row.employee.areaName} · {row.employee.roleName}</span>
          </td>
          <td>
            <div className={styles.metricColumn}>
              <MetricColumn label="Picadas" value={row.summary.missingPunchDays || 0} tone="warning" />
              <MetricColumn label="Atrasos" value={row.summary.lateDays || 0} tone="danger" />
            </div>
          </td>
          <td>
            <div className={styles.metricColumn}>
              <MetricColumn label="Plan." value={minutesBadge(row.summary.plannedRegularLabel)} tone="planned" />
              <MetricColumn label="Real" value={minutesBadge(row.summary.regularWorkedLabel)} tone="worked" />
            </div>
          </td>
          <td>
            <div className={styles.metricColumn}>
              <MetricColumn label="Plan." value={minutesBadge(row.summary.plannedSupplementaryLabel)} tone="planned" />
              <MetricColumn label="Real" value={minutesBadge(row.summary.detectedSupplementaryLabel)} tone="info" />
              <MetricColumn label="Aprob." value={minutesBadge(row.summary.supplementaryLabel)} tone="worked" />
            </div>
          </td>
          <td>
            <div className={styles.metricColumn}>
              <MetricColumn label="Plan." value={minutesBadge(row.summary.plannedExtraordinaryLabel)} tone="planned" />
              <MetricColumn label="Real" value={minutesBadge(row.summary.detectedExtraordinaryLabel)} tone="accent" />
              <MetricColumn label="Aprob." value={minutesBadge(row.summary.extraordinaryLabel)} tone="worked" />
            </div>
          </td>
          <td>
            <div className={styles.metricColumn}>
              <MetricColumn label="Plan." value={row.summary.salaryPlannedLabel} tone="planned" />
              <MetricColumn label="Real" value={row.summary.salaryRealLabel} tone="accent" />
              <MetricColumn label="Aprob." value={row.summary.salaryProjectedLabel} tone="worked" />
            </div>
          </td>
          <td>
            <div
              className={styles.rowActions}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <button type="button" onClick={() => openAuthorizationConfirm("supplementary", row)} disabled={isLoading || !rowCounts.supplementary}>
                Sup.
              </button>
              <button type="button" onClick={() => openAuthorizationConfirm("extraordinary", row)} disabled={isLoading || !rowCounts.extraordinary}>
                Ext.
              </button>
              <button type="button" onClick={() => openAuthorizationConfirm("all", row)} disabled={isLoading || !rowCounts.all}>
                Todo
              </button>
            </div>
          </td>
        </tr>
      );
    });
  }

  function renderComparisonTable(rowsToRender, emptyText) {
    return (
      <div className={`${styles.tableShell} ${isLoadingComparison ? styles.tableLoading : ""}`}>
        {isLoadingComparison ? <span className={styles.loadingRail} aria-hidden="true" /> : null}
        <div className={styles.tableScroller}>
          <table>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Novedades</th>
                <th>Horas laborables</th>
                <th>Suplementarias</th>
                <th>Extraordinarias</th>
                <th>Sueldo</th>
                <th>Autorizar</th>
              </tr>
            </thead>
            <tbody>
              {renderComparisonRows(rowsToRender)}
              {!rowsToRender.length ? (
                <tr>
                  <td colSpan={7} className={styles.emptyCell}>
                    {emptyText}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.filterGrid}>
          <label>
            <span>Mes</span>
            <input
              type="month"
              value={filters.month}
              onChange={(event) => handleFilterChange("month", event.target.value)}
            />
          </label>

          <label>
            <span>Sucursal</span>
            <select value={filters.branchCode} onChange={(event) => handleFilterChange("branchCode", event.target.value)}>
              <option value="">Todas</option>
              {branches.map((branch) => (
                <option key={branch.id || branch.code} value={branch.code}>
                  {branch.name || branch.code}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Área</span>
            <select value={filters.areaCode} onChange={(event) => handleFilterChange("areaCode", event.target.value)}>
              <option value="">Todas</option>
              {areaOptions.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Rol</span>
            <select value={filters.roleCode} onChange={(event) => handleFilterChange("roleCode", event.target.value)}>
              <option value="">Todos</option>
              {roleOptions.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.employeeAutocomplete}>
            <span>Empleado</span>
            <input
              type="search"
              value={employeeSearch || selectedEmployeeName}
              list={employeeDatalistId}
              placeholder="Buscar empleado..."
              onChange={(event) => handleEmployeeSearchChange(event.target.value)}
            />
            <datalist id={employeeDatalistId}>
              {filteredEmployees.map((employee) => (
                <option key={employee.id} value={employee.fullName} />
              ))}
            </datalist>
          </label>

          <label className={styles.toggleFilter}>
            <span>Novedades</span>
            <button
              type="button"
              className={`${styles.toggleButton} ${filters.onlyIssues ? styles.toggleButtonActive : ""}`}
              onClick={() => updateFilters({ onlyIssues: !filters.onlyIssues })}
              aria-pressed={filters.onlyIssues}
            >
              Solo con novedades
            </button>
          </label>
        </div>

        <div className={styles.authorizationToolbar}>
          <div>
            <strong>Autorización global</strong>
            <span>Se aplica a los empleados visibles y omite días con decisión guardada.</span>
          </div>
          <div className={styles.authorizationActions}>
            <button type="button" className={styles.primaryButton} onClick={() => openAuthorizationConfirm("all")} disabled={isLoading || !globalAuthorizationCounts.all}>
              {isAuthorizing ? <RefreshCw size={16} /> : <CheckCircle2 size={16} />}
              Todo
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => openAuthorizationConfirm("supplementary")} disabled={isLoading || !globalAuthorizationCounts.supplementary}>
              Suplementarias
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => openAuthorizationConfirm("extraordinary")} disabled={isLoading || !globalAuthorizationCounts.extraordinary}>
              Extraordinarias
            </button>
            <button type="button" className={styles.dangerButton} onClick={() => setShowResetConfirm(true)} disabled={isLoading}>
              {isResettingDecisions ? <RefreshCw size={16} /> : null}
              Reiniciar
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className={styles.errorBox}>
          <AlertTriangle size={17} />
          {error}
        </div>
      ) : null}

      {isLoadingComparison && !rows.length ? (
        <div className={styles.loadingScene} aria-hidden="true">
          <div className={styles.skeletonTable}>
            {Array.from({ length: 8 }).map((_, index) => <span key={index} />)}
          </div>
        </div>
      ) : hasActiveResultFilter ? (
        renderComparisonTable(
          visibleRows,
          filters.onlyIssues
            ? "No hay empleados con novedades para los filtros seleccionados."
            : "No hay empleados para los filtros seleccionados.",
        )
      ) : (
        <div className={styles.areaGroups}>
          {groupedRows.map((group) => (
            <section key={group.key} className={styles.areaGroup}>
              <div className={styles.areaHeader}>
                <strong>{group.label}</strong>
                <span>{group.rows.length} empleados</span>
              </div>
              {renderComparisonTable(group.rows, "No hay empleados en esta área.")}
            </section>
          ))}
          {!groupedRows.length ? renderComparisonTable([], "No hay empleados para el mes seleccionado.") : null}
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(pendingAuthorization)}
        title={authorizationTypeLabel(pendingAuthorization?.type)}
        message={pendingAuthorization?.scope === "employee"
          ? `Se guardará esta autorización para ${pendingAuthorization.daysCount} días pendientes de ${pendingAuthorization.row?.employee?.fullName || "este empleado"}.`
          : `Se guardará esta autorización para ${pendingAuthorization?.daysCount || 0} días pendientes de los empleados visibles.`}
        confirmLabel={authorizationTypeLabel(pendingAuthorization?.type)}
        cancelLabel="Cancelar"
        tone="default"
        isPending={isAuthorizing}
        confirmDisabled={!pendingAuthorization?.daysCount}
        onCancel={() => {
          if (!isAuthorizing) setPendingAuthorization(null);
        }}
        onConfirm={applyPendingAuthorization}
      >
        <div className={styles.confirmSummary}>
          <span>Alcance</span>
          <strong>{pendingAuthorization?.scope === "employee" ? "Empleado" : "Global visible"}</strong>
          <span>Días</span>
          <strong>{pendingAuthorization?.daysCount || 0}</strong>
          <span>Acción</span>
          <strong>{authorizationTypeLabel(pendingAuthorization?.type)}</strong>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Reiniciar decisiones"
        message="Se eliminarán todas las decisiones guardadas del mes para los filtros actuales. Los avisos y cálculos volverán al estado automático."
        confirmLabel="Reiniciar decisiones"
        cancelLabel="Cancelar"
        tone="danger"
        isPending={isResettingDecisions}
        onCancel={() => {
          if (!isResettingDecisions) setShowResetConfirm(false);
        }}
        onConfirm={resetMonthDecisions}
      />
    </section>
  );
}
