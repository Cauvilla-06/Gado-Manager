"use client";

import { use } from "react";
import { useCachedData } from "@/lib/use-cached-data";
import Link from "next/link";
import {
  ArrowLeft,
  Scale,
  Syringe,
  ShoppingCart,
  RefreshCw,
  Calendar,
  AlertTriangle,
} from "lucide-react";

interface TimelineEvent {
  id: string;
  tipo: "pesagem" | "vacina" | "venda" | "ciclo_inicio" | "ciclo_fim";
  data: string;
  titulo: string;
  descricao: string;
  ciclo: number;
  icone: React.ElementType;
  cor: string;
}

interface AnimalData {
  id: string;
  numeroIdentificacao: string;
  status: string;
  ciclos: Array<{
    id: string;
    numeroCiclo: number;
    status: string;
    dataInicio: string;
    dataFim: string | null;
    pesagens: Array<{
      id: string;
      pesoKg: number;
      dataPesagem: string;
      observacao: string | null;
      criadoPor: { id: string; name: string } | null;
    }>;
    vacinas: Array<{
      id: string;
      nomeVacina: string;
      dataAplicacao: string;
      dataProximaDose: string | null;
      lote: string | null;
      criadoPor: { id: string; name: string } | null;
    }>;
  }>;
}

export default function HistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  // Mesma chave de cache da ficha do animal: reusa os dados já carregados.
  const {
    data: animal,
    loading,
    error,
  } = useCachedData<AnimalData>(
    `animal:${id}`,
    async () => {
      const res = await fetch(`/api/animals/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    15_000
  );

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!animal && error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="font-medium text-lg">Erro ao carregar o histórico</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md">
          {error.message} — verifique se o servidor está rodando.
        </p>
      </div>
    );
  }

  if (!animal) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Animal não encontrado.</p>
      </div>
    );
  }

  // Build timeline events from all cycles
  const events: TimelineEvent[] = [];

  for (const cycle of animal.ciclos) {
    events.push({
      id: `cycle-${cycle.id}`,
      tipo: "ciclo_inicio",
      data: cycle.dataInicio,
      titulo: `Ciclo ${cycle.numeroCiclo} iniciado`,
      descricao: `Início do ciclo ${cycle.numeroCiclo}`,
      ciclo: cycle.numeroCiclo,
      icone: RefreshCw,
      cor: "bg-blue-100 text-blue-600",
    });

    for (const p of cycle.pesagens) {
      const byStr = p.criadoPor ? ` • por ${p.criadoPor.name}` : "";
      events.push({
        id: p.id,
        tipo: "pesagem",
        data: p.dataPesagem,
        titulo: `${p.pesoKg.toFixed(1)} kg`,
        descricao: (p.observacao || "Pesagem registrada") + byStr,
        ciclo: cycle.numeroCiclo,
        icone: Scale,
        cor: "bg-green-100 text-green-600",
      });
    }

    for (const v of cycle.vacinas) {
      const byStr = v.criadoPor ? ` • por ${v.criadoPor.name}` : "";
      events.push({
        id: v.id,
        tipo: "vacina",
        data: v.dataAplicacao,
        titulo: v.nomeVacina,
        descricao: `Lote: ${v.lote || "N/A"}${
          v.dataProximaDose
            ? ` • Próxima: ${new Date(v.dataProximaDose).toLocaleDateString("pt-BR")}`
            : ""
        }${byStr}`,
        ciclo: cycle.numeroCiclo,
        icone: Syringe,
        cor: "bg-violet-100 text-violet-600",
      });
    }

    if (cycle.dataFim) {
      events.push({
        id: `cycle-end-${cycle.id}`,
        tipo: "ciclo_fim",
        data: cycle.dataFim,
        titulo: `Ciclo ${cycle.numeroCiclo} encerrado`,
        descricao: "Animal vendido",
        ciclo: cycle.numeroCiclo,
        icone: ShoppingCart,
        cor: "bg-amber-100 text-amber-600",
      });
    }
  }

  // Sort by date descending
  events.sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  );

  // Group by year
  const grouped = events.reduce(
    (acc, event) => {
      const year = new Date(event.data).getFullYear().toString();
      if (!acc[year]) acc[year] = [];
      acc[year].push(event);
      return acc;
    },
    {} as Record<string, TimelineEvent[]>
  );

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <Link
        href={`/animals/${id}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao animal
      </Link>

      <h1 className="text-2xl font-bold tracking-tight mb-1">
        Histórico — Boi #{animal.numeroIdentificacao}
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Timeline completa de todas as atividades
      </p>

      {Object.entries(grouped).map(([year, yearEvents]) => (
        <div key={year} className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            {year}
          </h2>
          <div className="relative ml-4 border-l-2 border-muted pl-6 space-y-4">
            {yearEvents.map((event) => {
              const Icon = event.icone;
              return (
                <div key={event.id} className="relative">
                  <div
                    className={`absolute -left-[31px] flex h-8 w-8 items-center justify-center rounded-full ${event.cor}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="rounded-lg border bg-card p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm">{event.titulo}</p>
                      <span className="text-xs text-muted-foreground">
                        Ciclo {event.ciclo}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.data).toLocaleDateString("pt-BR")} —{" "}
                      {event.descricao}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {events.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Nenhum registro no histórico.
          </p>
        </div>
      )}
    </div>
  );
}
