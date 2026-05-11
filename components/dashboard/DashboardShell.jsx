"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import LogoutButton from "@/components/auth/LogoutButton";
import styles from "./DashboardShell.module.scss";

const navigation = [
  {
    href: "/dashboard/employees",
    label: "Empleados",
    description: "Registro y mantenimiento",
  },
  {
    href: "/dashboard/schedules",
    label: "Horarios",
    description: "Planificación semanal",
  },
  {
    href: "/dashboard/uploads",
    label: "Cargas",
    description: "Subida de reportes",
  },
  {
    href: "/dashboard/payroll",
    label: "Nómina",
    description: "Procesamiento y consulta",
  },
];

export default function DashboardShell({ title, description, children }) {
  const pathname = usePathname();

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.logoWrap}>
            <Image
              src="/imgs/logo-chimg.png"
              alt="Logo de la empresa"
              width={42}
              height={42}
              className={styles.logo}
              priority
            />
          </div>

          <div>
            <p className={styles.brandEyebrow}>Panel Interno</p>
            <p className={styles.brandTitle}>Control de Asistencia</p>
          </div>
        </div>

        <nav className={styles.nav}>
          {navigation.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
              >
                <span className={styles.navLabel}>{item.label}</span>
                <span className={styles.navDescription}>{item.description}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <p className={styles.sidebarNote}>
            Administra empleados y procesa reportes mensuales desde un solo lugar.
          </p>
          <LogoutButton />
        </div>
      </aside>

      <main className={styles.content}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Dashboard</p>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.description}>{description}</p>
          </div>
        </header>

        <section>{children}</section>
      </main>
    </div>
  );
}
