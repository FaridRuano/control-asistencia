"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertCircle,
  Clock3,
  CheckCircle2,
  FileSpreadsheet,
  Inbox,
  History,
  Upload,
  X,
} from "lucide-react";
import styles from "./UploadAttendanceForm.module.scss";

const ACCEPTED_EXTENSIONS = [".xls", ".xlsx"];
const ACCEPTED_FILES_LABEL = ACCEPTED_EXTENSIONS.join(", ");
const STATUS_LABELS = {
  uploaded: "Cargado",
  processing: "Procesando",
  processed: "Procesado",
  failed: "Fallido",
};

function hasValidExcelExtension(fileName) {
  const normalizedName = String(fileName || "").toLowerCase();
  return ACCEPTED_EXTENSIONS.some((extension) => normalizedName.endsWith(extension));
}

function formatFileSize(bytes) {
  if (!bytes) {
    return "0 KB";
  }

  const sizeInKb = bytes / 1024;

  if (sizeInKb < 1024) {
    return `${sizeInKb.toFixed(1)} KB`;
  }

  return `${(sizeInKb / 1024).toFixed(2)} MB`;
}

function formatDateTime(value) {
  if (!value) {
    return "N/D";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "N/D";
  }

  return format(parsed, "dd/MM/yyyy HH:mm", { locale: es });
}

function formatUploadStatus(status) {
  return STATUS_LABELS[status] || status || "N/D";
}

export default function UploadAttendanceForm() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [savedUpload, setSavedUpload] = useState(null);
  const [uploadsHistory, setUploadsHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const isUploadLocked = Boolean(savedUpload);

  function showToast(type, message) {
    setToast({ type, message });

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 5000);
  }

  function applySelectedFile(file) {
    if (isUploadLocked) {
      return;
    }

    if (!file) {
      return;
    }

    if (!hasValidExcelExtension(file.name)) {
      showToast("error", "Solo se permiten archivos .xls o .xlsx.");
      return;
    }

    setToast(null);
    setSavedUpload(null);
    setSelectedFile(file);
  }

  function handleInputChange(event) {
    applySelectedFile(event.target.files?.[0] || null);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);

    if (isUploadLocked) {
      return;
    }

    applySelectedFile(event.dataTransfer.files?.[0] || null);
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!selectedFile) {
      showToast("error", "Selecciona un archivo .xls o .xlsx para continuar.");
      return;
    }

    setToast(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const request = await fetch("/api/attendance/upload", {
          method: "POST",
          body: formData,
        });

        const payload = await request.json();

        if (!request.ok) {
          throw new Error(payload.error || "No se pudo guardar el archivo.");
        }

        setSavedUpload(payload.upload || null);
        setUploadsHistory((current) => [payload.upload, ...current].slice(0, 20));
        showToast("success", payload.message || "Archivo guardado correctamente.");
        setSelectedFile(null);

        if (inputRef.current) {
          inputRef.current.value = "";
        }
      } catch (submissionError) {
        setSavedUpload(null);
        showToast("error", submissionError.message);
      }
    });
  }

  useEffect(() => {
    let isCancelled = false;

    async function fetchUploadsHistory() {
      try {
        if (!isCancelled) {
          setIsHistoryLoading(true);
        }

        const response = await fetch("/api/attendance/upload");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo cargar el historial.");
        }

        if (!isCancelled) {
          setUploadsHistory(payload.uploads || []);
        }
      } catch (historyError) {
        if (!isCancelled) {
          showToast("error", historyError.message);
        }
      } finally {
        if (!isCancelled) {
          setIsHistoryLoading(false);
        }
      }
    }

    fetchUploadsHistory();

    return () => {
      isCancelled = true;

      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      {toast ? (
        <div
          className={`${styles.toast} ${
            toast.type === "success" ? styles.toastSuccess : styles.toastError
          }`}
          role="status"
          aria-live="polite"
        >
          <div className={styles.toastIcon}>
            {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          </div>
          <div className={styles.toastContent}>
            <p className={styles.toastTitle}>
              {toast.type === "success" ? "Archivo guardado" : "Algo necesita atención"}
            </p>
            <p className={styles.toastMessage}>{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className={styles.toastClose}
            aria-label="Cerrar notificación"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      <section className={styles.panel}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.header}>
            <p className={styles.eyebrow}>Subir archivo</p>
            <h2 className={styles.title}>Guarda el reporte original del biométrico</h2>
            <p className={styles.description}>
              Arrastra el archivo `InOutHorizontalReport` a esta zona, confirma la carga y lo guardaremos completo en la base de datos para recuperarlo y procesarlo después.
            </p>
          </div>

          <div
            className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ""} ${
              isUploadLocked ? styles.dropzoneLocked : ""
            }`}
            onDragOver={(event) => {
              if (isUploadLocked) {
                return;
              }

              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => {
              if (!isUploadLocked) {
                inputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={isUploadLocked ? -1 : 0}
            aria-disabled={isUploadLocked}
            onKeyDown={(event) => {
              if (isUploadLocked) {
                return;
              }

              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
          >
            <div className={styles.dropzoneIcon}>
              {selectedFile ? <FileSpreadsheet size={26} /> : <Inbox size={26} />}
            </div>
            <span className={styles.fieldTitle}>
              {isUploadLocked
                ? "Archivo guardado en la base de datos"
                : selectedFile
                  ? "Archivo listo para guardar"
                  : "Arrastra tu archivo Excel aquí"}
            </span>
            <span className={styles.fieldHint}>
              {isUploadLocked
                ? "La carga quedó cerrada para evitar reemplazos accidentales desde esta misma vista."
                : selectedFile
                  ? "Revisa el archivo seleccionado y luego confirma el guardado."
                  : `También puedes hacer clic para buscarlo. Permitidos: ${ACCEPTED_FILES_LABEL}`}
            </span>

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_FILES_LABEL}
              onChange={handleInputChange}
              className={styles.fileInput}
              disabled={isUploadLocked}
            />
          </div>

          {selectedFile && !isUploadLocked ? (
            <div className={styles.selectedFileCard}>
              <div className={styles.selectedFileIcon}>
                <FileSpreadsheet size={18} />
              </div>
              <div className={styles.selectedFileContent}>
                <p className={styles.selectedFileName}>{selectedFile.name}</p>
                <p className={styles.selectedFileMeta}>
                  {formatFileSize(selectedFile.size)} · {selectedFile.type || "Tipo no disponible"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setToast(null);

                  if (inputRef.current) {
                    inputRef.current.value = "";
                  }
                }}
                className={styles.removeFileButton}
                aria-label="Quitar archivo"
              >
                <X size={16} />
              </button>
            </div>
          ) : null}

          <div className={styles.actions}>
            <button
              type="submit"
              disabled={!selectedFile || isPending || isUploadLocked}
              className={styles.submit}
            >
              <Upload size={16} />
              {isPending ? "Guardando archivo..." : "Confirmar guardado"}
            </button>
          </div>
        </form>

        {savedUpload ? (
          <div className={styles.stack}>
            <div className={styles.summaryGrid}>
              {[
                { label: "Archivo", value: savedUpload.fileName || "N/D" },
                { label: "Estado", value: formatUploadStatus(savedUpload.status) },
                { label: "Tamaño", value: formatFileSize(savedUpload.fileSize || 0) },
                { label: "Guardado", value: formatDateTime(savedUpload.createdAt) },
              ].map((item) => (
                <div key={item.label} className={styles.summaryCard}>
                  <p className={styles.summaryLabel}>{item.label}</p>
                  <p className={styles.summaryValueSmall}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className={styles.historySection}>
          <div className={styles.historyHeader}>
            <div>
              <p className={styles.eyebrow}>Historial</p>
              <h3 className={styles.historyTitle}>Archivos cargados recientemente</h3>
            </div>
            <div className={styles.historyBadge}>
              <History size={16} />
              <span>{uploadsHistory.length}</span>
            </div>
          </div>

          {isHistoryLoading ? (
            <div className={styles.historyEmpty}>
              <Clock3 size={16} />
              <span>Cargando historial de archivos...</span>
            </div>
          ) : uploadsHistory.length ? (
            <div className={styles.historyList}>
              {uploadsHistory.map((upload) => (
                <article key={upload.id} className={styles.historyItem}>
                  <div className={styles.historyItemMain}>
                    <p className={styles.historyFileName}>{upload.fileName}</p>
                    <p className={styles.historyMeta}>
                      {formatFileSize(upload.fileSize || 0)} · {formatDateTime(upload.createdAt)}
                    </p>
                  </div>
                  <div className={styles.historyItemSide}>
                    <span className={styles.historyStatus}>{formatUploadStatus(upload.status)}</span>
                    <Link href={`/dashboard/uploads/${upload.id}`} className={styles.historyAction}>
                      {upload.hasNormalization ? "Abrir revisión" : "Abrir y revisar"}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.historyEmpty}>
              <FileSpreadsheet size={16} />
              <span>Todavía no hay archivos cargados en el historial.</span>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
