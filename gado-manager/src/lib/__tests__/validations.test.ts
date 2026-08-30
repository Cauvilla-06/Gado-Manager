import { describe, it, expect } from "vitest";
import {
  animalSchema,
  weightRecordSchema,
  vaccinationSchema,
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
