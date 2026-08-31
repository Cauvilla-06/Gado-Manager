"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { BarChart3, TrendingUp, Beef, FileText, Download, Table, ChevronDown, ChevronRight, Syringe } from "lucide-react";

import {
  PieChart as PieChartComponent,
  Pie as PieComponent,
  Cell as CellComponent,
  Tooltip as TooltipComponent,
  ResponsiveContainer as ResponsiveContainerComponent,
} from "@/components/shared/DynamicRecharts";

interface GeneralReport {
  totalAnimais: number;
  pesoInicialMedio: number;
  pesoAtualMedio: number;
  ganhoMedio: number;
  maiorGanho: number;
  menorGanho: number;
  animais: Array<{
    animal: {
      id: string;
      numeroIdentificacao: string;
      status: string;
    };
    cycle: {
      numeroCiclo: number;
    };
    pesoInicial: number | null;
    pesoAtual: number | null;
    ganhoKg: number | null;
    ganhoPercentual: number | null;
    totalPesagens: number;
    totalVacinas: number;
    totalVermifugos: number;
    totalVitaminas: number;
    pesagensDetalhes: Array<{
      id: string;
      pesoKg: number;
      dataPesagem: string;
    }>;
    vacinas: Array<{
      id: string;
      nome: string;
      dataAplicacao: string;
      dataProximaDose: string | null;
      lote: string | null;
    }>;
    vermifugos: Array<{
      id: string;
      nome: string;
      dose: string | null;
      dataAplicacao: string;
      dataProximaDose: string | null;
    }>;
    vitaminas: Array<{
      id: string;
      nome: string;
      dose: string | null;
      dataAplicacao: string;
      dataProximaDose: string | null;
    }>;
  }>;
}

const PIE_COLORS = ["#16a34a", "#2563eb", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function ReportsPage() {
  const [report, setReport] = useState<GeneralReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sectionFilters, setSectionFilters] = useState({
    cards: true,
    statusChart: true,
    gainChart: true,
    weightChart: true,
    table: true,
  });
  const [classFilters, setClassFilters] = useState({
    pesagens: true,
    vacinas: true,
    vermifugos: true,
    vitaminas: true,
  });
  const [expandedAnimais, setExpandedAnimais] = useState<Set<string>>(new Set());

  function toggleExpanded(animalId: string) {
    setExpandedAnimais((prev) => {
      const next = new Set(prev);
      if (next.has(animalId)) next.delete(animalId);
      else next.add(animalId);
      return next;
    });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function toggleSection(key: keyof typeof sectionFilters) {
    setSectionFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);
        const res = await fetch(`/api/reports/general?${params}`);
        if (!res.ok) {
          setReport(null);
        } else {
          setReport(await res.json());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [statusFilter]);

  const animais = report?.animais ?? [];

  // Pie chart data: distribution by gain ranges
  const gainDistribution =
    animais
      .filter((a) => a.ganhoKg !== null)
      .reduce(
        (acc, a) => {
          const gain = a.ganhoKg!;
          if (gain > 50) acc[0].value++;
          else if (gain > 20) acc[1].value++;
          else if (gain > 0) acc[2].value++;
          else if (gain === 0) acc[3].value++;
          else acc[4].value++;
          return acc;
        },
        [
          { name: "> 50 kg", value: 0 },
          { name: "20-50 kg", value: 0 },
          { name: "0-20 kg", value: 0 },
          { name: "Sem ganho", value: 0 },
          { name: "Perda", value: 0 },
        ]
      )
      .filter((d) => d.value > 0) || [];

  // Pie chart: distribution by status
  const statusDistribution = animais.length > 0
    ? [
        { name: "Ativos", value: animais.filter((a) => a.animal.status === "ATIVO").length },
        { name: "Vendidos", value: animais.filter((a) => a.animal.status === "VENDIDO").length },
      ].filter((d) => d.value > 0)
    : [];

  // Pie chart: weight per animal (for segment visualization)
  const weightData =
    animais
      .filter((a) => a.pesoAtual !== null)
      .sort((a, b) => b.pesoAtual! - a.pesoAtual!)
      .slice(0, 8)
      .map((a) => ({
        name: `#${a.animal.numeroIdentificacao}`,
        value: a.pesoAtual!,
      })) || [];

  async function exportPDF() {
    if (!report) return;
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF("landscape");
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório Geral do Rebanho", pageWidth / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    const now = new Date();
    doc.text(
      `Gerado em: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      pageWidth / 2,
      y,
      { align: "center" }
    );
    y += 10;

    // Summary
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Resumo Geral", 14, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const summaryData = [
      ["Total de Animais", String(report.totalAnimais)],
      ["Peso Inicial Médio", report.pesoInicialMedio > 0 ? `${report.pesoInicialMedio.toFixed(1)} kg` : "—"],
      ["Peso Atual Médio", report.pesoAtualMedio > 0 ? `${report.pesoAtualMedio.toFixed(1)} kg` : "—"],
      ["Ganho Médio", report.ganhoMedio > 0 ? `+${report.ganhoMedio.toFixed(1)} kg` : "—"],
      ["Maior Ganho", report.maiorGanho > 0 ? `+${report.maiorGanho.toFixed(1)} kg` : "—"],
      ["Menor Ganho", report.menorGanho !== 0 ? `${report.menorGanho.toFixed(1)} kg` : "—"],
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

    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;

    // Animal details table
    if (report.animais.length > 0) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Detalhes por Animal", 14, y);
      y += 6;

      const tableHeaders: string[] = ["Animal", "Ciclo"];
      if (classFilters.pesagens) tableHeaders.push("Peso Inicial", "Peso Atual", "Ganho", "Ganho %");
      tableHeaders.push("Pesagens");
      if (classFilters.vacinas) tableHeaders.push("Vacinas");
      if (classFilters.vermifugos) tableHeaders.push("Vermífugos");
      if (classFilters.vitaminas) tableHeaders.push("Vitaminas");

      const animalRows = report.animais.map((a) => {
        const row: string[] = [
          `Boi #${a.animal.numeroIdentificacao}`,
          String(a.cycle.numeroCiclo),
        ];
        if (classFilters.pesagens) {
          row.push(
            a.pesoInicial !== null ? `${a.pesoInicial.toFixed(1)} kg` : "—",
            a.pesoAtual !== null ? `${a.pesoAtual.toFixed(1)} kg` : "—",
            a.ganhoKg !== null ? `${a.ganhoKg >= 0 ? "+" : ""}${a.ganhoKg.toFixed(1)} kg` : "—",
            a.ganhoPercentual !== null ? `${a.ganhoPercentual >= 0 ? "+" : ""}${a.ganhoPercentual.toFixed(2)}%` : "—",
          );
        }
        row.push(String(a.totalPesagens));
        if (classFilters.vacinas) row.push(String(a.totalVacinas ?? 0));
        if (classFilters.vermifugos) row.push(String(a.totalVermifugos ?? 0));
        if (classFilters.vitaminas) row.push(String(a.totalVitaminas ?? 0));
        return row;
      });

      autoTable(doc, {
        startY: y,
        head: [tableHeaders],
        body: animalRows,
        theme: "grid",
        headStyles: { fillColor: [22, 163, 74] },
        styles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });
    }

    // Detailed vaccines table
    if (classFilters.vacinas) {
      const vacinaRows = report.animais.flatMap((a) =>
        a.vacinas.map((v) => [
          `Boi #${a.animal.numeroIdentificacao}`,
          v.nome,
          formatDate(v.dataAplicacao),
          v.dataProximaDose ? formatDate(v.dataProximaDose) : "—",
          v.lote ?? "—",
        ])
      );
      if (vacinaRows.length > 0) {
        doc.addPage();
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Vacinas Aplicadas", 14, 15);
        autoTable(doc, {
          startY: 21,
          head: [["Animal", "Vacina", "Data Aplicação", "Próxima Dose", "Lote"]],
          body: vacinaRows,
          theme: "grid",
          headStyles: { fillColor: [139, 92, 246] },
          styles: { fontSize: 8 },
          margin: { left: 14, right: 14 },
        });
      }
    }

    // Detailed vermifuges table
    if (classFilters.vermifugos) {
      const vermRows = report.animais.flatMap((a) =>
        a.vermifugos.map((v) => [
          `Boi #${a.animal.numeroIdentificacao}`,
          v.nome,
          v.dose ?? "—",
          formatDate(v.dataAplicacao),
          v.dataProximaDose ? formatDate(v.dataProximaDose) : "—",
        ])
      );
      if (vermRows.length > 0) {
        if (classFilters.vacinas && report.animais.some((a) => a.vacinas.length > 0)) {
          doc.addPage();
        }
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Vermífugos Aplicados", 14, 15);
        autoTable(doc, {
          startY: 21,
          head: [["Animal", "Vermífugo", "Dose", "Data Aplicação", "Próxima Dose"]],
          body: vermRows,
          theme: "grid",
          headStyles: { fillColor: [245, 158, 11] },
          styles: { fontSize: 8 },
          margin: { left: 14, right: 14 },
        });
      }
    }

    // Detailed vitamins table
    if (classFilters.vitaminas) {
      const vitRows = report.animais.flatMap((a) =>
        a.vitaminas.map((v) => [
          `Boi #${a.animal.numeroIdentificacao}`,
          v.nome,
          v.dose ?? "—",
          formatDate(v.dataAplicacao),
          v.dataProximaDose ? formatDate(v.dataProximaDose) : "—",
        ])
      );
      if (vitRows.length > 0) {
        doc.addPage();
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Vitaminas Aplicadas", 14, 15);
        autoTable(doc, {
          startY: 21,
          head: [["Animal", "Vitamina", "Dose", "Data Aplicação", "Próxima Dose"]],
          body: vitRows,
          theme: "grid",
          headStyles: { fillColor: [20, 184, 166] },
          styles: { fontSize: 8 },
          margin: { left: 14, right: 14 },
        });
      }
    }

    // Detailed weight history table
    if (classFilters.pesagens) {
      const pesoRows = report.animais.flatMap((a) =>
        a.pesagensDetalhes.map((p) => [
          `Boi #${a.animal.numeroIdentificacao}`,
          `${p.pesoKg.toFixed(1)} kg`,
          formatDate(p.dataPesagem),
        ])
      );
      if (pesoRows.length > 0) {
        doc.addPage();
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Histórico de Pesagens", 14, 15);
        autoTable(doc, {
          startY: 21,
          head: [["Animal", "Peso", "Data da Pesagem"]],
          body: pesoRows,
          theme: "grid",
          headStyles: { fillColor: [22, 163, 74] },
          styles: { fontSize: 8 },
          margin: { left: 14, right: 14 },
        });
      }
    }

    doc.save(`relatorio_geral_rebanho_${now.toISOString().split("T")[0]}.pdf`);
  }

  function exportCSV() {
    if (!report) return;
    const csvHeaders: string[] = ["Animal", "Ciclo"];
    if (classFilters.pesagens) csvHeaders.push("Peso Inicial", "Peso Atual", "Ganho", "Ganho %");
    csvHeaders.push("Pesagens");
    if (classFilters.vacinas) csvHeaders.push("Vacinas");
    if (classFilters.vermifugos) csvHeaders.push("Vermífugos");
    if (classFilters.vitaminas) csvHeaders.push("Vitaminas");

    const rows = report.animais.map((a) => {
      const row: string[] = [
        `Boi #${a.animal.numeroIdentificacao}`,
        String(a.cycle.numeroCiclo),
      ];
      if (classFilters.pesagens) {
        row.push(
          a.pesoInicial !== null ? a.pesoInicial.toFixed(1) : "",
          a.pesoAtual !== null ? a.pesoAtual.toFixed(1) : "",
          a.ganhoKg !== null ? a.ganhoKg.toFixed(1) : "",
          a.ganhoPercentual !== null ? a.ganhoPercentual.toFixed(2) + "%" : "",
        );
      }
      row.push(String(a.totalPesagens));
      if (classFilters.vacinas) row.push(String(a.totalVacinas ?? 0));
      if (classFilters.vermifugos) row.push(String(a.totalVermifugos ?? 0));
      if (classFilters.vitaminas) row.push(String(a.totalVitaminas ?? 0));
      return row;
    });

    const csvLines: string[][] = [csvHeaders, ...rows];

    // Detailed sections
    if (classFilters.vacinas) {
      csvLines.push([]);
      csvLines.push(["=== VACINAS APLICADAS ==="]);
      csvLines.push(["Animal", "Vacina", "Data Aplicação", "Próxima Dose", "Lote"]);
      report.animais.forEach((a) =>
        a.vacinas.forEach((v) =>
          csvLines.push([
            `Boi #${a.animal.numeroIdentificacao}`,
            v.nome,
            formatDate(v.dataAplicacao),
            v.dataProximaDose ? formatDate(v.dataProximaDose) : "",
            v.lote ?? "",
          ])
        )
      );
    }
    if (classFilters.vermifugos) {
      csvLines.push([]);
      csvLines.push(["=== VERMÍFUGOS APLICADOS ==="]);
      csvLines.push(["Animal", "Vermífugo", "Dose", "Data Aplicação", "Próxima Dose"]);
      report.animais.forEach((a) =>
        a.vermifugos.forEach((v) =>
          csvLines.push([
            `Boi #${a.animal.numeroIdentificacao}`,
            v.nome,
            v.dose ?? "",
            formatDate(v.dataAplicacao),
            v.dataProximaDose ? formatDate(v.dataProximaDose) : "",
          ])
        )
      );
    }
    if (classFilters.vitaminas) {
      csvLines.push([]);
      csvLines.push(["=== VITAMINAS APLICADAS ==="]);
      csvLines.push(["Animal", "Vitamina", "Dose", "Data Aplicação", "Próxima Dose"]);
      report.animais.forEach((a) =>
        a.vitaminas.forEach((v) =>
          csvLines.push([
            `Boi #${a.animal.numeroIdentificacao}`,
            v.nome,
            v.dose ?? "",
            formatDate(v.dataAplicacao),
            v.dataProximaDose ? formatDate(v.dataProximaDose) : "",
          ])
        )
      );
    }
    if (classFilters.pesagens) {
      csvLines.push([]);
      csvLines.push(["=== HISTÓRICO DE PESAGENS ==="]);
      csvLines.push(["Animal", "Peso (kg)", "Data da Pesagem"]);
      report.animais.forEach((a) =>
        a.pesagensDetalhes.forEach((p) =>
          csvLines.push([
            `Boi #${a.animal.numeroIdentificacao}`,
            p.pesoKg.toFixed(1),
            formatDate(p.dataPesagem),
          ])
        )
      );
    }

    const csv = csvLines.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_geral_rebanho.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportXLSX() {
    if (!report) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const data = report.animais.map((a) => {
      const row: Record<string, unknown> = {
        Animal: `Boi #${a.animal.numeroIdentificacao}`,
        Status: a.animal.status,
        Ciclo: a.cycle.numeroCiclo,
      };
      if (classFilters.pesagens) {
        row["Peso Inicial (kg)"] = a.pesoInicial;
        row["Peso Atual (kg)"] = a.pesoAtual;
        row["Ganho (kg)"] = a.ganhoKg;
        row["Ganho (%)"] = a.ganhoPercentual;
      }
      row["Pesagens"] = a.totalPesagens;
      if (classFilters.vacinas) row["Vacinas"] = a.totalVacinas ?? 0;
      if (classFilters.vermifugos) row["Vermífugos"] = a.totalVermifugos ?? 0;
      if (classFilters.vitaminas) row["Vitaminas"] = a.totalVitaminas ?? 0;
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Relatório Geral");

    // Detail sheets per category
    if (classFilters.vacinas) {
      const vacinasData = report.animais.flatMap((a) =>
        a.vacinas.map((v) => ({
          Animal: `Boi #${a.animal.numeroIdentificacao}`,
          Vacina: v.nome,
          "Data Aplicação": formatDate(v.dataAplicacao),
          "Próxima Dose": v.dataProximaDose ? formatDate(v.dataProximaDose) : "",
          Lote: v.lote ?? "",
        }))
      );
      if (vacinasData.length > 0) {
        const wsV = XLSX.utils.json_to_sheet(vacinasData);
        wsV["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsV, "Vacinas");
      }
    }
    if (classFilters.vermifugos) {
      const vermData = report.animais.flatMap((a) =>
        a.vermifugos.map((v) => ({
          Animal: `Boi #${a.animal.numeroIdentificacao}`,
          Vermífugo: v.nome,
          Dose: v.dose ?? "",
          "Data Aplicação": formatDate(v.dataAplicacao),
          "Próxima Dose": v.dataProximaDose ? formatDate(v.dataProximaDose) : "",
        }))
      );
      if (vermData.length > 0) {
        const wsVm = XLSX.utils.json_to_sheet(vermData);
        wsVm["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsVm, "Vermífugos");
      }
    }
    if (classFilters.vitaminas) {
      const vitData = report.animais.flatMap((a) =>
        a.vitaminas.map((v) => ({
          Animal: `Boi #${a.animal.numeroIdentificacao}`,
          Vitamina: v.nome,
          Dose: v.dose ?? "",
          "Data Aplicação": formatDate(v.dataAplicacao),
          "Próxima Dose": v.dataProximaDose ? formatDate(v.dataProximaDose) : "",
        }))
      );
      if (vitData.length > 0) {
        const wsVi = XLSX.utils.json_to_sheet(vitData);
        wsVi["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsVi, "Vitaminas");
      }
    }
    if (classFilters.pesagens) {
      const pesosData = report.animais.flatMap((a) =>
        a.pesagensDetalhes.map((p) => ({
          Animal: `Boi #${a.animal.numeroIdentificacao}`,
          "Peso (kg)": p.pesoKg.toFixed(1),
          "Data da Pesagem": formatDate(p.dataPesagem),
        }))
      );
      if (pesosData.length > 0) {
        const wsP = XLSX.utils.json_to_sheet(pesosData);
        wsP["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, wsP, "Pesagens");
      }
    }

    XLSX.writeFile(wb, `relatorio_geral_rebanho.xlsx`);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Relatórios Gerais
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada do rebanho
          </p>
        </div>
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

      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-medium text-muted-foreground self-center mr-1">Status:</span>
        {[
          { value: "all", label: "Todos" },
          { value: "ATIVO", label: "Ativos" },
          { value: "VENDIDO", label: "Vendidos" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setLoading(true);
              setStatusFilter(f.value);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === f.value
                ? "bg-primary text-primary-foreground"
                : "border hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-medium text-muted-foreground self-center mr-1">Exibir:</span>
        {([
          { key: "cards" as const, label: "Resumo" },
          { key: "statusChart" as const, label: "Gráfico Status" },
          { key: "gainChart" as const, label: "Gráfico Ganhos" },
          { key: "weightChart" as const, label: "Gráfico Pesos" },
          { key: "table" as const, label: "Tabela" },
        ]).map((f) => (
          <button
            key={f.key}
            onClick={() => toggleSection(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              sectionFilters[f.key]
                ? "bg-primary text-primary-foreground"
                : "border hover:bg-accent text-muted-foreground"
            }`}
          >
            {sectionFilters[f.key] ? "✓ " : "× "}{f.label}
          </button>
        )        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-medium text-muted-foreground self-center mr-1">Dados:</span>
        {([
          { key: "pesagens" as const, label: "Pesagens" },
          { key: "vacinas" as const, label: "Vacinas" },
          { key: "vermifugos" as const, label: "Vermífugos" },
          { key: "vitaminas" as const, label: "Vitaminas" },
        ]).map((f) => (
          <button
            key={f.key}
            onClick={() => setClassFilters((prev) => ({ ...prev, [f.key]: !prev[f.key] }))}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              classFilters[f.key]
                ? "bg-primary text-primary-foreground"
                : "border hover:bg-accent text-muted-foreground"
            }`}
          >
            {classFilters[f.key] ? "✓ " : "× "}{f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : report ? (
        <>
          {sectionFilters.cards && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border bg-card p-4 shadow-sm text-center">
              <Beef className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-xs text-muted-foreground">Animais</p>
              <p className="text-xl font-bold">{report.totalAnimais}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm text-center">
              <p className="text-xs text-muted-foreground">Peso Inicial Médio</p>
              <p className="text-xl font-bold">
                {report.pesoInicialMedio > 0
                  ? `${report.pesoInicialMedio.toFixed(1)} kg`
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm text-center">
              <p className="text-xs text-muted-foreground">Peso Atual Médio</p>
              <p className="text-xl font-bold">
                {report.pesoAtualMedio > 0
                  ? `${report.pesoAtualMedio.toFixed(1)} kg`
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm text-center">
              <TrendingUp className="h-5 w-5 mx-auto text-green-600 mb-1" />
              <p className="text-xs text-muted-foreground">Ganho Médio</p>
              <p className="text-xl font-bold text-green-600">
                {report.ganhoMedio > 0
                  ? `+${report.ganhoMedio.toFixed(1)} kg`
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm text-center">
              <p className="text-xs text-muted-foreground">Maior Ganho</p>
              <p className="text-xl font-bold text-green-600">
                {report.maiorGanho > 0
                  ? `+${report.maiorGanho.toFixed(1)} kg`
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm text-center">
              <p className="text-xs text-muted-foreground">Menor Ganho</p>
              <p className="text-xl font-bold">
                {report.menorGanho !== 0
                  ? `${report.menorGanho.toFixed(1)} kg`
                  : "—"}
              </p>
            </div>
          </div>
          )}

          {/* Pie Charts */}
          {(sectionFilters.statusChart || sectionFilters.gainChart || sectionFilters.weightChart) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Status Distribution */}
            {sectionFilters.statusChart && statusDistribution.length > 0 && (
              <div className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm">
                <h2 className="font-semibold text-lg mb-4">
                  Distribuição por Status
                </h2>
                <div className="h-64">
                  <ResponsiveContainerComponent width="100%" height="100%">
                    <PieChartComponent>
                      <PieComponent
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        label={({ name, percent }: any) =>
                          `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                        }
                      >
                        {statusDistribution.map((_: unknown, index: number) => (
                          <CellComponent
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </PieComponent>
                      <TooltipComponent
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any) => [`${String(value)} animal(is)`, "Quantidade"]}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                          fontSize: "13px",
                        }}
                      />
                    </PieChartComponent>
                  </ResponsiveContainerComponent>
                </div>
              </div>
            )}

            {/* Gain Distribution */}
            {sectionFilters.gainChart && gainDistribution.length > 0 && (
              <div className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm">
                <h2 className="font-semibold text-lg mb-4">
                  Distribuição por Ganho
                </h2>
                <div className="h-64">
                  <ResponsiveContainerComponent width="100%" height="100%">
                    <PieChartComponent>
                      <PieComponent
                        data={gainDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        label={({ name, percent }: any) =>
                          `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                        }
                      >
                        {gainDistribution.map((_: unknown, index: number) => (
                          <CellComponent
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </PieComponent>
                      <TooltipComponent
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any) => [`${String(value)} animal(is)`, "Quantidade"]}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                          fontSize: "13px",
                        }}
                      />
                    </PieChartComponent>
                  </ResponsiveContainerComponent>
                </div>
              </div>
            )}

            {/* Weight per Animal */}
            {sectionFilters.weightChart && weightData.length > 0 && (
              <div className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm">
                <h2 className="font-semibold text-lg mb-4">
                  Peso por Animal
                </h2>
                <div className="h-64">
                  <ResponsiveContainerComponent width="100%" height="100%">
                    <PieChartComponent>
                      <PieComponent
                        data={weightData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        label={({ name, percent }: any) =>
                          `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                        }
                      >
                        {weightData.map((_: unknown, index: number) => (
                          <CellComponent
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </PieComponent>
                      <TooltipComponent
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any) => [`${Number(value).toFixed(1)} kg`, "Peso"]}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                          fontSize: "13px",
                        }}
                      />
                    </PieChartComponent>
                  </ResponsiveContainerComponent>
                </div>
              </div>
            )}
          </div>
          )}

          {sectionFilters.table && (
          <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
            <div className="border-b p-4">
              <h2 className="font-semibold text-lg">Detalhes por Animal</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-8 px-2 py-2"></th>
                  <th className="px-4 py-2 text-left font-medium">Animal</th>
                  <th className="px-4 py-2 text-left font-medium">Ciclo</th>
                  <th className="px-4 py-2 text-right font-medium">Peso Inicial</th>
                  <th className="px-4 py-2 text-right font-medium">Peso Atual</th>
                  <th className="px-4 py-2 text-right font-medium">Ganho</th>
                  <th className="px-4 py-2 text-right font-medium">Ganho %</th>
                  <th className="px-4 py-2 text-right font-medium">Pesagens</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {animais.map((a) => (
                  <React.Fragment key={a.animal.id}>
                  <tr className="hover:bg-muted/30">
                    <td className="px-2 py-2">
                      <button
                        onClick={() => toggleExpanded(a.animal.id)}
                        aria-label="Ver detalhes"
                        className="p-1 rounded hover:bg-accent transition-colors"
                      >
                        {expandedAnimais.has(a.animal.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/animals/${a.animal.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        Boi #{a.animal.numeroIdentificacao}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {a.cycle.numeroCiclo}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {a.pesoInicial !== null
                        ? `${a.pesoInicial.toFixed(1)} kg`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {a.pesoAtual !== null
                        ? `${a.pesoAtual.toFixed(1)} kg`
                        : "—"}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${
                        a.ganhoKg !== null && a.ganhoKg >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {a.ganhoKg !== null
                        ? `${a.ganhoKg >= 0 ? "+" : ""}${a.ganhoKg.toFixed(1)} kg`
                        : "—"}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${
                        a.ganhoPercentual !== null && a.ganhoPercentual >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {a.ganhoPercentual !== null
                        ? `${a.ganhoPercentual >= 0 ? "+" : ""}${a.ganhoPercentual.toFixed(2)}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {a.totalPesagens}
                    </td>
                  </tr>
                  {expandedAnimais.has(a.animal.id) && (
                    <tr key={`${a.animal.id}-details`} className="bg-muted/20">
                      <td colSpan={9} className="px-6 py-4 border-t">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                          {classFilters.vacinas && (
                            <div>
                              <p className="font-semibold mb-2 flex items-center gap-1.5">
                                <Syringe className="h-4 w-4 text-violet-500" /> Vacinas ({a.vacinas.length})
                              </p>
                              {a.vacinas.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Nenhuma vacina registrada</p>
                              ) : (
                                <ul className="space-y-1">
                                  {a.vacinas.map((v) => (
                                    <li key={v.id} className="flex justify-between gap-4 text-xs">
                                      <span className="font-medium truncate">{v.nome}</span>
                                      <span className="text-muted-foreground whitespace-nowrap">
                                        {formatDate(v.dataAplicacao)}
                                        {v.dataProximaDose && ` → reforço ${formatDate(v.dataProximaDose)}`}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                          {classFilters.vermifugos && (
                            <div>
                              <p className="font-semibold mb-2 flex items-center gap-1.5">
                                🐛 Vermífugos ({a.vermifugos.length})
                              </p>
                              {a.vermifugos.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Nenhum vermífugo registrado</p>
                              ) : (
                                <ul className="space-y-1">
                                  {a.vermifugos.map((v) => (
                                    <li key={v.id} className="flex justify-between gap-4 text-xs">
                                      <span className="font-medium truncate">{v.nome}{v.dose ? ` (${v.dose})` : ""}</span>
                                      <span className="text-muted-foreground whitespace-nowrap">
                                        {formatDate(v.dataAplicacao)}
                                        {v.dataProximaDose && ` → ${formatDate(v.dataProximaDose)}`}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                          {classFilters.vitaminas && (
                            <div>
                              <p className="font-semibold mb-2 flex items-center gap-1.5">
                                💊 Vitaminas ({a.vitaminas.length})
                              </p>
                              {a.vitaminas.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Nenhuma vitamina registrada</p>
                              ) : (
                                <ul className="space-y-1">
                                  {a.vitaminas.map((v) => (
                                    <li key={v.id} className="flex justify-between gap-4 text-xs">
                                      <span className="font-medium truncate">{v.nome}{v.dose ? ` (${v.dose})` : ""}</span>
                                      <span className="text-muted-foreground whitespace-nowrap">
                                        {formatDate(v.dataAplicacao)}
                                        {v.dataProximaDose && ` → ${formatDate(v.dataProximaDose)}`}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                          {classFilters.pesagens && a.pesagensDetalhes.length > 0 && (
                            <div>
                              <p className="font-semibold mb-2 flex items-center gap-1.5">
                                ⚖️ Histórico de Pesagens ({a.pesagensDetalhes.length})
                              </p>
                              <ul className="space-y-1">
                                {a.pesagensDetalhes.map((p) => (
                                  <li key={p.id} className="flex justify-between gap-4 text-xs">
                                    <span className="font-medium">{p.pesoKg.toFixed(1)} kg</span>
                                    <span className="text-muted-foreground whitespace-nowrap">{formatDate(p.dataPesagem)}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </>
      ) : (
        <div className="text-center py-16">
          <BarChart3 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="font-medium">Nenhum dado disponível</p>
        </div>
      )}
    </div>
  );
}
