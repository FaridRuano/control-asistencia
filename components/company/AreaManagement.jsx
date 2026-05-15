"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  BriefcaseBusiness,
  EyeOff,
  Edit3,
  Layers3,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import CatalogPageLoader from "@/components/catalog/CatalogPageLoader";
import FloatingNotice from "@/components/ui/FloatingNotice";
import HydrationGate from "@/components/ui/HydrationGate";
import usePersistentBooleanPreference from "@/hooks/usePersistentBooleanPreference";
import styles from "./AreaManagement.module.scss";

const INITIAL_FORM = {
  code: "",
  name: "",
  description: "",
  isActive: true,
};

const AREA_FORM_VISIBILITY_PREFERENCE_KEY = "company.areas.formVisible";
function mapAreaToForm(area) {
  return {
    code: area.code || "",
    name: area.name || "",
    description: area.description || "",
    isActive: Boolean(area.isActive),
  };
}

export default function AreaManagement() {
  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [search, setSearch] = useState("");
  const [editingAreaId, setEditingAreaId] = useState("");
  const [isLoadingAreas, setIsLoadingAreas] = useState(true);
  const [notice, setNotice] = useState(null);
  const [isSaving, startSavingTransition] = useTransition();
  const [, startLoadingTransition] = useTransition();
  const noticeExitTimeoutRef = useRef(null);
  const noticeRemoveTimeoutRef = useRef(null);
  const [isFormVisible, setIsFormVisible] = usePersistentBooleanPreference(
    AREA_FORM_VISIBILITY_PREFERENCE_KEY,
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
        const response = await fetch("/api/areas");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo cargar la lista de áreas.");
        }

        setAreas(payload.areas || []);
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
        setIsLoadingAreas(false);
      }
    });
  }, []);

  const filteredAreas = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return areas;
    }

    return areas.filter((area) =>
      [area.code, area.name, area.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [areas, search]);

  const canSubmit = useMemo(() => {
    return Boolean(form.name.trim());
  }, [form.name]);

  async function refreshAreas() {
    setIsLoadingAreas(true);
    const response = await fetch("/api/areas");
    const payload = await response.json();

    if (!response.ok) {
      setIsLoadingAreas(false);
      throw new Error(payload.error || "No se pudo recargar la lista de áreas.");
    }

    setAreas(payload.areas || []);
    setIsLoadingAreas(false);
  }

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setEditingAreaId("");
    setForm(INITIAL_FORM);
    setIsFormVisible(true);
  }

  function handleSubmit(event) {
    event.preventDefault();

    startSavingTransition(async () => {
      try {
        const method = editingAreaId ? "PATCH" : "POST";
        const endpoint = editingAreaId ? `/api/areas/${editingAreaId}` : "/api/areas";
        const response = await fetch(endpoint, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo guardar el área.");
        }

        await refreshAreas();
        showNotice(
          "success",
          editingAreaId
            ? "Área actualizada correctamente."
            : "Área creada correctamente.",
        );
        resetForm();
      } catch (requestError) {
        showNotice("error", requestError.message);
      }
    });
  }

  function handleEdit(area) {
    setEditingAreaId(area.id);
    setForm(mapAreaToForm(area));
    setIsFormVisible(true);
  }

  function handleDelete(area) {
    const confirmed = window.confirm(`¿Deseas eliminar el área "${area.name}"?`);

    if (!confirmed) {
      return;
    }

    startSavingTransition(async () => {
      try {
        const response = await fetch(`/api/areas/${area.id}`, {
          method: "DELETE",
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo eliminar el área.");
        }

        await refreshAreas();
        showNotice("success", "Área eliminada correctamente.");

        if (editingAreaId === area.id) {
          resetForm();
        }
      } catch (requestError) {
        showNotice("error", requestError.message);
      }
    });
  }

  return (
    <HydrationGate fallback={null}>
      {isLoadingAreas ? (
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
                          {editingAreaId ? "Modo edición" : "Nuevo registro"}
                        </p>
                        <h3 className={`catalog-section-title ${styles.formTitle}`}>
                          {editingAreaId ? "Editar área" : "Formulario de área"}
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
                          <span className="catalog-label">Nombre</span>
                          <input
                            value={form.name}
                            onChange={(event) => updateField("name", event.target.value)}
                            className="catalog-input"
                            placeholder="Ej. Administrativa"
                            required
                          />
                        </label>

                        <label className="catalog-field">
                          <span className="catalog-label">Descripción</span>
                          <textarea
                            value={form.description}
                            onChange={(event) => updateField("description", event.target.value)}
                            className="catalog-input"
                            placeholder="Ej. Área transversal para procesos internos y apoyo a la operación."
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
                            <span>{form.isActive ? "Activa" : "Inactiva"}</span>
                          </button>
                        </label>

                        <div className="catalog-actions">
                          <button type="submit" disabled={isSaving || !canSubmit} className="catalog-button-primary">
                            <Plus size={16} />
                            {isSaving ? "Guardando..." : editingAreaId ? "Actualizar" : "Crear"}
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
                      {filteredAreas.length} área{filteredAreas.length === 1 ? "" : "s"}
                      {search.trim() ? ` de ${areas.length}` : ""}
                    </p>
                  </div>

                  <label className="catalog-search">
                    <Search size={16} />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar área"
                      className="catalog-search-input"
                    />
                  </label>

                  <button
                    type="button"
                    className={isFormVisible ? "catalog-button-ghost" : "catalog-button-primary"}
                    onClick={() => setIsFormVisible(!isFormVisible)}
                    aria-expanded={isFormVisible}
                    aria-label={isFormVisible ? "Ocultar formulario" : "Crear área"}
                    title={isFormVisible ? "Ocultar formulario" : "Crear área"}
                  >
                    {isFormVisible ? <EyeOff size={16} /> : <Plus size={16} />}
                  </button>
                </div>

                {filteredAreas.length ? (
                  <div className="catalog-table-shell">
                    <div className="catalog-table-scroll">
                      <table className="catalog-table">
                        <thead>
                          <tr>
                            <th>Área</th>
                            <th>Descripción</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAreas.map((area) => (
                            <tr key={area.id}>
                              <td>
                                <div className={styles.areaIdentity}>
                                  <div className={styles.areaCode}>
                                    <Layers3 size={14} />
                                    {area.code}
                                  </div>
                                  <strong className={styles.areaName}>{area.name}</strong>
                                </div>
                              </td>
                              <td>
                                <div className={styles.areaDescription}>
                                  <span>
                                    <BriefcaseBusiness size={14} style={{ marginRight: "0.42rem", verticalAlign: "text-bottom" }} />
                                    {area.description || "Descripción pendiente"}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span className={`catalog-status-badge ${area.isActive ? "is-active" : "is-inactive"}`}>
                                  {area.isActive ? "Activa" : "Inactiva"}
                                </span>
                              </td>
                              <td>
                                <div className="catalog-row-actions">
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(area)}
                                    className="catalog-icon-button"
                                    title="Editar área"
                                    aria-label={`Editar ${area.name}`}
                                  >
                                    <Edit3 size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(area)}
                                    className="catalog-icon-button danger"
                                    title="Eliminar área"
                                    aria-label={`Eliminar ${area.name}`}
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
                    No encontramos áreas con ese criterio. Si aún no hay registros, crea la primera desde el formulario.
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
