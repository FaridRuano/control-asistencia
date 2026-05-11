"use client";

import { Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import styles from "./LogoutButton.module.scss";

export default function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await fetch("/api/auth/logout", {
        method: "POST",
      });

      router.push("/");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className={styles.button}
    >
      <span className={styles.icon}>
        <Power size={16} />
      </span>
      {isPending ? "Saliendo..." : "Cerrar sesión"}
    </button>
  );
}
