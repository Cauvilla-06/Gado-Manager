import { z } from "zod";

// Bloqueia construtos de XSS/templating na origem (audit 3.1):
// tags HTML, handlers on*, javascript:, {{...}}, ${...}, <%...%>
const FORBIDDEN_INPUT = /<[^>]*>|\bon\w+\s*=|javascript\s*:|\{\{[^}]*\}\}|\$\{[^}]*\}|<%[\s\S]*?%>/i;

const safeText = (max: number) =>
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => !FORBIDDEN_INPUT.test(v), "Conteúdo contém caracteres não permitidos")
    .refine((v) => v.length <= max, `Texto muito longo (máx ${max})`);

const requiredText = (max: number, message: string) =>
  safeText(max).refine((v) => v.length >= 1, message);

// Data obrigatória e parseável (evita "Invalid Date" chegar ao Prisma → 500)
const dateString = (message: string) =>
  z
    .string()
    .min(1, message)
    .refine((v) => !Number.isNaN(Date.parse(v)), "Data inválida");

const optionalDateString = z
  .string()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Data inválida")
  .optional();

const pesoKg = z
  .number({ message: "Peso deve ser um número" })
  .positive("Peso deve ser maior que zero")
  .max(2000, "Peso excessivamente alto. Verifique o valor informado.");

const numeroIdentificacao = safeText(50)
  .refine((v) => v.length >= 1, "Número de identificação é obrigatório")
  .refine((v) => /^[\p{L}\p{N}\-_\/. ]+$/u.test(v), "Número contém caracteres inválidos");

export const animalSchema = z.object({
  numeroIdentificacao,
});

export const weightRecordSchema = z.object({
  animalId: z.string().uuid("ID do animal inválido"),
  cicloId: z.string().uuid("ID do ciclo inválido"),
  criadoPorId: z.string().uuid().optional(),
  pesoKg,
  dataPesagem: dateString("Data da pesagem é obrigatória"),
  observacao: safeText(500).optional(),
  origem: z.enum(["WEB", "ANDROID"]).default("WEB"),
  clientGeneratedId: z.string().uuid().optional(),
});

export const vaccinationSchema = z.object({
  animalId: z.string().uuid("ID do animal inválido"),
  cicloId: z.string().uuid("ID do ciclo inválido"),
  criadoPorId: z.string().uuid().optional(),
  nomeVacina: requiredText(200, "Nome da vacina é obrigatório"),
  dataAplicacao: dateString("Data de aplicação é obrigatória"),
  dataProximaDose: optionalDateString,
  lote: safeText(100).optional(),
  observacao: safeText(500).optional(),
  origem: z.enum(["WEB", "ANDROID"]).default("WEB"),
  clientGeneratedId: z.string().uuid().optional(),
});

export const vermifugeSchema = z.object({
  animalId: z.string().uuid("ID do animal inválido"),
  cicloId: z.string().uuid("ID do ciclo inválido"),
  criadoPorId: z.string().uuid().optional(),
  nomeVermifugo: requiredText(200, "Nome do vermífugo é obrigatório"),
  dose: safeText(100).optional(),
  dataAplicacao: dateString("Data de aplicação é obrigatória"),
  dataProximaDose: optionalDateString,
  observacao: safeText(500).optional(),
});

export const vitaminSchema = z.object({
  animalId: z.string().uuid("ID do animal inválido"),
  cicloId: z.string().uuid("ID do ciclo inválido"),
  criadoPorId: z.string().uuid().optional(),
  nomeVitamina: requiredText(200, "Nome da vitamina é obrigatório"),
  dose: safeText(100).optional(),
  dataAplicacao: dateString("Data de aplicação é obrigatória"),
  dataProximaDose: optionalDateString,
  observacao: safeText(500).optional(),
});

export const cycleSchema = z.object({
  animalId: z.string().uuid("ID do animal inválido"),
  observacoes: safeText(500).optional(),
});

export const sellAnimalSchema = z.object({
  animalId: z.string().uuid("ID do animal inválido"),
});

// --- Sync (app offline) ---
// Cada registro é validado individualmente no sync-service: um registro
// inválido é recusado sozinho (e devolvido ao app em `rejeitados`) sem
// travar o lote inteiro.

/** Máximo de registros por tipo em um único POST /api/sync. */
export const SYNC_MAX_PER_TYPE = 500;

const syncBase = {
  clientGeneratedId: z.string().uuid(),
  animalNumero: numeroIdentificacao,
  cicloId: z.string().uuid().optional(),
  observacao: safeText(500).optional(),
};

export const syncWeightSchema = z.object({
  ...syncBase,
  pesoKg,
  dataPesagem: dateString("Data da pesagem é obrigatória"),
});

export const syncVaccinationSchema = z.object({
  ...syncBase,
  nomeVacina: requiredText(200, "Nome da vacina é obrigatório"),
  dataAplicacao: dateString("Data de aplicação é obrigatória"),
  dataProximaDose: optionalDateString,
  lote: safeText(100).optional(),
});

export const syncVermifugeSchema = z.object({
  ...syncBase,
  nomeVermifugo: requiredText(200, "Nome do vermífugo é obrigatório"),
  dose: safeText(100).optional(),
  dataAplicacao: dateString("Data de aplicação é obrigatória"),
  dataProximaDose: optionalDateString,
});

export const syncVitaminSchema = z.object({
  ...syncBase,
  nomeVitamina: requiredText(200, "Nome da vitamina é obrigatório"),
  dose: safeText(100).optional(),
  dataAplicacao: dateString("Data de aplicação é obrigatória"),
  dataProximaDose: optionalDateString,
});

const syncList = z
  .array(z.unknown())
  .max(SYNC_MAX_PER_TYPE, `Máximo de ${SYNC_MAX_PER_TYPE} registros por tipo em cada sincronização`)
  .default([]);

/** Envelope do payload: só garante formato e tamanho; os itens são validados um a um. */
export const syncPayloadSchema = z.object({
  pesagens: syncList,
  vacinas: syncList,
  vermifugos: syncList,
  vitaminas: syncList,
});

// --- Filtros / formulários diversos ---

export const animalStatusFilterSchema = z
  .enum(["ATIVO", "VENDIDO", "INATIVO", "all"], { message: "Status inválido" })
  .optional();

export const reportFilterSchema = z.object({
  periodo: z.enum(["7d", "30d", "all"]).default("all"),
  animalId: z.string().uuid().optional(),
  status: z.enum(["ATIVO", "VENDIDO", "INATIVO", "all"]).default("all"),
});

export const farmNameSchema = requiredText(120, "Nome da fazenda é obrigatório");

export const joinRequestSchema = z.object({
  farmCode: z.string().trim().min(1, "Código da fazenda é obrigatório").max(50, "Código inválido"),
  message: safeText(300).optional(),
});

export const handleJoinRequestSchema = z.object({
  action: z.enum(["APROVADO", "REJEITADO"], { message: "Ação inválida" }),
});

/** E-mail normalizado: sem espaços nas pontas e em minúsculas. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
