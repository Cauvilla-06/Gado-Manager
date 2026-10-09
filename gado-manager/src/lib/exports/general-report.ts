import { downloadCsv } from "@/lib/csv";

/**
 * Exportações do relatório geral do rebanho (PDF, CSV, XLSX).
 * jspdf e xlsx são importados sob demanda para não pesar o carregamento da página.
 */

export interface GeneralReport {
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

export interface ClassFilters {
  pesagens: boolean;
  vacinas: boolean;
  vermifugos: boolean;
  vitaminas: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export async function exportGeneralReportPDF(report: GeneralReport, classFilters: ClassFilters) {
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
    ["Menor Ganho", report.menorGanho !== null && report.menorGanho !== 0 ? `${report.menorGanho.toFixed(1)} kg` : "—"],
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

export function exportGeneralReportCSV(report: GeneralReport, classFilters: ClassFilters) {
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

  downloadCsv("relatorio_geral_rebanho.csv", csvLines);
}

export async function exportGeneralReportXLSX(report: GeneralReport, classFilters: ClassFilters) {
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
