export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR");
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString("pt-BR");
}

export function formatReportDate(): string {
  const now = new Date();
  return `Relatório gerado em: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function generateFilename(animalNumero: string, cicloNumero: number): string {
  const date = new Date().toISOString().split("T")[0];
  return `relatorio_boi_${animalNumero}_ciclo_${cicloNumero}_${date}`;
}
