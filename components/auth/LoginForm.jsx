"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setError("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: formData.get("username"),
            password: formData.get("password"),
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo iniciar sesión.");
        }

        router.push("/uploads");
        router.refresh();
      } catch (requestError) {
        setError(requestError.message);
      }
    });
  }

  return (
    <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-8">
      <p className="text-sm font-medium uppercase tracking-[0.32em] text-[var(--primary)]">
        Iniciar sesión
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
        Ingresa con la cuenta autorizada
      </h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Las credenciales se validan contra valores definidos en el entorno del servidor.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Usuario
          </span>
          <input
            name="username"
            type="text"
            autoComplete="username"
            required
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[var(--primary)] focus:ring-4 focus:ring-emerald-100"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Clave
          </span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[var(--primary)] focus:ring-4 focus:ring-emerald-100"
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-w-44 items-center justify-center rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Validando..." : "Entrar"}
        </button>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}
      </form>
    </section>
  );
}
