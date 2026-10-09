import { describe, it, expect } from "vitest";
import { csvCell, toCsv } from "../csv";

describe("csv", () => {
  it("coloca aspas em valor com vírgula", () => {
    expect(csvCell("Aftosa, dose 2")).toBe('"Aftosa, dose 2"');
  });

  it("escapa aspas internas", () => {
    expect(csvCell('Vacina "A"')).toBe('"Vacina ""A"""');
  });

  it("neutraliza fórmula", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("+cmd")).toBe("'+cmd");
  });

  it("mantém números negativos e percentuais como número", () => {
    expect(csvCell("-3.5")).toBe("-3.5");
    expect(csvCell("+2.10%")).toBe("+2.10%");
  });

  it("vazio para null/undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("gera CSV com BOM para o Excel ler acentos", () => {
    expect(toCsv([["Animal", "Vermífugo"], ["Boi #1", "X"]])).toBe(
      "﻿Animal,Vermífugo\nBoi #1,X"
    );
  });
});
