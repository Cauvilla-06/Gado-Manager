import { describe, it, expect } from "vitest";
import {
  animalSchema,
  weightRecordSchema,
  vaccinationSchema,
  vermifugeSchema,
  vitaminSchema,
  normalizeEmail,
  animalStatusFilterSchema,
} from "../validations";

describe("animalSchema", () => {
  it("should accept valid animal data", () => {
    const result = animalSchema.safeParse({ numeroIdentificacao: "157" });
    expect(result.success).toBe(true);
  });

  it("should reject empty number", () => {
    const result = animalSchema.safeParse({ numeroIdentificacao: "" });
    expect(result.success).toBe(false);
  });

  it("should reject long number", () => {
    const result = animalSchema.safeParse({
      numeroIdentificacao: "A".repeat(51),
    });
    expect(result.success).toBe(false);
  });
});

describe("weightRecordSchema", () => {
  it("should accept valid weight record", () => {
    const result = weightRecordSchema.safeParse({
      animalId: "550e8400-e29b-41d4-a716-446655440000",
      cicloId: "550e8400-e29b-41d4-a716-446655440001",
      pesoKg: 451.5,
      dataPesagem: "2026-08-23",
      origem: "WEB",
    });
    expect(result.success).toBe(true);
  });

  it("should reject zero weight", () => {
    const result = weightRecordSchema.safeParse({
      animalId: "550e8400-e29b-41d4-a716-446655440000",
      cicloId: "550e8400-e29b-41d4-a716-446655440001",
      pesoKg: 0,
      dataPesagem: "2026-08-23",
      origem: "WEB",
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative weight", () => {
    const result = weightRecordSchema.safeParse({
      animalId: "550e8400-e29b-41d4-a716-446655440000",
      cicloId: "550e8400-e29b-41d4-a716-446655440001",
      pesoKg: -10,
      dataPesagem: "2026-08-23",
      origem: "WEB",
    });
    expect(result.success).toBe(false);
  });

  it("should reject excessively high weight", () => {
    const result = weightRecordSchema.safeParse({
      animalId: "550e8400-e29b-41d4-a716-446655440000",
      cicloId: "550e8400-e29b-41d4-a716-446655440001",
      pesoKg: 2001,
      dataPesagem: "2026-08-23",
      origem: "WEB",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid date", () => {
    const result = weightRecordSchema.safeParse({
      animalId: "550e8400-e29b-41d4-a716-446655440000",
      cicloId: "550e8400-e29b-41d4-a716-446655440001",
      pesoKg: 451,
      dataPesagem: "",
      origem: "WEB",
    });
    expect(result.success).toBe(false);
  });

  it("should accept ANDROID origin", () => {
    const result = weightRecordSchema.safeParse({
      animalId: "550e8400-e29b-41d4-a716-446655440000",
      cicloId: "550e8400-e29b-41d4-a716-446655440001",
      pesoKg: 451,
      dataPesagem: "2026-08-23",
      origem: "ANDROID",
    });
    expect(result.success).toBe(true);
  });
});

describe("vaccinationSchema", () => {
  it("should accept valid vaccination", () => {
    const result = vaccinationSchema.safeParse({
      animalId: "550e8400-e29b-41d4-a716-446655440000",
      cicloId: "550e8400-e29b-41d4-a716-446655440001",
      nomeVacina: "Febre Aftosa",
      dataAplicacao: "2026-08-23",
      origem: "WEB",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty vaccine name", () => {
    const result = vaccinationSchema.safeParse({
      animalId: "550e8400-e29b-41d4-a716-446655440000",
      cicloId: "550e8400-e29b-41d4-a716-446655440001",
      nomeVacina: "",
      dataAplicacao: "2026-08-23",
      origem: "WEB",
    });
    expect(result.success).toBe(false);
  });
});

describe("vermifugeSchema / vitaminSchema", () => {
  const base = {
    animalId: "550e8400-e29b-41d4-a716-446655440000",
    cicloId: "550e8400-e29b-41d4-a716-446655440001",
    dataAplicacao: "2026-10-01",
  };

  it("aceita vermífugo válido", () => {
    expect(vermifugeSchema.safeParse({ ...base, nomeVermifugo: "Ivermectina", dose: "5ml" }).success).toBe(true);
  });

  it("recusa vermífugo com script", () => {
    expect(
      vermifugeSchema.safeParse({ ...base, nomeVermifugo: "<img src=x onerror=alert(1)>" }).success
    ).toBe(false);
  });

  it("recusa vitamina com data inválida", () => {
    expect(vitaminSchema.safeParse({ ...base, nomeVitamina: "ADE", dataAplicacao: "ontem" }).success).toBe(false);
  });

  it("aceita próxima dose vazia", () => {
    expect(vitaminSchema.safeParse({ ...base, nomeVitamina: "ADE", dataProximaDose: "" }).success).toBe(true);
  });
});

describe("normalizeEmail", () => {
  it("remove espaços e deixa minúsculo", () => {
    expect(normalizeEmail("  Joao@Gmail.COM ")).toBe("joao@gmail.com");
  });
});

describe("animalStatusFilterSchema", () => {
  it("aceita status conhecidos e recusa o resto", () => {
    expect(animalStatusFilterSchema.safeParse("ATIVO").success).toBe(true);
    expect(animalStatusFilterSchema.safeParse(undefined).success).toBe(true);
    expect(animalStatusFilterSchema.safeParse("QUALQUER").success).toBe(false);
  });
});
