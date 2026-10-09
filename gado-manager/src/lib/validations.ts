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

export const animalSchema = z.object({
  numeroIdentificacao: safeText(50)
    .refine((v) => v.length >= 1, "Número de identificação é obrigatório")
    .refine((v) => /^[\p{L}\p{N}\-_\/. ]+$/u.test(v), "Número contém caracteres inválidos"),
});

export const weightRecordSchema = z.object({
  animalId: z.string().uuid("ID do animal inválido"),
  cicloId: z.string().uuid("ID do ciclo inválido"),
  pesoKg: z
    .number({ message: "Peso deve ser um número" })
    .positive("Peso deve ser maior que zero")
    .max(2000, "Peso excessivamente alto. Verifique o valor informado."),
  dataPesagem: z.string().min(1, "Data da pesagem é obrigatória"),
  observacao: safeText(500).optional(),
  origem: z.enum(["WEB", "ANDROID"]).default("WEB"),
  clientGeneratedId: z.string().uuid().optional(),
});

export const vaccinationSchema = z.object({
  animalId: z.string().uuid("ID do animal inválido"),
  cicloId: z.string().uuid("ID do ciclo inválido"),
  nomeVacina: safeText(200)
    .refine((v) => v.length >= 1, "Nome da vacina é obrigatório"),
  dataAplicacao: z.string().min(1, "Data de aplicação é obrigatória"),
  dataProximaDose: z.string().optional(),
  lote: safeText(100).optional(),
  observacao: safeText(500).optional(),
  origem: z.enum(["WEB", "ANDROID"]).default("WEB"),
  clientGeneratedId: z.string().uuid().optional(),
});

export const cycleSchema = z.object({
  animalId: z.string().uuid("ID do animal inválido"),
  observacoes: safeText(500).optional(),
});

export const sellAnimalSchema = z.object({
  animalId: z.string().uuid("ID do animal inválido"),
});

export const syncPayloadSchema = z.object({
  pesagens: z.array(
    z.object({
      clientGeneratedId: z.string().uuid(),
      animalNumero: z.string().min(1),
      pesoKg: z.number().positive(),
      dataPesagem: z.string().min(1),
      cicloId: z.string().uuid().optional(),
      observacao: z.string().optional(),
    })
  ),
  vacinas: z.array(
    z.object({
      clientGeneratedId: z.string().uuid(),
      animalNumero: z.string().min(1),
      nomeVacina: z.string().min(1),
      dataAplicacao: z.string().min(1),
      dataProximaDose: z.string().optional(),
      lote: z.string().optional(),
      observacao: z.string().optional(),
      cicloId: z.string().uuid().optional(),
    })
  ),
  vermifugos: z.array(
    z.object({
      clientGeneratedId: z.string().uuid(),
      animalNumero: z.string().min(1),
      nomeVermifugo: z.string().min(1),
      dose: z.string().optional(),
      dataAplicacao: z.string().min(1),
      dataProximaDose: z.string().optional(),
      observacao: z.string().optional(),
      cicloId: z.string().uuid().optional(),
    })
  ).default([]),
  vitaminas: z.array(
    z.object({
      clientGeneratedId: z.string().uuid(),
      animalNumero: z.string().min(1),
      nomeVitamina: z.string().min(1),
      dose: z.string().optional(),
      dataAplicacao: z.string().min(1),
      dataProximaDose: z.string().optional(),
      observacao: z.string().optional(),
      cicloId: z.string().uuid().optional(),
    })
  ).default([]),
});

export const reportFilterSchema = z.object({
  periodo: z.enum(["7d", "30d", "all"]).default("all"),
  animalId: z.string().uuid().optional(),
  status: z.enum(["ATIVO", "VENDIDO", "INATIVO", "all"]).default("all"),
});
