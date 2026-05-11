import { redirect } from "next/navigation";

import LogoutButton from "@/components/auth/LogoutButton";
import UploadAttendanceForm from "@/components/attendance/UploadAttendanceForm";
import { isAuthenticated } from "@/lib/auth";

export const metadata = {
  title: "Cargar Asistencia | Control de Asistencia",
};

export default async function UploadsPage() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect("/");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-10 lg:px-10">
      <div className="mb-6 flex justify-end">
        <LogoutButton />
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-[var(--border)] bg-slate-950 p-8 text-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
          <p className="text-sm uppercase tracking-[0.32em] text-amber-300">
            Carga Mensual
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Importa el reporte del biométrico y genera un resumen preliminar.
          </h1>
          <p className="mt-6 text-sm leading-7 text-slate-300">
            Este MVP espera archivos Excel tipo reporte horizontal, detecta bloques por empleado y guarda tanto las marcaciones crudas como los resúmenes diarios calculados.
          </p>

          <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-200">
              Reglas iniciales
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
              <li>Dos picadas: entrada y salida final.</li>
              <li>Cuatro picadas: entrada, salida almuerzo, regreso y salida final.</li>
              <li>Menos de dos o cantidades irregulares: día incompleto.</li>
              <li>Si no hay horario configurado para ese día: estado `without_schedule`.</li>
            </ul>
          </div>
        </section>

        <UploadAttendanceForm />
      </div>
    </main>
  );
}
