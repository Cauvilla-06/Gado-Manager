"use client";

import { useState, use } from "react";
import { useCachedData } from "@/lib/use-cached-data";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Table, Scale, Syringe, Bug, Pill } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { downloadCsv } from "@/lib/csv";

interface ReportData {
  animal: {
    id: string;
    numeroIdentificacao: string;
    status: string;
  };
  cicloAtual: {
    id: string;
    numeroCiclo: number;
    status: string;
    dataInicio: string;
    dataFim: string | null;
  };
  pesoAtual: number | null;
  pesoInicial: number | null;
  ganhoKg: number | null;
  ganhoPercentual: number | null;
  maiorPeso: number | null;
  menorPeso: number | null;
  mediaPeso: number | null;
  totalPesagens: number;
  totalVacinas: number;
  totalVermifugos: number;
  totalVitaminas: number;
  pesagens: Array<{
    id: string;
    pesoKg: number;
    dataPesagem: string;
    observacao: string | null;
  }>;
  vacinas: Array<{
    id: string;
    nomeVacina: string;
    dataAplicacao: string;
    dataProximaDose: string | null;
    lote: string | null;
    observacao: string | null;
  }>;
  vermifugos: Array<{
    id: string;
    nomeVermifugo: string;
    dose: string | null;
    dataAplicacao: string;
    dataProximaDose: string | null;
    observacao: string | null;
  }>;
  vitaminas: Array<{
    id: string;
    nomeVitamina: string;
    dose: string | null;
    dataAplicacao: string;
    dataProximaDose: string | null;
    observacao: string | null;
  }>;
  interpretacao: string;
  dataGeracao: string;
}

const PIE_COLORS = ["#16a34a", "#2563eb", "#f59e0b", "#8b5cf6"];

export default function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  // Chave "animal:<id>:report": a ficha do boi limpa "animal:" ao lançar um
  // registro, então o relatório nunca fica desatualizado.
  const { data: report, loading } = useCachedData<ReportData>(`animal:${id}:report`, async () => {
    const res = await fetch(`/api/animals/${id}/report`);
    if (!res.ok) throw new Error("Failed to load report");
    return res.json();
  });
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [showPesagens, setShowPesagens] = useState(true);
  const [showVacinas, setShowVacinas] = useState(true);
  const [showVermifugos, setShowVermifugos] = useState(true);
  const [showVitaminas, setShowVitaminas] = useState(true);

  function getFilteredPesagens(pesagens: ReportData["pesagens"]) {
    if (selectedPeriod === "all") return pesagens;
    const days = selectedPeriod === "7d" ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return pesagens.filter((p) => new Date(p.dataPesagem) >= cutoff);
  }

  async function exportPDF() {
    if (!report) return;
    // Bibliotecas pesadas carregadas só no clique (a página abre bem mais rápido)
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório do Animal", pageWidth / 2, y, { align: "center" });
    y += 10;
    doc.setFontSize(14);
    doc.text(`Boi #${report.animal.numeroIdentificacao}`, pageWidth / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Ciclo ${report.cicloAtual.numeroCiclo}`, pageWidth / 2, y, { align: "center" });
    y += 8;

    const now = new Date();
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(
      `Relatório gerado em: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      pageWidth / 2,
      y,
      { align: "center" }
    );
    y += 12;

    // Summary
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Resumo", 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const summaryData = [
      ["Peso Inicial", report.pesoInicial !== null ? `${report.pesoInicial.toFixed(1)} kg` : "—"],
      ["Peso Atual", report.pesoAtual !== null ? `${report.pesoAtual.toFixed(1)} kg` : "—"],
      ["Ganho", report.ganhoKg !== null ? `${report.ganhoKg >= 0 ? "+" : ""}${report.ganhoKg.toFixed(1)} kg` : "—"],
      ["Ganho %", report.ganhoPercentual !== null ? `${report.ganhoPercentual >= 0 ? "+" : ""}${report.ganhoPercentual.toFixed(2)}%` : "—"],
      ["Maior Peso", report.maiorPeso !== null ? `${report.maiorPeso.toFixed(1)} kg` : "—"],
      ["Menor Peso", report.menorPeso !== null ? `${report.menorPeso.toFixed(1)} kg` : "—"],
      ["Média", report.mediaPeso !== null ? `${report.mediaPeso.toFixed(1)} kg` : "—"],
      ["Total Pesagens", String(report.totalPesagens)],
      ["Total Vacinas", String(report.totalVacinas)],
      ["Total Vermífugos", String(report.totalVermifugos)],
      ["Total Vitaminas", String(report.totalVitaminas)],
    ];

    autoTable(doc, {
      startY: y,
      head: [["Métrica", "Valor"]],
      body: summaryData,
      theme: "grid",
      headStyles: { fillColor: [22, 163, 74] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });

    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 12;

    // Weight table
    if (showPesagens && report.pesagens.length > 0) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Pesagens", 14, y);
      y += 6;

      const weightRows = report.pesagens.map((p, idx) => {
        const prev = idx > 0 ? report.pesagens[idx - 1] : null;
        const variation = prev ? (p.pesoKg - prev.pesoKg).toFixed(1) : "—";
        const variationPct = prev
          ? (((p.pesoKg - prev.pesoKg) / prev.pesoKg) * 100).toFixed(2) + "%"
          : "—";
        return [
          new Date(p.dataPesagem).toLocaleDateString("pt-BR"),
          `${p.pesoKg.toFixed(1)} kg`,
          `${variation} kg`,
          variationPct,
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [["Data", "Peso", "Variação", "Variação %"]],
        body: weightRows,
        theme: "grid",
        headStyles: { fillColor: [22, 163, 74] },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });

      y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 12;
    }

    // Vaccines table
    if (showVacinas && report.vacinas.length > 0) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Vacinas", 14, y);
      y += 6;

      const vaccineRows = report.vacinas.map((v) => [
        v.nomeVacina,
        new Date(v.dataAplicacao).toLocaleDateString("pt-BR"),
        v.dataProximaDose
          ? new Date(v.dataProximaDose).toLocaleDateString("pt-BR")
          : "—",
        v.lote || "—",
        v.observacao || "—",
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Vacina", "Data", "Próxima Dose", "Lote", "Observação"]],
        body: vaccineRows,
        theme: "grid",
        headStyles: { fillColor: [139, 92, 246] },
        styles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });

      y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 12;
    }

    // Vermifuge table
    if (showVermifugos && report.vermifugos.length > 0) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Vermífugos", 14, y);
      y += 6;

      const vermifugeRows = report.vermifugos.map((v) => [
        v.nomeVermifugo,
        v.dose || "—",
        new Date(v.dataAplicacao).toLocaleDateString("pt-BR"),
        v.dataProximaDose
          ? new Date(v.dataProximaDose).toLocaleDateString("pt-BR")
          : "—",
        v.observacao || "—",
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Vermífugo", "Dose", "Data", "Próxima Dose", "Observação"]],
        body: vermifugeRows,
        theme: "grid",
        headStyles: { fillColor: [245, 158, 11] },
        styles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });

      y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 12;
    }

    // Vitamin table
    if (showVitaminas && report.vitaminas.length > 0) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Vitaminas", 14, y);
      y += 6;

      const vitaminRows = report.vitaminas.map((v) => [
        v.nomeVitamina,
        v.dose || "—",
        new Date(v.dataAplicacao).toLocaleDateString("pt-BR"),
        v.dataProximaDose
          ? new Date(v.dataProximaDose).toLocaleDateString("pt-BR")
          : "—",
        v.observacao || "—",
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Vitamina", "Dose", "Data", "Próxima Dose", "Observação"]],
        body: vitaminRows,
        theme: "grid",
        headStyles: { fillColor: [20, 184, 166] },
        styles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });

      y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 12;
    }

    // Analysis
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Análise", 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(report.interpretacao, pageWidth - 28);
    doc.text(lines, 14, y);

    doc.save(
      `relatorio_boi_${report.animal.numeroIdentificacao}_ciclo_${report.cicloAtual.numeroCiclo}_${now.toISOString().split("T")[0]}.pdf`
    );
  }

  function exportCSV() {
    if (!report) return;
    const headers = ["Data", "Peso (kg)", "Variação", "Variação %"];
    const rows = report.pesagens.map((p, idx) => {
      const prev = idx > 0 ? report.pesagens[idx - 1] : null;
      const variation = prev ? (p.pesoKg - prev.pesoKg).toFixed(1) : "";
      const variationPct = prev
        ? (((p.pesoKg - prev.pesoKg) / prev.pesoKg) * 100).toFixed(2) + "%"
        : "";
      return [
        new Date(p.dataPesagem).toLocaleDateString("pt-BR"),
        p.pesoKg.toFixed(1),
        variation,
        variationPct,
      ];
    });

    downloadCsv(
      `relatorio_boi_${report.animal.numeroIdentificacao}_ciclo_${report.cicloAtual.numeroCiclo}.csv`,
      [headers, ...rows]
    );
  }

  async function exportXLSX() {
    if (!report) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    // Pesagens sheet
    if (showPesagens) {
      const weightData = report.pesagens.map((p, idx) => {
        const prev = idx > 0 ? report.pesagens[idx - 1] : null;
        return {
          Data: new Date(p.dataPesagem).toLocaleDateString("pt-BR"),
          "Peso (kg)": p.pesoKg,
          "Variação (kg)": prev ? (p.pesoKg - prev.pesoKg).toFixed(1) : "",
          "Variação (%)": prev
            ? (((p.pesoKg - prev.pesoKg) / prev.pesoKg) * 100).toFixed(2) + "%"
            : "",
          Observação: p.observacao || "",
        };
      });
      const ws1 = XLSX.utils.json_to_sheet(weightData);
      XLSX.utils.book_append_sheet(wb, ws1, "Pesagens");
    }

    // Vacinas sheet
    if (showVacinas) {
      const vaccineData = report.vacinas.map((v) => ({
        Vacina: v.nomeVacina,
        Data: new Date(v.dataAplicacao).toLocaleDateString("pt-BR"),
        "Próxima Dose": v.dataProximaDose
          ? new Date(v.dataProximaDose).toLocaleDateString("pt-BR")
          : "",
        Lote: v.lote || "",
        Observação: v.observacao || "",
      }));
      const ws2 = XLSX.utils.json_to_sheet(vaccineData);
      XLSX.utils.book_append_sheet(wb, ws2, "Vacinas");
    }

    // Vermifugos sheet
    if (showVermifugos && report.vermifugos.length > 0) {
      const vermifugeData = report.vermifugos.map((v) => ({
        "Vermífugo": v.nomeVermifugo,
        "Dose": v.dose || "",
        "Data": new Date(v.dataAplicacao).toLocaleDateString("pt-BR"),
        "Próxima Dose": v.dataProximaDose
          ? new Date(v.dataProximaDose).toLocaleDateString("pt-BR")
          : "",
        "Observação": v.observacao || "",
      }));
      const ws3 = XLSX.utils.json_to_sheet(vermifugeData);
      XLSX.utils.book_append_sheet(wb, ws3, "Vermífugos");
    }

    // Vitaminas sheet
    if (showVitaminas && report.vitaminas.length > 0) {
      const vitaminData = report.vitaminas.map((v) => ({
        "Vitamina": v.nomeVitamina,
        "Dose": v.dose || "",
        "Data": new Date(v.dataAplicacao).toLocaleDateString("pt-BR"),
        "Próxima Dose": v.dataProximaDose
          ? new Date(v.dataProximaDose).toLocaleDateString("pt-BR")
          : "",
        "Observação": v.observacao || "",
      }));
      const ws4 = XLSX.utils.json_to_sheet(vitaminData);
      XLSX.utils.book_append_sheet(wb, ws4, "Vitaminas");
    }

    XLSX.writeFile(
      wb,
      `relatorio_boi_${report.animal.numeroIdentificacao}_ciclo_${report.cicloAtual.numeroCiclo}.xlsx`
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Relatório não encontrado.</p>
      </div>
    );
  }

  const now = new Date();
  const chartData = getFilteredPesagens(report.pesagens)
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
    }));

  const percentualData = getFilteredPesagens(report.pesagens)
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
    });

  // Pie chart: weight distribution
  const weightPieData =
    report.pesagens.length > 0
      ? [
          {
            name: "Peso Inicial",
            value: report.pesoInicial ?? 0,
          },
          {
            name: "Maior Peso",
            value: report.maiorPeso ?? 0,
          },
          {
            name: "Menor Peso",
            value: report.menorPeso ?? 0,
          },
          {
            name: "Peso Atual",
            value: report.pesoAtual ?? 0,
          },
        ].filter((d) => d.value > 0)
      : [];

  // Pie chart: vaccine distribution
  const vaccinePieData = report.vacinas.reduce(
    (acc, v) => {
      const existing = acc.find((a) => a.name === v.nomeVacina);
      if (existing) existing.value++;
      else acc.push({ name: v.nomeVacina, value: 1 });
      return acc;
    },
    [] as Array<{ name: string; value: number }>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <Link
        href={`/animals/${id}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao animal
      </Link>

      {/* Report Header */}
      <div className="rounded-xl border bg-card p-6 shadow-sm text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Relatório do Animal
        </h1>
        <p className="text-lg mt-1">Boi #{report.animal.numeroIdentificacao}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Ciclo {report.cicloAtual.numeroCiclo}
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          Relatório gerado em:{" "}
          {now.toLocaleDateString("pt-BR")} às{" "}
          {now.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* Export buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={exportPDF}
          className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
        >
          <FileText className="h-4 w-4" />
          PDF
        </button>
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          <Download className="h-4 w-4" />
          CSV
        </button>
        <button
          onClick={exportXLSX}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          <Table className="h-4 w-4" />
          XLSX
        </button>
      </div>

      {/* Classification filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Exibir no relatório:</span>
        {[
          { label: "Pesagens", icon: Scale, active: showPesagens, toggle: () => setShowPesagens(!showPesagens) },
          { label: "Vacinas", icon: Syringe, active: showVacinas, toggle: () => setShowVacinas(!showVacinas) },
          { label: "Vermífugos", icon: Bug, active: showVermifugos, toggle: () => setShowVermifugos(!showVermifugos) },
          { label: "Vitaminas", icon: Pill, active: showVitaminas, toggle: () => setShowVitaminas(!showVitaminas) },
        ].map((f, i) => (
          <button
            key={i}
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

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm text-center">
          <p className="text-xs text-muted-foreground">Peso Inicial</p>
          <p className="text-xl font-bold">
            {report.pesoInicial !== null ? `${report.pesoInicial.toFixed(1)} kg` : "—"}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm text-center">
          <p className="text-xs text-muted-foreground">Peso Atual</p>
          <p className="text-xl font-bold">
            {report.pesoAtual !== null ? `${report.pesoAtual.toFixed(1)} kg` : "—"}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm text-center">
          <p className="text-xs text-muted-foreground">Ganho</p>
          <p
            className={`text-xl font-bold ${
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
        <div className="rounded-xl border bg-card p-4 shadow-sm text-center">
          <p className="text-xs text-muted-foreground">Evolução</p>
          <p
            className={`text-xl font-bold ${
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

      {/* Additional Stats */}
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

      {/* Interpretation */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-sm">{report.interpretacao}</p>
      </div>

      {/* Period Filter */}
      <div className="flex gap-2">
        {[
          { value: "7d", label: "Últimos 7 dias" },
          { value: "30d", label: "Últimos 30 dias" },
          { value: "all", label: "Todo o ciclo" },
        ].map((p) => (
          <button
            key={p.value}
            onClick={() => setSelectedPeriod(p.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedPeriod === p.value
                ? "bg-primary text-primary-foreground"
                : "border hover:bg-accent"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Charts */}
      {showPesagens && chartData.length > 1 && (
        <div className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-4">Evolução do Peso</h2>
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(1)} kg`, "Peso"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                />
                <Line type="monotone" dataKey="peso" stroke="#16a34a" strokeWidth={2} dot={{ fill: "#16a34a", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Weight Pie Chart (segment) */}
      {showPesagens && weightPieData.length > 0 && (
        <div className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-4">Composição de Pesos</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={weightPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                  }
                >
                  {weightPieData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(1)} kg`, "Peso"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Vaccine Pie Chart (segment) */}
      {showVacinas && vaccinePieData.length > 0 && (
        <div className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-4">Distribuição de Vacinas</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={vaccinePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                  }
                >
                  {vaccinePieData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${String(value)} aplicação(ões)`, "Quantidade"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {showPesagens && percentualData.length > 1 && (
        <div className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-4">Evolução Percentual</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={percentualData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(2)}%`, "Evolução"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                />
                <Line type="monotone" dataKey="percentual" stroke="#2563eb" strokeWidth={2} dot={{ fill: "#2563eb", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Weight Table */}
      {showPesagens && report.pesagens.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
          <div className="border-b p-4">
            <h2 className="font-semibold text-lg">Pesagens</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Data</th>
                <th className="px-4 py-2 text-right font-medium">Peso</th>
                <th className="px-4 py-2 text-right font-medium">Variação</th>
                <th className="px-4 py-2 text-right font-medium">Variação %</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.pesagens
                .sort(
                  (a, b) =>
                    new Date(b.dataPesagem).getTime() -
                    new Date(a.dataPesagem).getTime()
                )
                .map((p, idx) => {
                  const realIdx = report.pesagens.length - 1 - idx;
                  const prev = realIdx > 0 ? report.pesagens[realIdx - 1] : null;
                  const variation = prev
                    ? (p.pesoKg - prev.pesoKg).toFixed(1)
                    : null;
                  const variationPct = prev
                    ? (((p.pesoKg - prev.pesoKg) / prev.pesoKg) * 100).toFixed(2)
                    : null;

                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-2">
                        {new Date(p.dataPesagem).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {p.pesoKg.toFixed(1)} kg
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-medium ${
                          variation !== null
                            ? Number(variation) >= 0
                              ? "text-green-600"
                              : "text-red-600"
                            : ""
                        }`}
                      >
                        {variation !== null
                          ? `${Number(variation) >= 0 ? "+" : ""}${variation} kg`
                          : "—"}
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-medium ${
                          variationPct !== null
                            ? Number(variationPct) >= 0
                              ? "text-green-600"
                              : "text-red-600"
                            : ""
                        }`}
                      >
                        {variationPct !== null
                          ? `${Number(variationPct) >= 0 ? "+" : ""}${variationPct}%`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Vaccine Table */}
      {showVacinas && report.vacinas.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
          <div className="border-b p-4">
            <h2 className="font-semibold text-lg">Vacinas</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Vacina</th>
                <th className="px-4 py-2 text-left font-medium">Data</th>
                <th className="px-4 py-2 text-left font-medium">Próxima Dose</th>
                <th className="px-4 py-2 text-left font-medium">Lote</th>
                <th className="px-4 py-2 text-left font-medium">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.vacinas.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-2 font-medium">{v.nomeVacina}</td>
                  <td className="px-4 py-2">
                    {new Date(v.dataAplicacao).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-2">
                    {v.dataProximaDose
                      ? new Date(v.dataProximaDose).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-4 py-2">{v.lote || "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {v.observacao || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Vermifuge Table */}
      {showVermifugos && report.vermifugos.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
          <div className="border-b p-4">
            <h2 className="font-semibold text-lg">Vermífugos</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Vermífugo</th>
                <th className="px-4 py-2 text-left font-medium">Dose</th>
                <th className="px-4 py-2 text-left font-medium">Data</th>
                <th className="px-4 py-2 text-left font-medium">Próxima Dose</th>
                <th className="px-4 py-2 text-left font-medium">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.vermifugos.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-2 font-medium">{v.nomeVermifugo}</td>
                  <td className="px-4 py-2">{v.dose || "—"}</td>
                  <td className="px-4 py-2">
                    {new Date(v.dataAplicacao).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-2">
                    {v.dataProximaDose
                      ? new Date(v.dataProximaDose).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {v.observacao || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Vitamin Table */}
      {showVitaminas && report.vitaminas.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
          <div className="border-b p-4">
            <h2 className="font-semibold text-lg">Vitaminas</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Vitamina</th>
                <th className="px-4 py-2 text-left font-medium">Dose</th>
                <th className="px-4 py-2 text-left font-medium">Data</th>
                <th className="px-4 py-2 text-left font-medium">Próxima Dose</th>
                <th className="px-4 py-2 text-left font-medium">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.vitaminas.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-2 font-medium">{v.nomeVitamina}</td>
                  <td className="px-4 py-2">{v.dose || "—"}</td>
                  <td className="px-4 py-2">
                    {new Date(v.dataAplicacao).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-2">
                    {v.dataProximaDose
                      ? new Date(v.dataProximaDose).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {v.observacao || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
