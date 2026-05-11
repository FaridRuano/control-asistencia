import Image from "next/image";
import { redirect } from "next/navigation";

import LoginForm from "@/components/auth/LoginForm";
import { isAuthenticated } from "@/lib/auth";
import styles from "./page.module.scss";

const highlights = [
  "Acceso restringido con credenciales internas",
  "Carga de reportes .xls y .xlsx del biométrico",
  "Resumen preliminar de empleados, picadas y días calculados",
];

export default async function HomePage() {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    redirect("/dashboard/employees");
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <aside className={styles.hero}>
          <div className={styles.brand}>
            <div className={styles.logoWrap}>
              <Image
                src="/imgs/logo-chimg.png"
                alt="Logo de la empresa"
                width={48}
                height={48}
                className={styles.logo}
                priority
              />
            </div>

            <div>
              <p className={styles.eyebrow}>Acceso Interno</p>
              <p className={styles.brandName}>CHIMG</p>
            </div>
          </div>

          <h1 className={styles.title}>Control de Asistencia</h1>
          <p className={styles.description}>
            Esta aplicación queda reservada para la persona encargada de cargar los reportes del biométrico y revisar el resultado preliminar del procesamiento.
          </p>

          <div className={styles.highlights}>
            {highlights.map((item, index) => (
              <div key={item} className={styles.highlight}>
                <div className={styles.highlightIndex}>
                  {String(index + 1).padStart(2, "0")}
                </div>
                <p className={styles.highlightText}>{item}</p>
              </div>
            ))}
          </div>
        </aside>

        <LoginForm />
      </section>
    </main>
  );
}
