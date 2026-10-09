"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, TrendingUp, TrendingDown, Beef, RefreshCw, AlertTriangle } from "lucide-react";
import { useCachedData, clearDataCache } from "@/lib/use-cached-data";

interface AnimalItem {
  id: string;
  numeroIdentificacao: string;
  status: string;
  pesoAtual: number | null;
  ganhoKg: number | null;
  ganhoPercentual: number | null;
  ultimaPesagem: string | null;
  cicloAtual: number | null;
}

export default function AnimalsPage() {
  // Cache: voltar para a lista de animais é instantâneo.
  const { data: animals, loading, refreshing, refresh, error } = useCachedData<AnimalItem[]>(
    "animals:summary",
    async () => {
      const res = await fetch("/api/animals/summary");
      const data = await res.json();
      return data.map((a: {
          id: string;
          numeroIdentificacao: string;
          status: string;
          ciclos: Array<{
            numeroCiclo: number;
            pesagens: Array<{ pesoKg: number; dataPesagem: string }>;
          }>;
        }) => {
          const activeCycle = a.ciclos[0];
          const cycle = activeCycle;
          const pesos = (cycle?.pesagens || [])
            .map((p: { pesoKg: number }) => p.pesoKg);

          const pesoInicial = pesos.length > 0 ? pesos[0] : null;
          const pesoAtual = pesos.length > 0 ? pesos[pesos.length - 1] : null;
          const ganhoKg =
            pesoInicial !== null && pesoAtual !== null
              ? Number((pesoAtual - pesoInicial).toFixed(2))
              : null;
          const ganhoPercentual =
            pesoInicial !== null && pesoAtual !== null && pesoInicial > 0
              ? Number(
                  (((pesoAtual - pesoInicial) / pesoInicial) * 100).toFixed(2)
                )
              : null;
          const ultimaPesagem =
            cycle?.pesagens.length
              ? cycle.pesagens.reduce(
                  (latest: string, p: { dataPesagem: string }) =>
                    p.dataPesagem > latest ? p.dataPesagem : latest,
                  cycle.pesagens[0].dataPesagem
                )
              : null;

          return {
            id: a.id,
            numeroIdentificacao: a.numeroIdentificacao,
            status: a.status,
            pesoAtual,
            ganhoKg,
            ganhoPercentual,
            ultimaPesagem,
            cicloAtual: activeCycle?.numeroCiclo || null,
          };
        });
    },
    15_000
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = (animals ?? []).filter((a) => {
    const matchSearch =
      !searchQuery ||
      a.numeroIdentificacao.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus =
      filterStatus === "all" || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Animais</h1>
          <p className="text-sm text-muted-foreground">
            {animals?.length ?? 0} animal(ns) cadastrado(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              clearDataCache("animals");
              refresh();
            }}
            className={`rounded-lg p-2 text-muted-foreground hover:bg-accent transition-colors ${
              refreshing ? "animate-spin" : ""
            }`}
            title="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <Link
            href="/animals/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
            onClick={() => clearDataCache("animals")}
          >
            <Plus className="h-4 w-4" />
            Novo Animal
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por número..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Todos</option>
          <option value="ATIVO">Ativos</option>
          <option value="VENDIDO">Vendidos</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error && (animals ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
          <h3 className="font-medium text-lg">Erro ao carregar os animais</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md">
            {error.message} — verifique se o servidor está rodando.
          </p>
          <button
            onClick={() => refresh()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <Beef className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="font-medium">Nenhum animal encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <Link key={a.id} href={`/animals/${a.id}`}>
              <div className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30 cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Boi #{a.numeroIdentificacao}</h3>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.status === "ATIVO"
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  {a.pesoAtual !== null ? (
                    <span className="text-xl font-bold text-primary">
                      {a.pesoAtual.toFixed(1)} kg
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">
                      Sem pesagem
                    </span>
                  )}
                </div>
                {a.ganhoKg !== null && (
                  <div className="flex items-center gap-1">
                    {a.ganhoKg >= 0 ? (
                      <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                    )}
                    <span
                      className={`text-xs font-medium ${
                        a.ganhoKg >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {a.ganhoKg >= 0 ? "+" : ""}
                      {a.ganhoKg.toFixed(1)} kg ({a.ganhoPercentual! >= 0 ? "+" : ""}
                      {a.ganhoPercentual!.toFixed(2)}%)
                    </span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
