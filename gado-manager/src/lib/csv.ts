/**
 * Geração de CSV segura para abrir no Excel/LibreOffice.
 *
 * - Aspas quando o valor tem vírgula, aspas ou quebra de linha
 *   (ex.: vacina "Aftosa, dose 2" não quebra as colunas).
 * - Neutraliza "injeção de fórmula": texto que começa com = + - @ (ou TAB/CR)
 *   seria executado como fórmula pela planilha. Números (ex.: "-3.5") ficam
 *   como estão.
 * - BOM UTF-8 no início para o Excel mostrar acentos corretamente.
 */

const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[+-]?\d+([.,]\d+)?%?$/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);

  if (FORMULA_START.test(text) && !PLAIN_NUMBER.test(text)) {
    text = `'${text}`;
  }

  if (/[",\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows: unknown[][]): string {
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

/** Gera o CSV e dispara o download no navegador. */
export function downloadCsv(filename: string, rows: unknown[][]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
