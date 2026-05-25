import {
  Building2,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Layers3,
  ShieldCheck,
  Users,
} from "lucide-react";

import DashboardShell from "@/components/dashboard/DashboardShell";
import TransitionLink from "@/components/navigation/TransitionLink";
import connectToDatabase from "@/lib/db/mongodb";
import { COMPANY_MODULE } from "@/lib/modules/company/module";
import { companyModulePath } from "@/lib/modules/company/routes";
import Area from "@/models/Area";
import Branch from "@/models/Branch";
import Employee from "@/models/Employee";
import Role from "@/models/Role";
import User from "@/models/User";
import UserType from "@/models/UserType";
import styles from "./page.module.scss";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Empresa y configuración global | Control de Asistencia",
};

function formatNumber(value) {
  return new Intl.NumberFormat("es-EC").format(value || 0);
}

function percent(value, total) {
  if (!total) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

async function getCompanyHomeSnapshot() {
  await connectToDatabase();

  const [employees, branches, areas, roles, users, userTypes] = await Promise.all([
    Employee.find({})
      .select("isActive dni biometricCode branchName branch areaName department roleName")
      .lean(),
    Branch.find({}).select("isActive").lean(),
    Area.find({}).select("isActive").lean(),
    Role.find({}).select("isActive").lean(),
    User.find({}).select("isActive lastLoginAt").lean(),
    UserType.find({}).select("isActive").lean(),
  ]);

  const activeEmployees = employees.filter((employee) => employee.isActive !== false);
  const activeUsers = users.filter((user) => user.isActive !== false);
  const assignedToBranch = employees.filter((employee) =>
    String(employee.branchName || employee.branch || "").trim(),
  ).length;
  const assignedToStructure = employees.filter((employee) =>
    String(employee.areaName || employee.department || employee.roleName || "").trim(),
  ).length;
  const withBiometric = employees.filter((employee) => String(employee.biometricCode || "").trim()).length;
  const withDni = employees.filter((employee) => String(employee.dni || "").trim()).length;
  const usersWithLogin = users.filter((user) => user.lastLoginAt).length;

  return {
    totals: {
      employees: employees.length,
      activeEmployees: activeEmployees.length,
      branches: branches.length,
      activeBranches: branches.filter((branch) => branch.isActive !== false).length,
      areas: areas.length,
      roles: roles.length,
      activeRoles: roles.filter((role) => role.isActive !== false).length,
      users: users.length,
      activeUsers: activeUsers.length,
      userTypes: userTypes.length,
      activeUserTypes: userTypes.filter((type) => type.isActive !== false).length,
      usersWithLogin,
    },
    quality: [
      {
        label: "DNI registrado",
        value: percent(withDni, employees.length),
        detail: `${formatNumber(withDni)} de ${formatNumber(employees.length)} empleados`,
      },
      {
        label: "Biométrico registrado",
        value: percent(withBiometric, employees.length),
        detail: `${formatNumber(withBiometric)} de ${formatNumber(employees.length)} empleados`,
      },
      {
        label: "Sucursal asignada",
        value: percent(assignedToBranch, employees.length),
        detail: `${formatNumber(assignedToBranch)} de ${formatNumber(employees.length)} empleados`,
      },
      {
        label: "Estructura asignada",
        value: percent(assignedToStructure, employees.length),
        detail: `${formatNumber(assignedToStructure)} de ${formatNumber(employees.length)} empleados`,
      },
    ],
  };
}

function MetricCard({ icon: Icon, label, value, help }) {
  return (
    <article className={styles.metricCard}>
      <div className={styles.metricIcon}>
        <Icon size={20} />
      </div>
      <div>
        <span className={styles.metricLabel}>{label}</span>
        <strong className={styles.metricValue}>{value}</strong>
        <p className={styles.metricHelp}>{help}</p>
      </div>
    </article>
  );
}

export default async function CompanyHomePage() {
  const snapshot = await getCompanyHomeSnapshot();
  const { totals } = snapshot;

  return (
    <DashboardShell
      moduleConfig={COMPANY_MODULE}
      title="Empresa y configuración global"
      description="Resumen ejecutivo de la base organizacional y los accesos del sistema."
    >
      <div className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Módulo global</p>
            <h2 className={styles.title}>Estado general de la empresa</h2>
            <p className={styles.description}>
              Una lectura compacta de la información base que alimenta el resto de la plataforma.
            </p>
          </div>

          <div className={styles.heroStatus}>
            <CheckCircle2 size={18} />
            <span>{formatNumber(totals.activeEmployees)} empleados activos</span>
          </div>
        </section>

        <section className={styles.metricsGrid}>
          <MetricCard
            icon={Users}
            label="Personal"
            value={formatNumber(totals.employees)}
            help={`${formatNumber(totals.activeEmployees)} activos`}
          />
          <MetricCard
            icon={Building2}
            label="Sucursales"
            value={formatNumber(totals.branches)}
            help={`${formatNumber(totals.activeBranches)} activas`}
          />
          <MetricCard
            icon={Layers3}
            label="Estructura"
            value={`${formatNumber(totals.areas)} / ${formatNumber(totals.roles)}`}
            help="Áreas / roles"
          />
          <MetricCard
            icon={ShieldCheck}
            label="Accesos"
            value={formatNumber(totals.users)}
            help={`${formatNumber(totals.activeUsers)} usuarios activos`}
          />
        </section>

        <section className={styles.mainGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h3 className={styles.panelTitle}>Calidad de información</h3>
                <p className={styles.panelDescription}>Campos clave para que la operación y la asistencia trabajen bien.</p>
              </div>
            </div>

            <div className={styles.qualityList}>
              {snapshot.quality.map((item) => (
                <div key={item.label} className={styles.qualityItem}>
                  <div className={styles.qualityHead}>
                    <span>{item.label}</span>
                    <strong>{item.value}%</strong>
                  </div>
                  <div className={styles.track} aria-hidden="true">
                    <span style={{ width: `${Math.max(item.value, 6)}%` }} />
                  </div>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h3 className={styles.panelTitle}>Acceso del sistema</h3>
                <p className={styles.panelDescription}>Estado simple de cuentas y roles disponibles.</p>
              </div>
            </div>

            <div className={styles.statusGrid}>
              <article className={styles.statusCard}>
                <KeyRound size={18} />
                <strong>{formatNumber(totals.userTypes)}</strong>
                <span>{formatNumber(totals.activeUserTypes)} roles activos</span>
              </article>
              <article className={styles.statusCard}>
                <ShieldCheck size={18} />
                <strong>{formatNumber(totals.activeUsers)}</strong>
                <span>usuarios activos</span>
              </article>
              <article className={styles.statusCard}>
                <Fingerprint size={18} />
                <strong>{formatNumber(totals.usersWithLogin)}</strong>
                <span>con login registrado</span>
              </article>
            </div>
          </section>
        </section>

        <section className={styles.quickLinks}>
          <div className={styles.quickLinkCopy}>
            <CheckCircle2 size={18} />
            <span>Ir a detalle</span>
          </div>

          <div className={styles.quickLinkList}>
            <TransitionLink href={companyModulePath("/organization")} className={styles.quickLink}>
              <Building2 size={15} />
              Empresa
            </TransitionLink>
            <TransitionLink href={companyModulePath("/access")} className={styles.quickLink}>
              <ShieldCheck size={15} />
              Acceso
            </TransitionLink>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
