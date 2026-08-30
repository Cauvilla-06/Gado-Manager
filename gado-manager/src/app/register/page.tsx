"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Beef, AlertTriangle, Plus, LogIn } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [farmName, setFarmName] = useState("");
  const [farmCode, setFarmCode] = useState("");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload: Record<string, string> = { name, email, password };
      if (mode === "join" && farmCode.trim()) {
        payload.farmCode = farmCode.trim();
      } else {
        payload.farmName = farmName;
      }

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao criar conta");
        return;
      }

      // Auto-login after register
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!loginRes.ok) {
        router.push("/login");
      } else {
        window.location.href = "/"; // eslint-disable-line @next/next/no-location-assign-relative-destination
      }
    } catch {
      setError("Erro ao criar conta");
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
            Criar conta
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comece a gerenciar seu rebanho
          </p>
        </div>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2 rounded-lg border p-1">
          <button
            type="button"
            onClick={() => {
              setMode("create");
              setError("");
            }}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === "create"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Plus className="h-4 w-4" />
            Criar fazenda
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("join");
              setError("");
            }}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === "join"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LogIn className="h-4 w-4" />
            Entrar em fazenda
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Seu nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="João Silva"
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {mode === "create" ? (
            <div>
              <label className="text-sm font-medium">Nome da Fazenda</label>
              <input
                type="text"
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Fazenda São José (opcional)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Uma fazenda será criada para você. Você pode compartilhar o código depois.
              </p>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium">Código da Fazenda *</label>
              <input
                type="text"
                value={farmCode}
                onChange={(e) => setFarmCode(e.target.value)}
                required={mode === "join"}
                className="mt-1 w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring font-mono"
                placeholder="Ex: fazenda-abc123"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Peça o código ao proprietário da fazenda
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading
              ? "Criando conta..."
              : mode === "join"
              ? "Criar conta e entrar na fazenda"
              : "Criar conta"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
