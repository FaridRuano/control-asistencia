"use client";

import Link from "next/link";
import { Edit3, ReceiptText, Trash2 } from "lucide-react";

import CatalogDrawer from "@/components/catalog/CatalogDrawer";
import { planningModulePath } from "@/lib/modules/planning/routes";
import styles from "./EmployeeDetailModal.module.scss";

const DOCUMENT_TYPE_LABELS = {
  cedula: "Cedula",
  pasaporte: "Pasaporte",
  ruc: "RUC",
};

function formatValue(value) {
  return value || "Pendiente";
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function DetailSection({ title, items }) {
  return (
    <section className={styles.section}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      <dl className={styles.detailList}>
        {items.map(([label, value]) => (
          <div key={label} className={styles.detailItem}>
            <dt>{label}</dt>
            <dd>{formatValue(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function EmployeeDetailModal({ employee, onClose, onEdit, onDelete }) {
  const documentType = employee?.documentType || "cedula";
  const identityDetails = [
    ["Documento de identidad", DOCUMENT_TYPE_LABELS[documentType] || documentType],
    ["DNI", employee?.dni],
    ["Email personal", employee?.personalEmail],
    ["Numero de contacto", employee?.phone],
    ["Direccion", employee?.address],
  ];
  const workDetails = [
    ["Sucursal", employee?.branchName || employee?.branch],
    ["Rol principal", employee?.roleName],
    ["Roles operativos", (employee?.roleAssignments || []).map((role) => role.name).join(", ")],
    ["Area", employee?.areaName],
    ["Sueldo", formatMoney(employee?.salary)],
    ["Biometrico", employee?.biometricCode],
    ["Fecha de nacimiento", employee?.birthDate],
  ];

  return (
    <CatalogDrawer
      isOpen={Boolean(employee)}
      eyebrow="Ficha del empleado"
      title={employee?.fullName || "Detalle del empleado"}
      onClose={onClose}
    >
      <div className={styles.card}>
        <div className={styles.summary}>
          <span className={`${styles.statusPill} ${employee?.isActive ? styles.active : styles.inactive}`}>
            {employee?.isActive ? "Activo" : "Inactivo"}
          </span>
          <p>{employee?.organizationLabel || "Estructura pendiente"}</p>
        </div>

        <DetailSection title="Datos personales" items={identityDetails} />
        <DetailSection title="Datos laborales" items={workDetails} />

        {employee ? (
          <div className={`catalog-actions catalog-actions-end ${styles.actions}`}>
            <Link
              href={`${planningModulePath("/payroll")}?employeeId=${employee.id}&employeeName=${encodeURIComponent(employee.fullName)}&mode=month`}
              className="catalog-button-ghost"
            >
              <ReceiptText size={16} />
              Ver nómina
            </Link>
            <button type="button" className="catalog-button-ghost" onClick={() => onDelete(employee)}>
              <Trash2 size={16} />
              Eliminar
            </button>
            <button type="button" className="catalog-button-primary" onClick={() => onEdit(employee)}>
              <Edit3 size={16} />
              Editar
            </button>
          </div>
        ) : null}
      </div>
    </CatalogDrawer>
  );
}
