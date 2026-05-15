"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  BriefcaseBusiness,
  Building2,
  Edit3,
  EyeOff,
  Plus,
  Search,
  ShieldUser,
  Trash2,
} from "lucide-react";

import CatalogPageLoader from "@/components/catalog/CatalogPageLoader";
import FloatingNotice from "@/components/ui/FloatingNotice";
import HydrationGate from "@/components/ui/HydrationGate";
import usePersistentBooleanPreference from "@/hooks/usePersistentBooleanPreference";
import styles from "./RoleManagement.module.scss";

const INITIAL_FORM = {
  code: "",
  name: "",
  areaCode: "",
  description: "",
  isActive: true,
};

const ROLE_FORM_VISIBILITY_PREFERENCE_KEY = "company.roles.formVisible";

function mapRoleToForm(role) {
  return {
    code: role.code || "",
    name: role.name || "",
    areaCode: role.areaCode || "",
    description: role.description || "",
    isActive: Boolean(role.isActive),
  };
}

export default function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [search, setSearch] = useState("");
  const [editingRoleId, setEditingRoleId] = useState("");
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [notice, setNotice] = useState(null);
  const [isSaving, startSavingTransition] = useTransition();
  const [, startLoadingTransition] = useTransition();
  const noticeExitTimeoutRef = useRef(null);
  const noticeRemoveTimeoutRef = useRef(null);
  const [isFormVisible, setIsFormVisible] = usePersistentBooleanPreference(
    ROLE_FORM_VISIBILITY_PREFERENCE_KEY,
    true,
  );

  function clearNoticeTimers() {
    if (noticeExitTimeoutRef.current) {
      window.clearTimeout(noticeExitTimeoutRef.current);
      noticeExitTimeoutRef.current = null;
    }

    if (noticeRemoveTimeoutRef.current) {
      window.clearTimeout(noticeRemoveTimeoutRef.current);
      noticeRemoveTimeoutRef.current = null;
    }
  }

  function dismissNotice() {
    clearNoticeTimers();

    setNotice((current) => {
      if (!current) {
        return null;
      }

      return {
        ...current,
        isLeaving: true,
      };
    });

    noticeRemoveTimeoutRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeRemoveTimeoutRef.current = null;
    }, 240);
  }

  function showNotice(type, message) {
    clearNoticeTimers();

    setNotice({ type, message, isLeaving: false });
    noticeExitTimeoutRef.current = window.setTimeout(() => {
      dismissNotice();
    }, 4000);
  }

  useEffect(() => {
    return () => {
      if (noticeExitTimeoutRef.current) {
        window.clearTimeout(noticeExitTimeoutRef.current);
      }

      if (noticeRemoveTimeoutRef.current) {
        window.clearTimeout(noticeRemoveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    startLoadingTransition(async () => {
      try {
        const [rolesResponse, areasResponse] = await Promise.all([
          fetch("/api/roles"),
          fetch("/api/areas"),
        ]);
        const [rolesPayload, areasPayload] = await Promise.all([
          rolesResponse.json(),
          areasResponse.json(),
        ]);

        if (!rolesResponse.ok) {
          throw new Error(rolesPayload.error || "No se pudo cargar la lista de roles.");
        }

        if (!areasResponse.ok) {
          throw new Error(areasPayload.error || "No se pudo cargar la lista de áreas.");
        }

        setRoles(rolesPayload.roles || []);
        setAreas(areasPayload.areas || []);
      } catch (requestError) {
        clearNoticeTimers();
        setNotice({ type: "error", message: requestError.message, isLeaving: false });
        noticeExitTimeoutRef.current = window.setTimeout(() => {
          clearNoticeTimers();
          setNotice((current) => {
            if (!current) {
              return null;
            }

            return {
              ...current,
              isLeaving: true,
            };
          });

          noticeRemoveTimeoutRef.current = window.setTimeout(() => {
            setNotice(null);
            noticeRemoveTimeoutRef.current = null;
          }, 240);
        }, 4000);
      } finally {
        setIsLoadingRoles(false);
      }
    });
  }, []);

  const filteredRoles = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return roles;
    }

    return roles.filter((role) =>
      [role.code, role.name, role.areaName, role.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [roles, search]);

  const canSubmit = useMemo(() => {
    return Boolean(form.name.trim() && form.areaCode.trim());
  }, [form.areaCode, form.name]);

  async function refreshData() {
    setIsLoadingRoles(true);
    const [rolesResponse, areasResponse] = await Promise.all([
      fetch("/api/roles"),
      fetch("/api/areas"),
    ]);
    const [rolesPayload, areasPayload] = await Promise.all([
      rolesResponse.json(),
      areasResponse.json(),
    ]);

    if (!rolesResponse.ok) {
      setIsLoadingRoles(false);
      throw new Error(rolesPayload.error || "No se pudo recargar la lista de roles.");
    }

    if (!areasResponse.ok) {
      setIsLoadingRoles(false);
      throw new Error(areasPayload.error || "No se pudo recargar la lista de áreas.");
    }

    setRoles(rolesPayload.roles || []);
    setAreas(areasPayload.areas || []);
    setIsLoadingRoles(false);
  }

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setEditingRoleId("");
    setForm(INITIAL_FORM);
    setIsFormVisible(true);
  }

  function handleSubmit(event) {
    event.preventDefault();

    startSavingTransition(async () => {
      try {
        const method = editingRoleId ? "PATCH" : "POST";
        const endpoint = editingRoleId ? `/api/roles/${editingRoleId}` : "/api/roles";
        const response = await fetch(endpoint, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo guardar el rol.");
        }

        await refreshData();
        showNotice(
          "success",
          editingRoleId
            ? "Rol actualizado correctamente."
            : "Rol creado correctamente.",
        );
        resetForm();
      } catch (requestError) {
        showNotice("error", requestError.message);
      }
    });
  }

  function handleEdit(role) {
    setEditingRoleId(role.id);
    setForm(mapRoleToForm(role));
    setIsFormVisible(true);
  }

  function handleDelete(role) {
    const confirmed = window.confirm(`¿Deseas eliminar el rol "${role.name}"?`);

    if (!confirmed) {
      return;
    }

    startSavingTransition(async () => {
      try {
        const response = await fetch(`/api/roles/${role.id}`, {
          method: "DELETE",
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo eliminar el rol.");
        }

        await refreshData();
        showNotice("success", "Rol eliminado correctamente.");

        if (editingRoleId === role.id) {
          resetForm();
        }
      } catch (requestError) {
        showNotice("error", requestError.message);
      }
    });
  }

  return (
    <HydrationGate fallback={null}>
      {isLoadingRoles ? (
        <CatalogPageLoader formVisible={isFormVisible} />
      ) : (
        <div className="catalog-page-shell">
          <FloatingNotice notice={notice} onClose={dismissNotice} />

          <div className="catalog-page-body">
            <div className="catalog-form-rail">
              <div className={`catalog-form-column ${!isFormVisible ? "is-hidden" : ""}`}>
                <section className={`catalog-panel page-entrance ${styles.formPanel}`}>
                  <div className="catalog-panel-shell">
                    <div className="catalog-section-head">
                      <div className={styles.formHeading}>
                        <p className={`catalog-section-eyebrow ${styles.formEyebrow}`}>
                          {editingRoleId ? "Modo edición" : "Nuevo registro"}
                        </p>
                        <h3 className={`catalog-section-title ${styles.formTitle}`}>
                          {editingRoleId ? "Editar rol" : "Formulario de rol"}
                        </h3>
                      </div>
                    </div>

                    <div className="catalog-panel-body">
                      <form onSubmit={handleSubmit} className={`catalog-form-grid ${styles.formGrid}`}>
                        <label className="catalog-field">
                          <span className="catalog-label">Código</span>
                          <input
                            value={form.code}
                            onChange={(event) => updateField("code", event.target.value.toUpperCase())}
                            className="catalog-input"
                            placeholder="Se genera automáticamente si lo dejas vacío"
                          />
                        </label>

                        <label className="catalog-field">
                          <span className="catalog-label">Área</span>
                          <select
                            value={form.areaCode}
                            onChange={(event) => updateField("areaCode", event.target.value)}
                            className="catalog-select"
                            required
                          >
                            <option value="">Selecciona un área</option>
                            {areas.map((area) => (
                              <option key={area.id} value={area.code}>
                                {area.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="catalog-field">
                          <span className="catalog-label">Nombre</span>
                          <input
                            value={form.name}
                            onChange={(event) => updateField("name", event.target.value)}
                            className="catalog-input"
                            placeholder="Ej. Jefe de ventas"
                            required
                          />
                        </label>

                        <label className="catalog-field">
                          <span className="catalog-label">Descripción</span>
                          <textarea
                            value={form.description}
                            onChange={(event) => updateField("description", event.target.value)}
                            className="catalog-input"
                            placeholder="Ej. Responsable de coordinar equipo, cobertura y cumplimiento operativo."
                            rows={4}
                          />
                        </label>

                        <label className={`catalog-field ${styles.toggleField}`}>
                          <span className="catalog-label">Estado</span>
                          <button
                            type="button"
                            className={`catalog-toggle ${form.isActive ? "is-active" : ""}`}
                            onClick={() => updateField("isActive", !form.isActive)}
                            aria-pressed={form.isActive}
                          >
                            <span>{form.isActive ? "Activo" : "Inactivo"}</span>
                          </button>
                        </label>

                        <div className="catalog-actions">
                          <button type="submit" disabled={isSaving || !canSubmit} className="catalog-button-primary">
                            <Plus size={16} />
                            {isSaving ? "Guardando..." : editingRoleId ? "Actualizar" : "Crear"}
                          </button>

                          <button type="button" onClick={resetForm} disabled={isSaving} className="catalog-button-ghost">
                            Limpiar
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="catalog-table-column">
              <section className="catalog-panel page-entrance page-entrance-delay-sm">
                <div className="catalog-toolbar">
                  <div>
                    <p className="catalog-count">
                      {filteredRoles.length} rol{filteredRoles.length === 1 ? "" : "es"}
                      {search.trim() ? ` de ${roles.length}` : ""}
                    </p>
                  </div>

                  <label className="catalog-search">
                    <Search size={16} />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar rol"
                      className="catalog-search-input"
                    />
                  </label>

                  <button
                    type="button"
                    className={isFormVisible ? "catalog-button-ghost" : "catalog-button-primary"}
                    onClick={() => setIsFormVisible(!isFormVisible)}
                    aria-expanded={isFormVisible}
                    aria-label={isFormVisible ? "Ocultar formulario" : "Crear rol"}
                    title={isFormVisible ? "Ocultar formulario" : "Crear rol"}
                  >
                    {isFormVisible ? <EyeOff size={16} /> : <Plus size={16} />}
                  </button>
                </div>

                {filteredRoles.length ? (
                  <div className="catalog-table-shell">
                    <div className="catalog-table-scroll">
                      <table className="catalog-table">
                        <thead>
                          <tr>
                            <th>Rol</th>
                            <th>Área</th>
                            <th>Descripción</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRoles.map((role) => (
                            <tr key={role.id}>
                              <td>
                                <div className={styles.roleIdentity}>
                                  <div className={styles.roleCode}>
                                    <ShieldUser size={14} />
                                    {role.code}
                                  </div>
                                  <strong className={styles.roleName}>{role.name}</strong>
                                </div>
                              </td>
                              <td>
                                <span className={styles.roleArea}>
                                  <Building2 size={14} />
                                  {role.areaName || "Área pendiente"}
                                </span>
                              </td>
                              <td>
                                <div className={styles.roleDescription}>
                                  <span>
                                    <BriefcaseBusiness size={14} style={{ marginRight: "0.42rem", verticalAlign: "text-bottom" }} />
                                    {role.description || "Descripción pendiente"}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span className={`catalog-status-badge ${role.isActive ? "is-active" : "is-inactive"}`}>
                                  {role.isActive ? "Activo" : "Inactivo"}
                                </span>
                              </td>
                              <td>
                                <div className="catalog-row-actions">
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(role)}
                                    className="catalog-icon-button"
                                    title="Editar rol"
                                    aria-label={`Editar ${role.name}`}
                                  >
                                    <Edit3 size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(role)}
                                    className="catalog-icon-button danger"
                                    title="Eliminar rol"
                                    aria-label={`Eliminar ${role.name}`}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="catalog-empty-state">
                    No encontramos roles con ese criterio. Si aún no hay registros, crea el primero desde el formulario.
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </HydrationGate>
  );
}
