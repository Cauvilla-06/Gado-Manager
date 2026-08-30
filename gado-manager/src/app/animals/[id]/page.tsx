"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Scale,
  Syringe,
  Calendar,
  AlertTriangle,
  FileText,
  RefreshCw,
  Clock,
  CheckCircle,
  Bug,
  Pill,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "@/components/shared/DynamicRecharts";

interface UserData {
  id: string;
  name: string;
}

interface AnimalData {
  id: string;
  numeroIdentificacao: string;
  status: string;
  cicloAtualId: string | null;
  ciclos: Array<{
    id: string;
    numeroCiclo: number;
    status: string;
    dataInicio: string;
    dataFim: string | null;
    observacoes: string | null;
    pesagens: Array<{
      id: string;
      pesoKg: number;
      dataPesagem: string;
      observacao: string | null;
      criadoPor: UserData | null;
    }>;
    vacinas: Array<{
      id: string;
      nomeVacina: string;
      dataAplicacao: string;
      dataProximaDose: string | null;
      lote: string | null;
      observacao: string | null;
      criadoPor: UserData | null;
    }>;
    vermifugos: Array<{
      id: string;
      nomeVermifugo: string;
      dose: string | null;
      dataAplicacao: string;
      dataProximaDose: string | null;
      observacao: string | null;
      criadoPor: UserData | null;
    }>;
    vitaminas: Array<{
      id: string;
      nomeVitamina: string;
      dose: string | null;
      dataAplicacao: string;
      dataProximaDose: string | null;
      observacao: string | null;
      criadoPor: UserData | null;
    }>;
  }>;
}

interface ReportData {
  pesoAtual: number | null;
  pesoInicial: number | null;
  ganhoKg: number | null;
  ganhoPercentual: number | null;
  maiorPeso: number | null;
  menorPeso: number | null;
  mediaPeso: number | null;
  interpretacao: string;
}

export default function AnimalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [animal, setAnimal] = useState<AnimalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSellDialog, setShowSellDialog] = useState(false);
  const [showNewCycleDialog, setShowNewCycleDialog] = useState(false);
  const [showWeightForm, setShowWeightForm] = useState(false);
  const [showVaccineForm, setShowVaccineForm] = useState(false);
  const [showVermifugeForm, setShowVermifugeForm] = useState(false);
  const [showVitaminForm, setShowVitaminForm] = useState(false);
  const [filterPesagens, setFilterPesagens] = useState(true);
  const [filterVacinas, setFilterVacinas] = useState(true);
  const [filterVermifugos, setFilterVermifugos] = useState(true);
  const [filterVitaminas, setFilterVitaminas] = useState(true);
  const [newWeight, setNewWeight] = useState({ pesoKg: "", dataPesagem: "", observacao: "" });
  const [newVaccine, setNewVaccine] = useState({
    nomeVacina: "",
    dataAplicacao: "",
    dataProximaDose: "",
    lote: "",
    observacao: "",
  });
  const [newVermifuge, setNewVermifuge] = useState({
    nomeVermifugo: "",
    dose: "",
    dataAplicacao: "",
    dataProximaDose: "",
    observacao: "",
  });
  const [newVitamin, setNewVitamin] = useState({
    nomeVitamina: "",
    dose: "",
    dataAplicacao: "",
    dataProximaDose: "",
    observacao: "",
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  async function loadAnimal() {
    try {
      const res = await fetch(`/api/animals/${id}`);
      if (!res.ok) throw new Error("Animal não encontrado");
      const data = await res.json();
      setAnimal(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnimal(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCycle = animal?.ciclos.find((c) => c.status === "ATIVO");
  const currentCycle = activeCycle || animal?.ciclos[0];

  function computeReport(cycle: AnimalData["ciclos"][0]): ReportData {
    const pesos = cycle.pesagens.map((p) => p.pesoKg);
    const pesoInicial = pesos.length > 0 ? pesos[0] : null;
    const pesoAtual = pesos.length > 0 ? pesos[pesos.length - 1] : null;
    const ganhoKg =
      pesoInicial !== null && pesoAtual !== null
        ? Number((pesoAtual - pesoInicial).toFixed(2))
        : null;
    const ganhoPercentual =
      pesoInicial !== null && pesoAtual !== null && pesoInicial > 0
        ? Number((((pesoAtual - pesoInicial) / pesoInicial) * 100).toFixed(2))
        : null;
    const maiorPeso = pesos.length > 0 ? Math.max(...pesos) : null;
    const menorPeso = pesos.length > 0 ? Math.min(...pesos) : null;
    const mediaPeso =
      pesos.length > 0
        ? Number((pesos.reduce((a, b) => a + b, 0) / pesos.length).toFixed(2))
        : null;

    let interpretacao = "Dados insuficientes para análise.";
    if (pesoAtual !== null && pesoInicial !== null) {
      if (ganhoKg! > 0) {
        interpretacao = `Peso aumentou ${Math.abs(ganhoKg!)} kg (+${Math.abs(ganhoPercentual!)}%) desde a primeira pesagem.`;
      } else if (ganhoKg! < 0) {
        interpretacao = `Peso reduziu ${Math.abs(ganhoKg!)} kg (${ganhoPercentual}%) desde a primeira pesagem.`;
      } else {
        interpretacao = "Não houve alteração significativa no período analisado.";
      }
    }

    return {
      pesoAtual,
      pesoInicial,
      ganhoKg,
      ganhoPercentual,
      maiorPeso,
      menorPeso,
      mediaPeso,
      interpretacao,
    };
  }

  async function handleSell() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/animals/${id}/sell`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setMessage({ text: "Animal marcado como vendido!", type: "success" });
      setShowSellDialog(false);
      await loadAnimal();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Erro ao vender",
        type: "error",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleNewCycle() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/animals/${id}/cycles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacoes: "" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setMessage({ text: "Novo ciclo iniciado!", type: "success" });
      setShowNewCycleDialog(false);
      await loadAnimal();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Erro ao criar ciclo",
        type: "error",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddWeight(e: React.FormEvent) {
    e.preventDefault();
    if (!currentCycle) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/animals/${id}/weights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cicloId: currentCycle.id,
          pesoKg: parseFloat(newWeight.pesoKg),
          dataPesagem: newWeight.dataPesagem,
          observacao: newWeight.observacao || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setMessage({ text: "Pesagem registrada com sucesso!", type: "success" });
      setShowWeightForm(false);
      setNewWeight({ pesoKg: "", dataPesagem: "", observacao: "" });
      await loadAnimal();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Erro ao registrar pesagem",
        type: "error",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddVaccine(e: React.FormEvent) {
    e.preventDefault();
    if (!currentCycle) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/animals/${id}/vaccinations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cicloId: currentCycle.id,
          nomeVacina: newVaccine.nomeVacina,
          dataAplicacao: newVaccine.dataAplicacao,
          dataProximaDose: newVaccine.dataProximaDose || undefined,
          lote: newVaccine.lote || undefined,
          observacao: newVaccine.observacao || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setMessage({ text: "Vacina registrada com sucesso!", type: "success" });
      setShowVaccineForm(false);
      setNewVaccine({
        nomeVacina: "",
        dataAplicacao: "",
        dataProximaDose: "",
        lote: "",
        observacao: "",
      });
      await loadAnimal();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Erro ao registrar vacina",
        type: "error",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddVermifuge(e: React.FormEvent) {
    e.preventDefault();
    if (!currentCycle) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/animals/${id}/vermifuges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cicloId: currentCycle.id,
          nomeVermifugo: newVermifuge.nomeVermifugo,
          dose: newVermifuge.dose || undefined,
          dataAplicacao: newVermifuge.dataAplicacao,
          dataProximaDose: newVermifuge.dataProximaDose || undefined,
          observacao: newVermifuge.observacao || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setMessage({ text: "Vermífugo registrado com sucesso!", type: "success" });
      setShowVermifugeForm(false);
      setNewVermifuge({ nomeVermifugo: "", dose: "", dataAplicacao: "", dataProximaDose: "", observacao: "" });
      await loadAnimal();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Erro ao registrar vermífugo",
        type: "error",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddVitamin(e: React.FormEvent) {
    e.preventDefault();
    if (!currentCycle) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/animals/${id}/vitamins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cicloId: currentCycle.id,
          nomeVitamina: newVitamin.nomeVitamina,
          dose: newVitamin.dose || undefined,
          dataAplicacao: newVitamin.dataAplicacao,
          dataProximaDose: newVitamin.dataProximaDose || undefined,
          observacao: newVitamin.observacao || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setMessage({ text: "Vitamina registrada com sucesso!", type: "success" });
      setShowVitaminForm(false);
      setNewVitamin({ nomeVitamina: "", dose: "", dataAplicacao: "", dataProximaDose: "", observacao: "" });
      await loadAnimal();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Erro ao registrar vitamina",
        type: "error",
      });
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!animal) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertTriangle className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h2 className="font-medium text-lg">Animal não encontrado</h2>
        <Link href="/" className="mt-4 text-sm text-primary hover:underline">
          Voltar ao dashboard
        </Link>
      </div>
    );
  }

  const report = currentCycle ? computeReport(currentCycle) : null;

  // Chart data
  const chartData = currentCycle?.pesagens
    .sort(
      (a, b) =>
        new Date(a.dataPesagem).getTime() - new Date(b.dataPesagem).getTime()
    )
    .map((p) => ({
      date: new Date(p.dataPesagem).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      peso: p.pesoKg,
    })) || [];

  // Percentual evolution
  const percentualData = currentCycle?.pesagens
    .sort(
      (a, b) =>
        new Date(a.dataPesagem).getTime() - new Date(b.dataPesagem).getTime()
    )
    .map((p, idx, arr) => {
      const base = arr[0].pesoKg;
      const pct =
        base > 0 ? Number((((p.pesoKg - base) / base) * 100).toFixed(2)) : 0;
      return {
        date: new Date(p.dataPesagem).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        percentual: pct,
      };
    }) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Message alert */}
      {message.text && (
        <div
          className={`rounded-lg p-3 text-sm flex items-center justify-between ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {message.text}
          </div>
          <button
            onClick={() => setMessage({ text: "", type: "" })}
            className="ml-2 text-lg leading-none hover:opacity-70"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="rounded-lg p-2 hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              Boi #{animal.numeroIdentificacao}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                animal.status === "ATIVO"
                  ? "bg-green-100 text-green-800"
                  : animal.status === "VENDIDO"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {animal.status}
            </span>
          </div>
          {currentCycle && (
            <p className="text-sm text-muted-foreground">
              Ciclo {currentCycle.numeroCiclo} — Início:{" "}
              {new Date(currentCycle.dataInicio).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      </div>

      {/* Quick action buttons - at the top for faster access */}
      {animal.status === "ATIVO" && currentCycle && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              const today = new Date().toISOString().split("T")[0];
              setNewWeight((prev) => ({ ...prev, dataPesagem: today }));
              setShowWeightForm(true);
              setShowVaccineForm(false);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Scale className="h-4 w-4" />
            Adicionar Pesagem
          </button>
          <button
            onClick={() => {
              const today = new Date().toISOString().split("T")[0];
              setNewVaccine((prev) => ({ ...prev, dataAplicacao: today }));
              setShowVaccineForm(true);
              setShowWeightForm(false);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-600 transition-colors shadow-sm"
          >
            <Syringe className="h-4 w-4" />
            Adicionar Vacina
          </button>
          <button
            onClick={() => {
              const today = new Date().toISOString().split("T")[0];
              setNewVermifuge((prev) => ({ ...prev, dataAplicacao: today }));
              setShowVermifugeForm(true);
              setShowVaccineForm(false);
              setShowWeightForm(false);
              setShowVitaminForm(false);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600 transition-colors shadow-sm"
          >
            <Bug className="h-4 w-4" />
            Adicionar Vermífugo
          </button>
          <button
            onClick={() => {
              const today = new Date().toISOString().split("T")[0];
              setNewVitamin((prev) => ({ ...prev, dataAplicacao: today }));
              setShowVitaminForm(true);
              setShowVaccineForm(false);
              setShowWeightForm(false);
              setShowVermifugeForm(false);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition-colors shadow-sm"
          >
            <Pill className="h-4 w-4" />
            Adicionar Vitamina
          </button>
        </div>
      )}

      {/* Classification filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Exibir:</span>
        {[
          { key: "pesagens", label: "Pesagens", icon: Scale, active: filterPesagens, toggle: () => setFilterPesagens(!filterPesagens) },
          { key: "vacinas", label: "Vacinas", icon: Syringe, active: filterVacinas, toggle: () => setFilterVacinas(!filterVacinas) },
          { key: "vermifugos", label: "Vermífugos", icon: Bug, active: filterVermifugos, toggle: () => setFilterVermifugos(!filterVermifugos) },
          { key: "vitaminas", label: "Vitaminas", icon: Pill, active: filterVitaminas, toggle: () => setFilterVitaminas(!filterVitaminas) },
        ].map((f) => (
          <button
            key={f.key}
            onClick={f.toggle}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              f.active
                ? "bg-primary text-primary-foreground"
                : "border hover:bg-accent text-muted-foreground"
            }`}
          >
            <f.icon className="h-3 w-3" />
            {f.label}
          </button>
        ))}
      </div>

      {/* Inline Weight Form */}
      {showWeightForm && currentCycle && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="font-semibold mb-3">Nova Pesagem</h3>
          <form onSubmit={handleAddWeight} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium">Peso (kg) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={newWeight.pesoKg}
                  onChange={(e) =>
                    setNewWeight((p) => ({ ...p, pesoKg: e.target.value }))
                  }
                  required
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
                  placeholder="Ex: 451.5"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium">Data *</label>
                <input
                  type="date"
                  value={newWeight.dataPesagem}
                  onChange={(e) =>
                    setNewWeight((p) => ({
                      ...p,
                      dataPesagem: e.target.value,
                    }))
                  }
                  required
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Observação</label>
                <input
                  type="text"
                  value={newWeight.observacao}
                  onChange={(e) =>
                    setNewWeight((p) => ({
                      ...p,
                      observacao: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {actionLoading ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => setShowWeightForm(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inline Vaccine Form */}
      {showVaccineForm && currentCycle && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="font-semibold mb-3">Nova Vacina</h3>
          <form onSubmit={handleAddVaccine} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Vacina *</label>
                <input
                  type="text"
                  value={newVaccine.nomeVacina}
                  onChange={(e) =>
                    setNewVaccine((p) => ({
                      ...p,
                      nomeVacina: e.target.value,
                    }))
                  }
                  required
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
                  placeholder="Ex: Febre Aftosa"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium">Data *</label>
                <input
                  type="date"
                  value={newVaccine.dataAplicacao}
                  onChange={(e) =>
                    setNewVaccine((p) => ({
                      ...p,
                      dataAplicacao: e.target.value,
                    }))
                  }
                  required
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Próxima dose</label>
                <input
                  type="date"
                  value={newVaccine.dataProximaDose}
                  onChange={(e) =>
                    setNewVaccine((p) => ({
                      ...p,
                      dataProximaDose: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Lote</label>
                <input
                  type="text"
                  value={newVaccine.lote}
                  onChange={(e) =>
                    setNewVaccine((p) => ({ ...p, lote: e.target.value }))
                  }
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Observação</label>
              <input
                type="text"
                value={newVaccine.observacao}
                onChange={(e) =>
                  setNewVaccine((p) => ({
                    ...p,
                    observacao: e.target.value,
                  }))
                }
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
                placeholder="Opcional"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
              >
                {actionLoading ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => setShowVaccineForm(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inline Vermifuge Form */}
      {showVermifugeForm && currentCycle && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="font-semibold mb-3">Novo Vermífugo</h3>
          <form onSubmit={handleAddVermifuge} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Vermífugo *</label>
                <input
                  type="text"
                  value={newVermifuge.nomeVermifugo}
                  onChange={(e) => setNewVermifuge((p) => ({ ...p, nomeVermifugo: e.target.value }))}
                  required
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
                  placeholder="Ex: Ivomec"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium">Dose</label>
                <input
                  type="text"
                  value={newVermifuge.dose}
                  onChange={(e) => setNewVermifuge((p) => ({ ...p, dose: e.target.value }))}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
                  placeholder="Ex: 10ml"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Data *</label>
                <input
                  type="date"
                  value={newVermifuge.dataAplicacao}
                  onChange={(e) => setNewVermifuge((p) => ({ ...p, dataAplicacao: e.target.value }))}
                  required
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Próxima dose</label>
                <input
                  type="date"
                  value={newVermifuge.dataProximaDose}
                  onChange={(e) => setNewVermifuge((p) => ({ ...p, dataProximaDose: e.target.value }))}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Observação</label>
              <input
                type="text"
                value={newVermifuge.observacao}
                onChange={(e) => setNewVermifuge((p) => ({ ...p, observacao: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
                placeholder="Opcional"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={actionLoading} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                {actionLoading ? "Salvando..." : "Salvar"}
              </button>
              <button type="button" onClick={() => setShowVermifugeForm(false)} className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inline Vitamin Form */}
      {showVitaminForm && currentCycle && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="font-semibold mb-3">Nova Vitamina</h3>
          <form onSubmit={handleAddVitamin} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Vitamina *</label>
                <input
                  type="text"
                  value={newVitamin.nomeVitamina}
                  onChange={(e) => setNewVitamin((p) => ({ ...p, nomeVitamina: e.target.value }))}
                  required
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
                  placeholder="Ex: Vitamina AD"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium">Dose</label>
                <input
                  type="text"
                  value={newVitamin.dose}
                  onChange={(e) => setNewVitamin((p) => ({ ...p, dose: e.target.value }))}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
                  placeholder="Ex: 5ml"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Data *</label>
                <input
                  type="date"
                  value={newVitamin.dataAplicacao}
                  onChange={(e) => setNewVitamin((p) => ({ ...p, dataAplicacao: e.target.value }))}
                  required
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Próxima dose</label>
                <input
                  type="date"
                  value={newVitamin.dataProximaDose}
                  onChange={(e) => setNewVitamin((p) => ({ ...p, dataProximaDose: e.target.value }))}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Observação</label>
              <input
                type="text"
                value={newVitamin.observacao}
                onChange={(e) => setNewVitamin((p) => ({ ...p, observacao: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
                placeholder="Opcional"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={actionLoading} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-50">
                {actionLoading ? "Salvando..." : "Salvar"}
              </button>
              <button type="button" onClick={() => setShowVitaminForm(false)} className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats Cards */}
      {report && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Scale className="h-4 w-4" />
              <span className="text-xs">Peso Atual</span>
            </div>
            <p className="text-2xl font-bold">
              {report.pesoAtual !== null
                ? `${report.pesoAtual.toFixed(1)} kg`
                : "—"}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Scale className="h-4 w-4" />
              <span className="text-xs">Peso Inicial</span>
            </div>
            <p className="text-2xl font-bold">
              {report.pesoInicial !== null
                ? `${report.pesoInicial.toFixed(1)} kg`
                : "—"}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              {report.ganhoKg !== null && report.ganhoKg >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className="text-xs">Ganho</span>
            </div>
            <p
              className={`text-2xl font-bold ${
                report.ganhoKg !== null && report.ganhoKg >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {report.ganhoKg !== null
                ? `${report.ganhoKg >= 0 ? "+" : ""}${report.ganhoKg.toFixed(1)} kg`
                : "—"}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Evolução</span>
            </div>
            <p
              className={`text-2xl font-bold ${
                report.ganhoPercentual !== null && report.ganhoPercentual >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {report.ganhoPercentual !== null
                ? `${report.ganhoPercentual >= 0 ? "+" : ""}${report.ganhoPercentual.toFixed(2)}%`
                : "—"}
            </p>
          </div>
        </div>
      )}

      {/* Interpretation */}
      {report && report.interpretacao && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-sm">{report.interpretacao}</p>
        </div>
      )}

      {/* Additional stats */}
      {report && (report.maiorPeso !== null || report.menorPeso !== null || report.mediaPeso !== null) && (
        <div className="grid grid-cols-3 gap-3">
          {report.maiorPeso !== null && (
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Maior peso</p>
              <p className="font-semibold">{report.maiorPeso.toFixed(1)} kg</p>
            </div>
          )}
          {report.menorPeso !== null && (
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Menor peso</p>
              <p className="font-semibold">{report.menorPeso.toFixed(1)} kg</p>
            </div>
          )}
          {report.mediaPeso !== null && (
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Média</p>
              <p className="font-semibold">{report.mediaPeso.toFixed(1)} kg</p>
            </div>
          )}
        </div>
      )}

      {/* Weight Evolution Chart */}
      {chartData.length > 1 && (
        <div className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-4">Evolução do Peso</h2>
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  domain={["dataMin - 5", "dataMax + 5"]}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(1)} kg`, "Peso"]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    fontSize: "13px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="peso"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={{ fill: "#16a34a", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Percentual Evolution Chart */}
      {percentualData.length > 1 && (
        <div className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-4">Evolução Percentual</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={percentualData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(2)}%`, "Evolução"]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    fontSize: "13px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="percentual"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ fill: "#2563eb", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Weights */}
      {currentCycle && filterPesagens && (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold text-lg">Pesagens</h2>
          </div>

          <div className="divide-y">
            {[...currentCycle.pesagens]
              .sort(
                (a, b) =>
                  new Date(a.dataPesagem).getTime() -
                  new Date(b.dataPesagem).getTime()
              )
              .map((p, idx, sorted) => {
                const prev = idx > 0 ? sorted[idx - 1] : null;
                const variation = prev
                  ? Number((p.pesoKg - prev.pesoKg).toFixed(2))
                  : null;
                const variationPct = prev
                  ? Number(
                      (((p.pesoKg - prev.pesoKg) / prev.pesoKg) * 100).toFixed(2)
                    )
                  : null;

                return (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(p.dataPesagem).toLocaleDateString("pt-BR")}
                        </p>
                        <div className="flex items-center gap-2">
                          {p.observacao && (
                            <p className="text-xs text-muted-foreground">
                              {p.observacao}
                            </p>
                          )}
                          {p.criadoPor && (
                            <p className="text-xs text-muted-foreground">
                              por <span className="font-medium text-foreground/70">{p.criadoPor.name}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{p.pesoKg.toFixed(1)} kg</p>
                      {variation !== null && (
                        <p
                          className={`text-xs font-medium ${
                            variation >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {variation >= 0 ? "+" : ""}
                          {variation.toFixed(1)} kg ({variationPct! >= 0 ? "+" : ""}
                          {variationPct!.toFixed(2)}%)
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

            {currentCycle.pesagens.length === 0 && (
              <div className="flex flex-col items-center py-8 text-center">
                <Scale className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma pesagem registrada neste ciclo.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vaccinations */}
      {currentCycle && filterVacinas && (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold text-lg">Vacinas</h2>
          </div>

          <div className="divide-y">
            {currentCycle.vacinas
              .sort(
                (a, b) =>
                  new Date(b.dataAplicacao).getTime() -
                  new Date(a.dataAplicacao).getTime()
              )
              .map((v) => (
                <div key={v.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Syringe className="h-4 w-4 text-violet-500" />
                      <div>
                        <p className="text-sm font-medium">{v.nomeVacina}</p>
                        <p className="text-xs text-muted-foreground">
                          Aplicada em{" "}
                          {new Date(v.dataAplicacao).toLocaleDateString("pt-BR")}
                          {v.lote && ` • Lote: ${v.lote}`}
                          {v.criadoPor && (
                            <> por <span className="font-medium text-foreground/70">{v.criadoPor.name}</span></>
                          )}
                        </p>
                      </div>
                    </div>
                    {v.dataProximaDose && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          Próxima dose
                        </p>
                        <p className="text-sm font-medium">
                          {new Date(v.dataProximaDose).toLocaleDateString(
                            "pt-BR"
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                  {v.observacao && (
                    <p className="mt-1 ml-7 text-xs text-muted-foreground">
                      {v.observacao}
                    </p>
                  )}
                </div>
              ))}

            {currentCycle.vacinas.length === 0 && (
              <div className="flex flex-col items-center py-8 text-center">
                <Syringe className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma vacina registrada neste ciclo.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vermifuges */}
      {currentCycle && filterVermifugos && currentCycle.vermifugos.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold text-lg">Vermífugos</h2>
          </div>
          <div className="divide-y">
            {currentCycle.vermifugos
              .sort((a, b) => new Date(b.dataAplicacao).getTime() - new Date(a.dataAplicacao).getTime())
              .map((v) => (
                <div key={v.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bug className="h-4 w-4 text-amber-500" />
                      <div>
                        <p className="text-sm font-medium">{v.nomeVermifugo}</p>
                        <p className="text-xs text-muted-foreground">
                          Aplicado em {new Date(v.dataAplicacao).toLocaleDateString("pt-BR")}
                          {v.dose && ` • Dose: ${v.dose}`}
                          {v.criadoPor && (
                            <> por <span className="font-medium text-foreground/70">{v.criadoPor.name}</span></>
                          )}
                        </p>
                      </div>
                    </div>
                    {v.dataProximaDose && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Próxima dose</p>
                        <p className="text-sm font-medium">
                          {new Date(v.dataProximaDose).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    )}
                  </div>
                  {v.observacao && (
                    <p className="mt-1 ml-7 text-xs text-muted-foreground">{v.observacao}</p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Vitamins */}
      {currentCycle && filterVitaminas && currentCycle.vitaminas.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold text-lg">Vitaminas</h2>
          </div>
          <div className="divide-y">
            {currentCycle.vitaminas
              .sort((a, b) => new Date(b.dataAplicacao).getTime() - new Date(a.dataAplicacao).getTime())
              .map((v) => (
                <div key={v.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Pill className="h-4 w-4 text-teal-500" />
                      <div>
                        <p className="text-sm font-medium">{v.nomeVitamina}</p>
                        <p className="text-xs text-muted-foreground">
                          Aplicada em {new Date(v.dataAplicacao).toLocaleDateString("pt-BR")}
                          {v.dose && ` • Dose: ${v.dose}`}
                          {v.criadoPor && (
                            <> por <span className="font-medium text-foreground/70">{v.criadoPor.name}</span></>
                          )}
                        </p>
                      </div>
                    </div>
                    {v.dataProximaDose && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Próxima dose</p>
                        <p className="text-sm font-medium">
                          {new Date(v.dataProximaDose).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    )}
                  </div>
                  {v.observacao && (
                    <p className="mt-1 ml-7 text-xs text-muted-foreground">{v.observacao}</p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/animals/${id}/report`}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <FileText className="h-4 w-4" />
          Gerar Relatório
        </Link>

        <Link
          href={`/animals/${id}/history`}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <Clock className="h-4 w-4" />
          Histórico
        </Link>

        {animal.status === "ATIVO" && (
          <button
            onClick={() => setShowSellDialog(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            <AlertTriangle className="h-4 w-4" />
            Marcar como Vendido
          </button>
        )}

        {animal.status === "VENDIDO" && (
          <button
            onClick={() => setShowNewCycleDialog(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Novo Ciclo
          </button>
        )}
      </div>

      {/* Cycle History - only show if multiple cycles or finished cycles */}
      {animal.ciclos.length > 1 && (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="border-b p-4">
            <h2 className="font-semibold text-lg">Todos os Ciclos</h2>
          </div>
          <div className="divide-y">
            {animal.ciclos.map((cycle) => (
              <div key={cycle.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      Ciclo {cycle.numeroCiclo}
                      <span
                        className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          cycle.status === "ATIVO"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {cycle.status}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Início:{" "}
                      {new Date(cycle.dataInicio).toLocaleDateString("pt-BR")}
                      {cycle.dataFim &&
                        ` — Fim: ${new Date(cycle.dataFim).toLocaleDateString("pt-BR")}`}
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>
                      {cycle.pesagens.length} pesagem(s) • {cycle.vacinas.length}{" "}
                      vacina(s) • {cycle.vermifugos?.length || 0} vermicida(s) • {cycle.vitaminas?.length || 0} vitamina(s)
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sell Confirmation Dialog */}
      {showSellDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSellDialog(false); }}
        >
          <div className="mx-4 w-full max-w-md rounded-xl bg-card p-6 shadow-xl animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Confirmar Venda</h3>
                <p className="text-sm text-muted-foreground">
                  Esta ação é irreversível para o ciclo atual.
                </p>
              </div>
            </div>
            <p className="text-sm mb-6">
              Esta ação encerrará o ciclo atual do animal. O histórico de
              pesagens e vacinas será preservado. Deseja continuar?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSellDialog(false)}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                onClick={handleSell}
                disabled={actionLoading}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {actionLoading ? "Processando..." : "Confirmar Venda"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Cycle Dialog */}
      {showNewCycleDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewCycleDialog(false); }}
        >
          <div className="mx-4 w-full max-w-md rounded-xl bg-card p-6 shadow-xl animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <RefreshCw className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Novo Ciclo</h3>
                <p className="text-sm text-muted-foreground">
                  Iniciar uma nova fase para o animal.
                </p>
              </div>
            </div>
            <p className="text-sm mb-6">
              Isso criará um novo ciclo de acompanhamento para Boi #{animal.numeroIdentificacao}. O
              histórico anterior será preservado.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNewCycleDialog(false)}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                onClick={handleNewCycle}
                disabled={actionLoading}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {actionLoading ? "Criando..." : "Criar Novo Ciclo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
