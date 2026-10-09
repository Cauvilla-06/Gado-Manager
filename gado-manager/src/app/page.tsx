"use client";

import { useState, useMemo } from "react";
import { useCachedData, clearDataCache } from "@/lib/use-cached-data";
import Link from "next/link";
import {
  Plus,
  TrendingUp,
  RefreshCw,
  TrendingDown,
  Beef,
  Syringe,
  BarChart3,
  Search,
  ShoppingCart,
  AlertTriangle,
} from "lucide-react";

interface DashboardStats {
  totalAtivos: number;
  totalVendidos: number;
  totalPesagens: number;
  totalVacinas: number;
}

interface AnimalListItem {
  id: string;
  numeroIdentificacao: string;
  status: string;
  pesoAtual: number | null;
  pesoInicial: number | null;
  ganhoKg: number | null;
  ganhoPercentual: number | null;
  ultimaPesagem: string | null;
  cicloAtual: number | null;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        </div>
      </div>
    </div>
  );
}

function AnimalCard({ animal }: { animal: AnimalListItem }) {
  const isActive = animal.status === "ATIVO";
  const ganho = animal.ganhoKg;
  const ganhoPct = animal.ganhoPercentual;

  return (
    <Link href={`/animals/${animal.id}`}>
      <div className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30 cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-lg">
              Boi #{animal.numeroIdentificacao}
            </h3>
            {animal.cicloAtual && (
              <p className="text-xs text-muted-foreground">
                Ciclo {animal.cicloAtual}
              </p>
            )}
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isActive
                ? "bg-green-100 text-green-800"
                : animal.status === "VENDIDO"
                ? "bg-amber-100 text-amber-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {animal.status}
          </span>
        </div>

        {animal.pesoAtual !== null && (
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary">
                {animal.pesoAtual.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">kg</span>
            </div>

            {ganho !== null && ganhoPct !== null && (
              <div className="flex items-center gap-2">
                {ganho >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span
                  className={`text-sm font-medium ${
                    ganho >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {ganho >= 0 ? "+" : ""}
                  {ganho.toFixed(1)} kg ({ganhoPct >= 0 ? "+" : ""}
                  {ganhoPct.toFixed(2)}%)
                </span>
              </div>
            )}

            {animal.ultimaPesagem && (
              <p className="text-xs text-muted-foreground">
                Última pesagem:{" "}
                {new Date(animal.ultimaPesagem).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        )}

        {animal.pesoAtual === null && (
          <p className="text-sm text-muted-foreground italic">
            Nenhuma pesagem registrada
          </p>
        )}
      </div>
    </Link>
  );
}

export default function HomePage() {
  // Dados em cache: navegar de volta ao dashboard é instantâneo.
  const { data, loading, refreshing, refresh, error } = useCachedData<{
    stats: { totalAtivos: number; totalVendidos: number };
    animals: AnimalListItem[];
  }>(
    "dashboard:stats",
    async () => {
      const res = await fetch("/api/dashboard/stats");
      const d = res.ok
        ? await res.json()
        : { stats: { totalAtivos: 0, totalVendidos: 0 }, animals: [] };
      return {
        stats: {
          totalAtivos: d.stats.totalAtivos,
          totalVendidos: d.stats.totalVendidos,
        },
        animals: d.animals,
      };
    },
    15_000
  );

  const stats: DashboardStats | null = data
    ? {
        totalAtivos: data.stats.totalAtivos,
        totalVendidos: data.stats.totalVendidos,
        totalPesagens: 0,
        totalVacinas: 0,
      }
    : null;
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const filteredAnimals = useMemo(() => {
    const animals = data?.animals ?? [];
    return animals.filter((a) => {
      const matchesSearch =
        !searchQuery ||
        a.numeroIdentificacao.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        filterStatus === "all" || a.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [data, searchQuery, filterStatus]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <h3 className="font-medium text-lg">Erro ao carregar o dashboard</h3>
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
    );
  }


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral do rebanho
          </p>
        </div>
        <button
          onClick={() => {
            clearDataCache("dashboard");
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
          onClick={() => clearDataCache("dashboard")}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Animal</span>
          <span className="sm:hidden">Novo</span>
        </Link>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
          <StatCard
            label="Ativos"
            value={stats.totalAtivos}
            icon={Beef}
            color="bg-primary"
          />
          <StatCard
            label="Vendidos"
            value={stats.totalVendidos}
            icon={ShoppingCart}
            color="bg-amber-500"
          />
          <StatCard
            label="Pesagens"
            value={stats.totalPesagens}
            icon={BarChart3}
            color="bg-blue-500"
          />
          <StatCard
            label="Vacinas"
            value={stats.totalVacinas}
            icon={Syringe}
            color="bg-violet-500"
          />
        </div>
      )}

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

      {filteredAnimals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Beef className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-lg">Nenhum animal encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {searchQuery || filterStatus !== "all"
              ? "Tente ajustar os filtros de busca."
              : "Comece cadastrando seu primeiro animal."}
          </p>
          {!searchQuery && filterStatus === "all" && (
            <Link
              href="/animals/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Cadastrar Animal
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAnimals.map((animal) => (
            <AnimalCard key={animal.id} animal={animal} />
          ))}
        </div>
      )}
    </div>
  );
}
