"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";

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

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function MetricColumn({ label, value, tone = "neutral" }) {
  return (
    <span className={`${styles.metricItem} ${styles[`metricItem_${tone}`]}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function plannedPunchDays(summary = {}) {
  return Number(summary.plannedDaysWithPunches ?? summary.daysWithPunches) || 0;
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
  const [error, setError] = useState("");
  const isLoading = isLoadingCatalogs || isLoadingComparison;

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
        if (filters.onlyIssues && !((Number(row.summary?.issueDays) || 0) > 0 || !row.hasSchedule)) return false;
        if (filters.employeeId || !search) return true;

        return normalizeSearch(row.employee?.fullName).includes(search);
      });
    },
    [employeeSearch, filters.employeeId, filters.onlyIssues, rows],
  );

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

  function handleSearch() {
    const search = normalizeSearch(employeeSearch);
    const matchedEmployee = search
      ? filteredEmployees.find((employee) => normalizeSearch(employee.fullName) === search)
      : null;
    const nextFilters = matchedEmployee
      ? { ...filters, employeeId: matchedEmployee.id }
      : filters;

    if (matchedEmployee && filters.employeeId !== matchedEmployee.id) {
      setFilters(nextFilters);
    }

    syncUrl(nextFilters);
    loadComparison(nextFilters);
  }

  function handleEmployeeSearchChange(value) {
    setEmployeeSearch(value);

    const search = normalizeSearch(value);
    const matchedEmployee = search
      ? filteredEmployees.find((employee) => normalizeSearch(employee.fullName) === search)
      : null;

    updateFilters({ employeeId: matchedEmployee?.id || "" });
  }

  function buildEmployeeReportHref(employeeId) {
    const params = new URLSearchParams();
    params.set("month", filters.month);

    if (filters.branchCode) params.set("branchCode", filters.branchCode);
    if (filters.areaCode) params.set("areaCode", filters.areaCode);
    if (filters.roleCode) params.set("roleCode", filters.roleCode);

    return `${planningModulePath(`/attendance/comparison/${employeeId}`)}?${params.toString()}`;
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

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
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

        <button type="button" className={styles.primaryButton} onClick={handleSearch} disabled={isLoading}>
          {isLoading ? <RefreshCw size={16} /> : <Search size={16} />}
          Consultar
        </button>
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
      ) : (
        <>
          <div className={`${styles.tableShell} ${isLoadingComparison ? styles.tableLoading : ""}`}>
            {isLoadingComparison ? <span className={styles.loadingRail} aria-hidden="true" /> : null}
            <div className={styles.tableScroller}>
              <table>
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Planificados</th>
                    <th>Novedades</th>
                    <th>Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
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
                        {row.hasSchedule ? (
                          <div className={styles.metricColumn}>
                            <MetricColumn label="Días" value={row.summary.plannedDays} tone="planned" />
                            <MetricColumn label="Con picadas" value={plannedPunchDays(row.summary)} tone="worked" />
                            <MetricColumn
                              label="Sin picadas"
                              value={Math.max(0, row.summary.plannedDays - plannedPunchDays(row.summary))}
                              tone="muted"
                            />
                          </div>
                        ) : (
                          <span className={styles.issuePill}>Sin horario</span>
                        )}
                      </td>
                      <td>
                        <div className={styles.metricColumn}>
                          <MetricColumn
                            label="Novedades"
                            value={row.summary.issueDays || 0}
                            tone={(row.summary.issueDays || 0) > 0 || !row.hasSchedule ? "danger" : "muted"}
                          />
                          <MetricColumn label="Incompletos" value={row.summary.missingPunchDays} tone="warning" />
                          <MetricColumn label="Sin planificar" value={row.summary.unplannedWorkDays} tone="accent" />
                          <MetricColumn label="Atrasos" value={row.summary.lateDays} tone="danger" />
                        </div>
                      </td>
                      <td>
                        <div className={styles.metricColumn}>
                          <MetricColumn label="Normal" value={minutesBadge(row.summary.regularWorkedLabel)} tone="worked" />
                          <MetricColumn label="Sup." value={minutesBadge(row.summary.supplementaryLabel)} tone="info" />
                          <MetricColumn label="Extra" value={minutesBadge(row.summary.extraordinaryLabel)} tone="accent" />
                          <MetricColumn label="Atrasos" value={minutesBadge(row.summary.lateLabel)} tone="danger" />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!visibleRows.length ? (
                    <tr>
                      <td colSpan={4} className={styles.emptyCell}>
                        {filters.onlyIssues ? "No hay empleados con novedades para los filtros seleccionados." : "No hay empleados para los filtros seleccionados."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
