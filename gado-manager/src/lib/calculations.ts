/**
 * Centralized calculation services for weight tracking.
 * All weight-related formulas live here to avoid duplication.
 */

export function calculateWeightGain(pesoAtual: number, pesoInicial: number): number {
  return Number((pesoAtual - pesoInicial).toFixed(2));
}

export function calculateWeightGainPercentage(pesoAtual: number, pesoInicial: number): number {
  if (pesoInicial === 0) return 0;
  return Number((((pesoAtual - pesoInicial) / pesoInicial) * 100).toFixed(2));
}

export function calculateAverageWeight(pesos: number[]): number {
  if (pesos.length === 0) return 0;
  const sum = pesos.reduce((acc, p) => acc + p, 0);
  return Number((sum / pesos.length).toFixed(2));
}

export function calculateMaxWeight(pesos: number[]): number | null {
  if (pesos.length === 0) return null;
  return Math.max(...pesos);
}

export function calculateMinWeight(pesos: number[]): number | null {
  if (pesos.length === 0) return null;
  return Math.min(...pesos);
}

export function calculatePeriodDays(dataInicio: string, dataFim: string): number {
  const start = new Date(dataInicio);
  const end = new Date(dataFim);
  const diffMs = end.getTime() - start.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function calculateWeightVariation(
  pesoAnterior: number,
  pesoAtual: number
): { variacaoKg: number; variacaoPercentual: number } {
  const variacaoKg = Number((pesoAtual - pesoAnterior).toFixed(2));
  const variacaoPercentual =
    pesoAnterior === 0
      ? 0
      : Number((((pesoAtual - pesoAnterior) / pesoAnterior) * 100).toFixed(2));
  return { variacaoKg, variacaoPercentual };
}

export function generateInterpretation(
  pesoAtual: number | null,
  pesoInicial: number | null
): string {
  if (pesoAtual === null || pesoInicial === null) {
    return "Dados insuficientes para análise.";
  }
  const ganho = calculateWeightGain(pesoAtual, pesoInicial);
  const percentual = calculateWeightGainPercentage(pesoAtual, pesoInicial);

  if (ganho > 0) {
    return `Peso aumentou ${Math.abs(ganho)} kg (+${Math.abs(percentual)}%) desde a primeira pesagem.`;
  } else if (ganho < 0) {
    return `Peso reduziu ${Math.abs(ganho)} kg (${percentual}%) desde a primeira pesagem.`;
  }
  return "Não houve alteração significativa no período analisado.";
}

export function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatWeight(kg: number): string {
  return `${kg.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
