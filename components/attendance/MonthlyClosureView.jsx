"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Lock, RefreshCw, Save } from "lucide-react";

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
  };
}

function syncState(month, mode = "saved") {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams();
  params.set("month", month);
  if (mode === "live") params.set("mode", "live");
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
}

function metricValue(value) {
  return value && value !== "0m" ? value : "--";
}

export default function MonthlyClosureView() {
  const [initialState] = useState(() => readInitialState());
  const initialStateRef = useRef(initialState);
  const [month, setMonth] = useState(() => initialState.month);
  const [mode, setMode] = useState(() => initialState.mode);
  const [payload, setPayload] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [error, setError] = useState("");

  const isLiveMode = mode === "live";
  const data = isLiveMode ? payload?.preview : (payload?.closure || payload?.preview) || null;
  const isClosed = Boolean(payload?.isClosed);
  const rows = data?.rows || [];
  const closureVersion = payload?.closure?.version || 0;
  const isUpdatingClosure = isSaving || (isLoading && Boolean(payload));

  async function loadClosure(nextMonth = month, nextMode = mode) {
    try {
      setIsLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.set("month", nextMonth);
      if (nextMode === "live") params.set("mode", "live");

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
    syncState(value);
    loadClosure(value, "saved");
  }

  function handleModeChange(nextMode) {
    setMode(nextMode);
    syncState(month, nextMode);
    loadClosure(month, nextMode);
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
        body: JSON.stringify({ month }),
      });
      const nextPayload = await response.json();

      if (!response.ok) {
        throw new Error(nextPayload.error || "No se pudo guardar el cierre mensual.");
      }

      setMode("saved");
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

  async function exportPayrollCsv() {
    if (isExporting || isLoading || !rows.length) return;

    try {
      setIsExporting(true);
      setError("");

      const params = new URLSearchParams();
      params.set("month", month);
      params.set("export", "payroll-csv");
      if (isLiveMode) params.set("mode", "live");

      const response = await fetch(`/api/attendance/monthly-closure?${params.toString()}`);

      if (!response.ok) {
        const message = await response.json().catch(() => null);
        throw new Error(message?.error || "No se pudo exportar el cierre mensual.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cierre-mensual-${month}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsExporting(false);
    }
  }

  useEffect(() => {
    loadClosure(initialStateRef.current.month, initialStateRef.current.mode);
  }, []);

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <label>
          <span>Mes</span>
          <input type="month" value={month} onChange={(event) => handleMonthChange(event.target.value)} />
        </label>

        <div className={styles.actions}>
          {isClosed ? (
            <>
              <div className={styles.closedBadge}>
                <Lock size={16} />
                Copia v{closureVersion}
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => handleModeChange(isLiveMode ? "saved" : "live")}
                disabled={isSaving || isLoading}
              >
                <RefreshCw size={16} />
                {isLiveMode ? "Ver copia" : "Ver cálculo actual"}
              </button>
            </>
          ) : null}

          <button
            type="button"
            className={styles.exportButton}
            onClick={exportPayrollCsv}
            disabled={isExporting || isSaving || isLoading || !rows.length}
          >
            {isExporting ? <RefreshCw size={16} /> : <Download size={16} />}
            Exportar nómina
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
                    <th>Normales</th>
                    <th>Suplementarias</th>
                    <th>Extraordinarias</th>
                    <th>Atrasos</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.employeeId || `${row.employeeName}-${index}`}>
                      <td>
                        <strong>{row.employeeName}</strong>
                        <span>{row.branchName} · {row.areaName} · {row.roleName}</span>
                      </td>
                      <td>
                        <strong>{metricValue(row.regularWorkedLabel)}</strong>
                      </td>
                      <td>
                        <strong>{metricValue(row.supplementaryLabel)}</strong>
                      </td>
                      <td>
                        <strong>{metricValue(row.extraordinaryLabel)}</strong>
                      </td>
                      <td>
                        <strong>{metricValue(row.lateLabel)}</strong>
                      </td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={5} className={styles.emptyCell}>No hay empleados para cerrar en este mes.</td>
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
            ? "Se guardará una nueva versión del cierre de este mes. Nómina usará la última copia guardada."
            : "Se guardará una copia fija del mes para usarla como base de nómina."
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
