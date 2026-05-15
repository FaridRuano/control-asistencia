"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Building2,
  EyeOff,
  Edit3,
  Landmark,
  MapPin,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import CatalogPageLoader from "@/components/catalog/CatalogPageLoader";
import FloatingNotice from "@/components/ui/FloatingNotice";
import HydrationGate from "@/components/ui/HydrationGate";
import usePersistentBooleanPreference from "@/hooks/usePersistentBooleanPreference";
import styles from "./BranchManagement.module.scss";

const INITIAL_FORM = {
  code: "",
  name: "",
  city: "",
  address: "",
  isActive: true,
};

const BRANCH_FORM_VISIBILITY_PREFERENCE_KEY = "company.branches.formVisible";

function mapBranchToForm(branch) {
  return {
    code: branch.code || "",
    name: branch.name || "",
    city: branch.city || "",
    address: branch.address || "",
    isActive: Boolean(branch.isActive),
  };
}

export default function BranchManagement() {
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [search, setSearch] = useState("");
  const [editingBranchId, setEditingBranchId] = useState("");
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [notice, setNotice] = useState(null);
  const [isSaving, startSavingTransition] = useTransition();
  const [, startLoadingTransition] = useTransition();
  const noticeExitTimeoutRef = useRef(null);
  const noticeRemoveTimeoutRef = useRef(null);
  const [isFormVisible, setIsFormVisible] = usePersistentBooleanPreference(
    BRANCH_FORM_VISIBILITY_PREFERENCE_KEY,
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
        const response = await fetch("/api/branches");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo cargar la lista de sucursales.");
        }

        setBranches(payload.branches || []);
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
        setIsLoadingBranches(false);
      }
    });
  }, []);

  const filteredBranches = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return branches;
    }

    return branches.filter((branch) =>
      [branch.code, branch.name, branch.city, branch.address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [branches, search]);
  const canSubmit = useMemo(() => {
    return Boolean(form.name.trim());
  }, [form.name]);

  async function refreshBranches() {
    setIsLoadingBranches(true);
    const response = await fetch("/api/branches");
    const payload = await response.json();

    if (!response.ok) {
      setIsLoadingBranches(false);
      throw new Error(payload.error || "No se pudo recargar la lista de sucursales.");
    }

    setBranches(payload.branches || []);
    setIsLoadingBranches(false);
  }

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setEditingBranchId("");
    setForm(INITIAL_FORM);
    setIsFormVisible(true);
  }

  function handleSubmit(event) {
    event.preventDefault();

    startSavingTransition(async () => {
      try {
        const method = editingBranchId ? "PATCH" : "POST";
        const endpoint = editingBranchId ? `/api/branches/${editingBranchId}` : "/api/branches";
        const response = await fetch(endpoint, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo guardar la sucursal.");
        }

        await refreshBranches();
        showNotice(
          "success",
          editingBranchId
            ? "Sucursal actualizada correctamente."
            : "Sucursal creada correctamente.",
        );
        resetForm();
      } catch (requestError) {
        showNotice("error", requestError.message);
      }
    });
  }

  function handleEdit(branch) {
    setEditingBranchId(branch.id);
    setForm(mapBranchToForm(branch));
    setIsFormVisible(true);
  }

  function handleDelete(branch) {
    const confirmed = window.confirm(`¿Deseas eliminar la sucursal "${branch.name}"?`);

    if (!confirmed) {
      return;
    }

    startSavingTransition(async () => {
      try {
        const response = await fetch(`/api/branches/${branch.id}`, {
          method: "DELETE",
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo eliminar la sucursal.");
        }

        await refreshBranches();
        showNotice("success", "Sucursal eliminada correctamente.");

        if (editingBranchId === branch.id) {
          resetForm();
        }
      } catch (requestError) {
        showNotice("error", requestError.message);
      }
    });
  }

  return (
    <HydrationGate fallback={null}>
      {isLoadingBranches ? (
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
                          {editingBranchId ? "Modo edición" : "Nuevo registro"}
                        </p>
                        <h3 className={`catalog-section-title ${styles.formTitle}`}>
                          {editingBranchId ? "Editar sucursal" : "Formulario de sucursal"}
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
                            placeholder="Ej. Ambato matriz"
                            required
                          />
                        </label>

                        <label className="catalog-field">
                          <span className="catalog-label">Ciudad</span>
                          <input
                            value={form.city}
                            onChange={(event) => updateField("city", event.target.value)}
                            className="catalog-input"
                            placeholder="Ej. Ambato"
                          />
                        </label>

                        <label className="catalog-field">
                          <span className="catalog-label">Dirección</span>
                          <input
                            value={form.address}
                            onChange={(event) => updateField("address", event.target.value)}
                            className="catalog-input"
                            placeholder="Ej. Av. principal y calle secundaria"
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
                            {isSaving ? "Guardando..." : editingBranchId ? "Actualizar" : "Crear"}
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
                      {filteredBranches.length} sucursal{filteredBranches.length === 1 ? "" : "es"}
                      {search.trim() ? ` de ${branches.length}` : ""}
                    </p>
                  </div>

                  <label className="catalog-search">
                    <Search size={16} />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar sucursal"
                      className="catalog-search-input"
                    />
                  </label>

                  <button
                    type="button"
                    className={isFormVisible ? "catalog-button-ghost" : "catalog-button-primary"}
                    onClick={() => setIsFormVisible(!isFormVisible)}
                    aria-expanded={isFormVisible}
                    aria-label={isFormVisible ? "Ocultar formulario" : "Crear sucursal"}
                    title={isFormVisible ? "Ocultar formulario" : "Crear sucursal"}
                  >
                    {isFormVisible ? <EyeOff size={16} /> : <Plus size={16} />}
                  </button>
                </div>

                {filteredBranches.length ? (
                  <div className="catalog-table-shell">
                    <div className="catalog-table-scroll">
                      <table className="catalog-table">
                        <thead>
                          <tr>
                            <th>Sucursal</th>
                            <th>Ubicación</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBranches.map((branch) => (
                            <tr key={branch.id}>
                              <td>
                                <div className={styles.branchIdentity}>
                                  <div className={styles.branchCode}>
                                    <Landmark size={14} />
                                    {branch.code}
                                  </div>
                                  <strong className={styles.branchName}>{branch.name}</strong>
                                </div>
                              </td>
                              <td>
                                <div className={styles.locationStack}>
                                  <span className={styles.locationItem}>
                                    <Building2 size={14} />
                                    {branch.city || "Ciudad pendiente"}
                                  </span>
                                  <span className={styles.locationItem}>
                                    <MapPin size={14} />
                                    {branch.address || "Dirección pendiente"}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span className={`catalog-status-badge ${branch.isActive ? "is-active" : "is-inactive"}`}>
                                  {branch.isActive ? "Activa" : "Inactiva"}
                                </span>
                              </td>
                              <td>
                                <div className="catalog-row-actions">
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(branch)}
                                    className="catalog-icon-button"
                                    title="Editar sucursal"
                                    aria-label={`Editar ${branch.name}`}
                                  >
                                    <Edit3 size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(branch)}
                                    className="catalog-icon-button danger"
                                    title="Eliminar sucursal"
                                    aria-label={`Eliminar ${branch.name}`}
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
                    No encontramos sucursales con ese criterio. Si aún no hay registros, crea la primera desde el
                    formulario.
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
