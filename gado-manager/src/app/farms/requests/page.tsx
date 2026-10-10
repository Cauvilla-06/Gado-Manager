"use client";

import { useState } from "react";
import { useCachedData, invalidateDataCache } from "@/lib/use-cached-data";
import Link from "next/link";
import { ArrowLeft, Check, X, Users, Clock } from "lucide-react";

interface JoinRequest {
  id: string;
  status: string;
  message: string | null;
  criadoEm: string;
  user: { id: string; name: string; email: string };
  farm: { id: string; name: string };
}

export default function FarmRequestsPage() {
  // Cache: voltar para esta página é instantâneo; revalida em segundo plano.
  const { data, loading, mutate } = useCachedData<JoinRequest[]>("farm:requests", async () => {
    const res = await fetch("/api/farms/join");
    const body = await res.json();
    if (!res.ok || !Array.isArray(body)) throw new Error(body?.error || "Erro ao carregar pedidos");
    return body;
  });
  const requests = data ?? [];
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(requestId: string, action: "APROVADO" | "REJEITADO") {
    setProcessingId(requestId);
    try {
      const res = await fetch(`/api/farms/join/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        mutate((prev) => (prev ?? []).filter((r) => r.id !== requestId));
        // Contador do menu e lista de membros mudaram
        invalidateDataCache("session");
        invalidateDataCache("farm:members");
        setError(null);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Erro ao processar pedido");
      }
    } catch (err) {
      console.error(err);
      setError("Erro ao processar pedido");
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="rounded-lg p-2 hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Pedidos de Entrada
          </h1>
          <p className="text-sm text-muted-foreground">
            {requests.length} pedido(s) pendente(s)
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="font-medium text-lg">Nenhum pedido pendente</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Quando alguém solicitar entrada na sua fazenda, aparecerá aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{req.user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {req.user.email}
                      </p>
                    </div>
                  </div>
                  {req.message && (
                    <p className="mt-2 ml-10 text-sm text-muted-foreground italic">
                      &ldquo;{req.message}&rdquo;
                    </p>
                  )}
                  <p className="mt-2 ml-10 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(req.criadoEm).toLocaleDateString("pt-BR")} às{" "}
                    {new Date(req.criadoEm).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleAction(req.id, "APROVADO")}
                    disabled={processingId === req.id}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                    title="Aprovar"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleAction(req.id, "REJEITADO")}
                    disabled={processingId === req.id}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                    title="Rejeitar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
