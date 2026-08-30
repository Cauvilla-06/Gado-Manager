import { z } from "zod";

// Animal
export const AnimalStatusEnum = z.enum(["ATIVO", "VENDIDO", "INATIVO"]);
export type AnimalStatus = z.infer<typeof AnimalStatusEnum>;

export interface Animal {
  id: string;
  numeroIdentificacao: string;
  status: AnimalStatus;
  cicloAtualId: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

// AnimalCycle
export const CycleStatusEnum = z.enum(["ATIVO", "ENCERRADO"]);
export type CycleStatus = z.infer<typeof CycleStatusEnum>;

export interface AnimalCycle {
  id: string;
  animalId: string;
  numeroCiclo: number;
  dataInicio: string;
  dataFim: string | null;
  status: CycleStatus;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

// WeightRecord
export const OrigemEnum = z.enum(["WEB", "ANDROID"]);
export type Origem = z.infer<typeof OrigemEnum>;

export interface WeightRecord {
  id: string;
  animalId: string;
  cicloId: string;
  pesoKg: number;
  dataPesagem: string;
  dataRegistro: string;
  observacao: string | null;
  origem: Origem;
  clientGeneratedId: string | null;
  sincronizado: boolean;
  created_at: string;
  updated_at: string;
}

// Vaccination
export interface Vaccination {
  id: string;
  animalId: string;
  cicloId: string;
  nomeVacina: string;
  dataAplicacao: string;
  dataProximaDose: string | null;
  lote: string | null;
  observacao: string | null;
  origem: Origem;
  clientGeneratedId: string | null;
  created_at: string;
  updated_at: string;
}

// Dashboard
export interface DashboardStats {
  totalAtivos: number;
  totalVendidos: number;
  totalPesagens: number;
  totalVacinas: number;
}

export interface AnimalListItem {
  id: string;
  numeroIdentificacao: string;
  status: AnimalStatus;
  pesoAtual: number | null;
  pesoInicial: number | null;
  ganhoKg: number | null;
  ganhoPercentual: number | null;
  ultimaPesagem: string | null;
  cicloAtual: number | null;
}

// Vermifuge
export interface Vermifuge {
  id: string;
  animalId: string;
  cicloId: string;
  nomeVermifugo: string;
  dose: string | null;
  dataAplicacao: string;
  dataProximaDose: string | null;
  observacao: string | null;
  origem: Origem;
  clientGeneratedId: string | null;
}

// Vitamin
export interface Vitamin {
  id: string;
  animalId: string;
  cicloId: string;
  nomeVitamina: string;
  dose: string | null;
  dataAplicacao: string;
  dataProximaDose: string | null;
  observacao: string | null;
  origem: Origem;
  clientGeneratedId: string | null;
}

// Report
export interface IndividualReport {
  animal: Animal;
  cicloAtual: AnimalCycle;
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
  pesagens: WeightRecord[];
  vacinas: Vaccination[];
  vermifugos: Vermifuge[];
  vitaminas: Vitamin[];
  interpretacao: string;
  dataGeracao: string;
}

// Sync
export interface SyncPayload {
  pesagens: Array<{
    clientGeneratedId: string;
    animalNumero: string;
    pesoKg: number;
    dataPesagem: string;
    cicloId?: string;
    observacao?: string;
  }>;
  vacinas: Array<{
    clientGeneratedId: string;
    animalNumero: string;
    nomeVacina: string;
    dataAplicacao: string;
    dataProximaDose?: string;
    lote?: string;
    observacao?: string;
    cicloId?: string;
  }>;
  vermifugos: Array<{
    clientGeneratedId: string;
    animalNumero: string;
    nomeVermifugo: string;
    dose?: string;
    dataAplicacao: string;
    dataProximaDose?: string;
    observacao?: string;
    cicloId?: string;
  }>;
  vitaminas: Array<{
    clientGeneratedId: string;
    animalNumero: string;
    nomeVitamina: string;
    dose?: string;
    dataAplicacao: string;
    dataProximaDose?: string;
    observacao?: string;
    cicloId?: string;
  }>;
}

export interface SyncResult {
  pesagensProcessadas: number;
  vacinasProcessadas: number;
  vermifugosProcessados: number;
  vitaminasProcessadas: number;
  duplicados: number;
  erros: string[];
}
