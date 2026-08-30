"use client";

import { useState } from "react";
import Link from "next/link";
import { Beef, AlertTriangle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao fazer login");
        return;
      }

      // Success — redirect to home
      window.location.href = "/"; // eslint-disable-line @next/next/no-location-assign-relative-destination
    } catch {
      setError("Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Beef className="h-7 w-7 text-primary" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            Bem-vindo de volta
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Entre na sua conta do GadoManager
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="seu@email.com"
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Não tem conta?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
