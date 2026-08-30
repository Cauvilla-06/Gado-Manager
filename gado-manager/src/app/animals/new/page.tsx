"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function NewAnimalPage() {
  const router = useRouter();
  const [numero, setNumero] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/animals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeroIdentificacao: numero.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao cadastrar animal");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/animals/${data.animal.id}`);
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar animal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg animate-fade-in">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao dashboard
      </Link>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight mb-1">
          Novo Animal
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Cadastre um novo animal no sistema
        </p>

        {success ? (
          <div className="flex flex-col items-center py-8">
            <CheckCircle className="h-12 w-12 text-primary mb-3" />
            <p className="font-medium">Animal cadastrado com sucesso!</p>
            <p className="text-sm text-muted-foreground">
              Redirecionando...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="numero"
                className="block text-sm font-medium mb-1.5"
              >
                Número de Identificação *
              </label>
              <input
                id="numero"
                type="text"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ex: 001, 157, A-42"
                required
                className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Número único para identificação do animal
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !numero.trim()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4" />
              {loading ? "Cadastrando..." : "Cadastrar Animal"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
