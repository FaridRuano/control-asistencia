import { redirect } from "next/navigation";

import LoginForm from "@/components/auth/LoginForm";
import { isAuthenticated } from "@/lib/auth";

const highlights = [
  "Acceso restringido con credenciales internas",
  "Carga de reportes .xls y .xlsx del biométrico",
  "Resumen preliminar de empleados, picadas y días calculados",
];

export default async function HomePage() {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    redirect("/uploads");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-10 lg:px-10">
      <section className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="rounded-[2rem] border border-[var(--border)] bg-slate-950 px-8 py-10 text-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.18)] md:px-10">
          <p className="text-sm uppercase tracking-[0.32em] text-amber-300">
            Acceso Interno
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
            Control de Asistencia
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
            Esta aplicación queda reservada para la persona encargada de cargar los reportes del biométrico y revisar el resultado preliminar del procesamiento.
          </p>

          <div className="mt-8 space-y-6">
            {highlights.map((item, index) => (
              <div key={item} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-amber-300">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <p className="pt-1 text-sm leading-7 text-slate-200">{item}</p>
              </div>
            ))}
          </div>
        </aside>

        <LoginForm />
      </section>
    </main>
  );
}
