import Link from "next/link";

const highlights = [
  "Carga archivos .xls y .xlsx del biométrico",
  "Detecta empleados por bloques horizontales",
  "Calcula resúmenes diarios y observaciones",
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-10 lg:px-10">
      <section className="grid flex-1 gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-10">
          <p className="text-sm font-medium uppercase tracking-[0.32em] text-[var(--primary)]">
            MVP Interno
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 md:text-6xl">
            Control de Asistencia para procesar reportes biométricos horizontales.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
            Sube el reporte mensual, detecta empleados, guarda picadas en MongoDB y revisa un resumen preliminar de días calculados antes de continuar con reglas más avanzadas.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/uploads"
              className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
            >
              Ir a cargas de asistencia
            </Link>
            <a
              href="#alcance"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/70 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white"
            >
              Ver alcance del MVP
            </a>
          </div>
        </div>

        <aside className="rounded-[2rem] border border-[var(--border)] bg-slate-950 px-8 py-10 text-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
          <p className="text-sm uppercase tracking-[0.32em] text-amber-300">
            Flujo inicial
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
      </section>

      <section id="alcance" className="mt-8 grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Persistencia",
            description: "Mongoose conectado a MongoDB con modelos listos para empleados, horarios, cargas, picadas y asistencia diaria.",
          },
          {
            title: "Parser flexible",
            description: "Heurísticas iniciales para bloques de empleados y celdas de fecha/hora sin asumir columnas fijas tipo CSV.",
          },
          {
            title: "Resultado preliminar",
            description: "Tabla posterior a la carga con empleados detectados, cantidad de picadas y resumen básico de días calculados.",
          },
        ].map((item) => (
          <article
            key={item.title}
            className="rounded-[1.5rem] border border-[var(--border)] bg-white/75 p-6 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur"
          >
            <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
