"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, RefreshCw, Save } from "lucide-react";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { formatEcuadorMonthKey } from "@/lib/datetime/ecuador";
import styles from "./MonthlyClosureView.module.scss";

function currentMonthKey() {
  return formatEcuadorMonthKey();
}

function readInitialState() {
  if (typeof window === "undefined") {
    return {
      month: currentMonthKey(),
      mode: "saved",
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    month: params.get("month") || currentMonthKey(),
    mode: params.get("mode") === "live" ? "live" : "saved",
    closureId: params.get("closureId") || "",
  };
}

function syncState(month, mode = "saved", closureId = "") {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams();
  params.set("month", month);
  if (mode === "live") params.set("mode", "live");
  if (mode !== "live" && closureId) params.set("closureId", closureId);
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
}

function metricValue(value) {
  return value && value !== "0m" ? value : "0h00m";
}

function laborableValue(row) {
  return `${metricValue(row.regularWorkedLabel)} / ${metricValue(row.regularTargetLabel)}`;
}

export default function MonthlyClosureView() {
  const [initialState] = useState(() => readInitialState());
  const initialStateRef = useRef(initialState);
  const [month, setMonth] = useState(() => initialState.month);
  const [mode, setMode] = useState(() => initialState.mode);
  const [payload, setPayload] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [exportMode, setExportMode] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedClosureId, setSelectedClosureId] = useState(() => initialState.closureId || "");
  const [error, setError] = useState("");

  const isLiveMode = mode === "live";
  const data = isLiveMode ? payload?.preview : (payload?.closure || payload?.preview) || null;
  const isClosed = Boolean(payload?.isClosed);
  const rows = (data?.rows || []).slice().sort((left, right) =>
    String(left.employeeName || "").localeCompare(String(right.employeeName || ""), "es"),
  );
  const closures = payload?.closures || [];
  const selectedClosureValue = selectedClosureId || payload?.closure?.id || "";
  const isUpdatingClosure = isSaving || (isLoading && Boolean(payload));
  const totals = data?.totals || {};

  async function loadClosure(nextMonth = month, nextMode = mode, nextClosureId = selectedClosureId) {
    try {
      setIsLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.set("month", nextMonth);
      if (nextMode === "live") params.set("mode", "live");
      if (nextMode !== "live" && nextClosureId) params.set("closureId", nextClosureId);

      const response = await fetch(`/api/attendance/monthly-closure?${params.toString()}`);
      const nextPayload = await response.json();

      if (!response.ok) {
        throw new Error(nextPayload.error || "No se pudo cargar el cierre mensual.");
      }

      setPayload(nextPayload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleMonthChange(value) {
    setMonth(value);
    setMode("saved");
    setSelectedClosureId("");
    syncState(value);
    loadClosure(value, "saved", "");
  }

  function handleModeChange(nextMode) {
    setMode(nextMode);
    syncState(month, nextMode, selectedClosureId);
    loadClosure(month, nextMode, selectedClosureId);
  }

  function handleClosureVersionChange(value) {
    setSelectedClosureId(value);
    setMode("saved");
    syncState(month, "saved", value);
    loadClosure(month, "saved", value);
  }

  async function saveClosure() {
    if (isSaving) return;

    try {
      setIsSaving(true);
      setIsConfirmOpen(false);
      setError("");

      const response = await fetch("/api/attendance/monthly-closure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ month, completeBaseHours: true }),
      });
      const nextPayload = await response.json();

      if (!response.ok) {
        throw new Error(nextPayload.error || "No se pudo guardar el cierre mensual.");
      }

      setMode("saved");
      setSelectedClosureId("");
      syncState(month, "saved");
      await loadClosure(month, "saved");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  function handleSaveRequest() {
    if (isSaving) return;
    setIsConfirmOpen(true);
  }

  async function exportClosure(nextExportMode) {
    if (exportMode || isLoading || !rows.length) return;
    const isDetailedExcel = nextExportMode === "detailed-xlsx";

    try {
      setExportMode(nextExportMode);
      setError("");

      const params = new URLSearchParams();
      params.set("month", month);
      params.set("export", nextExportMode);
      if (isLiveMode) params.set("mode", "live");
      if (!isLiveMode && selectedClosureValue) params.set("closureId", selectedClosureValue);

      const response = await fetch(`/api/attendance/monthly-closure?${params.toString()}`);

      if (!response.ok) {
        const message = await response.json().catch(() => null);
        throw new Error(message?.error || "No se pudo exportar el cierre mensual.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = isDetailedExcel
        ? `cierre-mensual-detallado-${month}.xlsx`
        : `cierre-mensual-${month}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setExportMode("");
    }
  }

  useEffect(() => {
    loadClosure(
      initialStateRef.current.month,
      initialStateRef.current.mode,
      initialStateRef.current.closureId,
    );
  }, []);

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <label>
            <span>Mes</span>
            <input type="month" value={month} onChange={(event) => handleMonthChange(event.target.value)} />
          </label>
          {closures.length ? (
            <label>
              <span>Copia</span>
              <select value={selectedClosureValue} onChange={(event) => handleClosureVersionChange(event.target.value)} disabled={isSaving || isLoading}>
                {closures.map((closure) => (
                  <option key={closure.id} value={closure.id}>
                    v{closure.version}{closure.isLatest ? " · última" : ""} · {new Date(closure.closedAt).toLocaleString("es-EC")}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.exportButton}
            onClick={() => exportClosure("detailed-xlsx")}
            disabled={Boolean(exportMode) || isSaving || isLoading || !rows.length}
          >
            {exportMode === "detailed-xlsx" ? <RefreshCw size={16} /> : <Download size={16} />}
            Excel completo
          </button>

          <button
            type="button"
            className={styles.exportButton}
            onClick={() => exportClosure("payroll-csv")}
            disabled={Boolean(exportMode) || isSaving || isLoading || !rows.length}
          >
            {exportMode === "payroll-csv" ? <RefreshCw size={16} /> : <Download size={16} />}
            Formato nómina
          </button>

          <button
            type="button"
            className={styles.saveButton}
            onClick={handleSaveRequest}
            disabled={(isClosed && !isLiveMode) || isSaving || isLoading}
          >
            {isSaving ? <RefreshCw size={16} /> : isClosed && !isLiveMode ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {isClosed ? (isLiveMode ? "Actualizar cierre" : "Guardado") : "Guardar cierre"}
          </button>
        </div>
      </div>

      {isClosed ? (
        <div className={`${styles.viewModeBar} ${isLiveMode ? styles.viewModeBarLive : ""}`}>
          <div>
            <span>Vista</span>
            <strong>{isLiveMode ? "Cálculo actual" : "Copia guardada"}</strong>
            <small>
              {isLiveMode
                ? "Muestra el cálculo con los datos actuales antes de guardar una nueva copia."
                : "Muestra la copia cerrada seleccionada para nómina y exportación."}
            </small>
          </div>
          <button
            type="button"
            className={styles.viewModeButton}
            onClick={() => handleModeChange(isLiveMode ? "saved" : "live")}
            disabled={isSaving || isLoading}
          >
            <RefreshCw size={16} />
            {isLiveMode ? "Volver a copia" : "Ver cálculo actual"}
          </button>
        </div>
      ) : null}

      {!isLoading && data ? (
        <div className={styles.summaryGrid}>
          <article>
            <span>Laborables</span>
            <strong>{metricValue(totals.regularWorkedLabel)} / {metricValue(totals.regularTargetLabel)}</strong>
            <small>{totals.baseCompletionMinutes ? `Comp. ${metricValue(totals.baseCompletionLabel)}` : "Base del cierre"}</small>
          </article>
          <article>
            <span>Suplementarias</span>
            <strong>{metricValue(totals.supplementaryLabel)}</strong>
            <small>{totals.supplementaryAmountLabel || "Valor adicional"}</small>
          </article>
          <article>
            <span>Extraordinarias</span>
            <strong>{metricValue(totals.extraordinaryLabel)}</strong>
            <small>{totals.extraordinaryAmountLabel || "Valor adicional"}</small>
          </article>
          <article>
            <span>Atrasos</span>
            <strong>{metricValue(totals.lateLabel)}</strong>
            <small>Control interno</small>
          </article>
          <article>
            <span>Sueldos</span>
            <strong>{totals.salaryTotalLabel || "$0.00"}</strong>
            <small>{totals.employees || 0} empleados</small>
          </article>
        </div>
      ) : null}

      {error ? (
        <div className={styles.errorBox}>
          <AlertTriangle size={17} />
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className={styles.loadingScene} aria-hidden="true">
          {Array.from({ length: 8 }).map((_, index) => <span key={index} />)}
        </div>
      ) : (
        <>
          <div className={`${styles.tableShell} ${isUpdatingClosure ? styles.tableShellUpdating : ""}`} aria-busy={isUpdatingClosure}>
            {isUpdatingClosure ? (
              <>
                <span className={styles.loadingRail} aria-hidden="true" />
                <div className={styles.updateOverlay} role="status" aria-live="polite">
                  <RefreshCw size={18} />
                  <strong>{isSaving ? "Actualizando cierre..." : "Cargando cierre..."}</strong>
                </div>
              </>
            ) : null}
            <div className={styles.tableScroller}>
              <table>
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Laborables</th>
                    <th>Suplementarias</th>
                    <th>Extraordinarias</th>
                    <th>Atrasos</th>
                    <th>Sueldo total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.employeeId || `${row.employeeName}-${index}`}>
                      <td>
                        <strong className={styles.employeeName}>{row.employeeName}</strong>
                        <span>{row.branchName} · {row.areaName} · {row.roleName}</span>
                      </td>
                      <td>
                        <span className={styles.metricValue}>{laborableValue(row)}</span>
                        {row.baseCompletionMinutes > 0 ? (
                          <span>Comp. {metricValue(row.baseCompletionLabel)}</span>
                        ) : null}
                      </td>
                      <td>
                        <span className={styles.metricValue}>{metricValue(row.supplementaryLabel)}</span>
                      </td>
                      <td>
                        <span className={styles.metricValue}>{metricValue(row.extraordinaryLabel)}</span>
                      </td>
                      <td>
                        <span className={styles.metricValue}>{metricValue(row.lateLabel)}</span>
                      </td>
                      <td>
                        <strong className={styles.salaryValue}>{row.salaryTotalLabel || "$0.00"}</strong>
                      </td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={6} className={styles.emptyCell}>No hay empleados para cerrar en este mes.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={isClosed ? "Actualizar cierre" : "Guardar cierre"}
        message={
          isClosed
            ? "Se guardará una nueva versión completando las horas laborables del mes con suplementarias aprobadas y luego extraordinarias. Nómina usará la última copia guardada."
            : "Se guardará una copia fija completando las horas laborables del mes con suplementarias aprobadas y luego extraordinarias."
        }
        confirmLabel={isClosed ? "Actualizar cierre" : "Guardar cierre"}
        cancelLabel="Cancelar"
        tone="warning"
        isPending={isSaving}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={saveClosure}
      />
    </section>
  );
}
