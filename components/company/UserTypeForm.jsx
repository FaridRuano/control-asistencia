"use client";

import { Plus } from "lucide-react";

export default function UserTypeForm({
  form,
  isEditing,
  isSaving,
  canSubmit,
  onCancel,
  onFieldChange,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="catalog-form-grid">
      <label className="catalog-field">
        <span className="catalog-label">Nombre del rol</span>
        <input
          value={form.name}
          onChange={(event) => onFieldChange("name", event.target.value)}
          className="catalog-input"
          placeholder="Ej. Supervisor"
          required
        />
      </label>

      <label className="catalog-field">
        <span className="catalog-label">Código</span>
        <input
          value={form.code}
          onChange={(event) => onFieldChange("code", event.target.value)}
          className="catalog-input"
          placeholder="Se genera desde el nombre"
        />
      </label>

      <label className="catalog-field">
        <span className="catalog-label">Descripción</span>
        <textarea
          value={form.description}
          onChange={(event) => onFieldChange("description", event.target.value)}
          className="catalog-input"
          placeholder="Uso general del rol de acceso"
          rows={4}
        />
      </label>

      <label className="catalog-field">
        <span className="catalog-label">Estado</span>
        <button
          type="button"
          className={`catalog-switch ${form.isActive ? "is-active" : ""}`}
          onClick={() => onFieldChange("isActive", !form.isActive)}
          aria-pressed={form.isActive}
        >
          <span className="catalog-switchKnob" />
          <span>{form.isActive ? "Activo" : "Inactivo"}</span>
        </button>
      </label>

      <div className="catalog-actions catalog-actions-end">
        <button type="button" onClick={onCancel} disabled={isSaving} className="catalog-button-ghost">
          Cancelar
        </button>
        <button type="submit" disabled={isSaving || !canSubmit} className="catalog-button-primary">
          <Plus size={16} />
          {isSaving ? "Guardando..." : isEditing ? "Actualizar" : "Crear"}
        </button>
      </div>
    </form>
  );
}
