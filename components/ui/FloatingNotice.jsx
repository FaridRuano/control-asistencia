"use client";

import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

import useClientReady from "@/hooks/useClientReady";
import styles from "./FloatingNotice.module.scss";

export default function FloatingNotice({ notice, onClose }) {
  const canRenderPortal = useClientReady();

  if (!canRenderPortal || !notice) {
    return null;
  }

  return createPortal(
    <div
      className={`${styles.toast} ${notice.isLeaving ? styles.toastLeaving : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className={styles.toastIcon}>
        {notice.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      </div>
      <div className={styles.toastContent}>
        <p className={styles.toastTitle}>
          {notice.type === "success" ? "Operación exitosa" : "Algo necesita atención"}
        </p>
        <p className={styles.toastMessage}>{notice.message}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className={styles.toastClose}
        aria-label="Cerrar aviso"
      >
        <X size={16} />
      </button>
    </div>,
    document.body,
  );
}
