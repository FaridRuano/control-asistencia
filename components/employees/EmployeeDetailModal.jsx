"use client";

import { createPortal } from "react-dom";
import { Edit3, Trash2, X } from "lucide-react";

import useClientReady from "@/hooks/useClientReady";
import styles from "./EmployeeDetailModal.module.scss";

function formatValue(value) {
  return value || "Pendiente";
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function EmployeeDetailModal({ employee, onClose, onEdit, onDelete }) {
  const canRenderPortal = useClientReady();

  if (!canRenderPortal || !employee) {
    return null;
  }

  const details = [
    ["Documento", `${employee.documentType || "cedula"} ${employee.dni || ""}`.trim()],
    ["Nombre completo", employee.fullName],
    ["Email personal", employee.personalEmail],
    ["Dirección", employee.address],
    ["Número de contacto", employee.phone],
    ["Sucursal", employee.branchName || employee.branch],
    ["Rol", employee.roleName],
    ["Área", employee.areaName],
    ["Sueldo", formatMoney(employee.salary)],
    ["Fecha de nacimiento", employee.birthDate],
    ["Biométrico", employee.biometricCode],
    ["Estado", employee.isActive ? "Activo" : "Inactivo"],
  ];

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="employee-detail-title">
      <section className={styles.modal}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Ficha del empleado</p>
            <h3 id="employee-detail-title" className={styles.title}>
              {employee.fullName}
            </h3>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar detalle">
            <X size={18} />
          </button>
        </div>

        <dl className={styles.detailGrid}>
          {details.map(([label, value]) => (
            <div key={label} className={styles.detailItem}>
              <dt>{label}</dt>
              <dd>{formatValue(value)}</dd>
            </div>
          ))}
        </dl>

        <div className={styles.actions}>
          <button type="button" className="catalog-button-ghost" onClick={() => onDelete(employee)}>
            <Trash2 size={16} />
            Eliminar
          </button>
          <button type="button" className="catalog-button-primary" onClick={() => onEdit(employee)}>
            <Edit3 size={16} />
            Editar
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
