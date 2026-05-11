"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";

const ACCEPTED_EXTENSIONS = ".xls,.xlsx";

function formatDateTime(value) {
  if (!value) {
    return "N/D";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "N/D";
  }

  return format(parsed, "dd/MM/yyyy HH:mm");
}

export default function UploadAttendanceForm() {
  const [file, setFile] = useState(null);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event) {
    event.preventDefault();

    if (!file) {
      setError("Selecciona un archivo .xls o .xlsx para continuar.");
      return;
    }

    setError("");

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const request = await fetch("/api/attendance/upload", {
          method: "POST",
          body: formData,
        });

        const payload = await request.json();

        if (!request.ok) {
          throw new Error(payload.error || "No se pudo procesar el archivo.");
        }

        setResponse(payload);
      } catch (submissionError) {
        setResponse(null);
        setError(submissionError.message);
      }
    });
  }

  return (
    <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.32em] text-[var(--primary)]">
            Subir archivo
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            Procesa un reporte `InOutHorizontalReport`
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            El parser inicial usa heurísticas para detectar bloques de empleados, fechas y horas en un Excel horizontal. Si el archivo real tiene variaciones, el backend devolverá trazas para afinarlo rápido.
          </p>
        </div>

        <label className="block rounded-[1.5rem] border border-dashed border-slate-300 bg-white/70 p-6 transition hover:border-[var(--primary)] hover:bg-white">
          <span className="block text-sm font-semibold text-slate-700">
            Archivo Excel
          </span>
          <span className="mt-2 block text-sm text-slate-500">
            Extensiones permitidas: {ACCEPTED_EXTENSIONS}
          </span>
          <input
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="mt-4 block w-full cursor-pointer text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-w-44 items-center justify-center rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Procesando archivo..." : "Subir y procesar"}
        </button>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}
      </form>

      {response ? (
        <div className="mt-8 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Carga", value: response.upload?.fileName || "N/D" },
              { label: "Empleados", value: response.summary?.totalEmployees || 0 },
              { label: "Picadas", value: response.summary?.totalPunches || 0 },
              { label: "Días calculados", value: response.summary?.totalDailyAttendances || 0 },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Código</th>
                    <th className="px-4 py-3 font-semibold">Empleado</th>
                    <th className="px-4 py-3 font-semibold">Departamento</th>
                    <th className="px-4 py-3 font-semibold">Picadas</th>
                    <th className="px-4 py-3 font-semibold">Primera</th>
                    <th className="px-4 py-3 font-semibold">Última</th>
                    <th className="px-4 py-3 font-semibold">Días</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {response.employees?.map((employee) => (
                    <tr key={`${employee.biometricCode}-${employee.employeeId}`}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {employee.biometricCode}
                      </td>
                      <td className="px-4 py-3 text-slate-900">{employee.name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {employee.department || "N/D"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{employee.punchCount}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDateTime(employee.firstPunch)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDateTime(employee.lastPunch)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{employee.calculatedDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {response.parserLogs?.length ? (
            <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold text-amber-900">
                Trazas del parser para ajustar el formato real
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-amber-800">
                {response.parserLogs.slice(0, 12).map((log, index) => (
                  <li key={`${log}-${index}`}>{log}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
