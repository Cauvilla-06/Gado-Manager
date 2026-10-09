import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do Prisma
vi.mock("@/lib/db", () => {
  const animal = { findUnique: vi.fn(), update: vi.fn() };
  const animalCycle = { findUnique: vi.fn() };
  const weightRecord = { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx: any = { animal, animalCycle, weightRecord };
  return {
    db: {
      animal,
      animalCycle,
      weightRecord,
      $transaction: vi.fn((fn: typeof tx) => fn(tx)),
    },
  };
});

import { createWeightRecord, getWeightsByAnimal } from "../weight-service";
import { db } from "@/lib/db";

describe("weight-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createWeightRecord", () => {
    const validWeightData = {
      animalId: "550e8400-e29b-41d4-a716-446655440000",
      cicloId: "550e8400-e29b-41d4-a716-446655440001",
      pesoKg: 451.5,
      dataPesagem: "2026-08-23",
      origem: "WEB" as const,
    };

    it("deve criar registro de peso válido", async () => {
      const mockAnimal = { id: "1", status: "ATIVO" };
      const mockCycle = { id: "1", status: "ATIVO", animalId: validWeightData.animalId };
      const mockRecord = { id: "1", pesoKg: 451.5 };

      vi.mocked(db.animal.findUnique).mockResolvedValue(mockAnimal as never);
      vi.mocked(db.animalCycle.findUnique).mockResolvedValue(mockCycle as never);
      vi.mocked(db.weightRecord.findUnique).mockResolvedValue(null);
      vi.mocked(db.weightRecord.create).mockResolvedValue(mockRecord as never);
      vi.mocked(db.animal.update).mockResolvedValue({} as never);

      const result = await createWeightRecord(validWeightData);

      expect(result.pesoKg).toBe(451.5);
      expect(db.weightRecord.create).toHaveBeenCalledTimes(1);
    });

    it("deve recriar animal inexistente", async () => {
      vi.mocked(db.animal.findUnique).mockResolvedValue(null as never);

      await expect(createWeightRecord(validWeightData)).rejects.toThrow(
        "Animal não encontrado"
      );
    });

    it("deve recriar animal vendido", async () => {
      const mockAnimal = { id: "1", status: "VENDIDO" };
      vi.mocked(db.animal.findUnique).mockResolvedValue(mockAnimal as never);

      await expect(createWeightRecord(validWeightData)).rejects.toThrow(
        "Animal já foi vendido"
      );
    });

    it("deve recriar ciclo inativo", async () => {
      const mockAnimal = { id: "1", status: "ATIVO" };
      const mockCycle = { id: "1", status: "ENCERRADO", animalId: validWeightData.animalId };

      vi.mocked(db.animal.findUnique).mockResolvedValue(mockAnimal as never);
      vi.mocked(db.animalCycle.findUnique).mockResolvedValue(mockCycle as never);

      await expect(createWeightRecord(validWeightData)).rejects.toThrow(
        "Este ciclo já está encerrado"
      );
    });

    it("deve retornar registro existente por idempotência", async () => {
      const mockAnimal = { id: "1", status: "ATIVO" };
      const mockCycle = { id: "1", status: "ATIVO", animalId: validWeightData.animalId };
      const existingRecord = { id: "existing", pesoKg: 451.5, animalId: validWeightData.animalId };

      vi.mocked(db.animal.findUnique).mockResolvedValue(mockAnimal as never);
      vi.mocked(db.animalCycle.findUnique).mockResolvedValue(mockCycle as never);
      vi.mocked(db.weightRecord.findUnique).mockResolvedValue(existingRecord as never);

      const dataWithClientGeneratedId = {
        ...validWeightData,
        clientGeneratedId: "550e8400-e29b-41d4-a716-446655440002",
      };

      const result = await createWeightRecord(dataWithClientGeneratedId);

      expect(result).toEqual(existingRecord);
      expect(db.weightRecord.create).not.toHaveBeenCalled();
    });

    it("não deve devolver registro de OUTRO animal com o mesmo clientGeneratedId", async () => {
      vi.mocked(db.weightRecord.findUnique).mockResolvedValue({
        id: "alheio",
        pesoKg: 300,
        animalId: "550e8400-e29b-41d4-a716-44665544ffff",
      } as never);

      await expect(
        createWeightRecord({
          ...validWeightData,
          clientGeneratedId: "550e8400-e29b-41d4-a716-446655440002",
        })
      ).rejects.toThrow("Identificador do registro já utilizado");
      expect(db.weightRecord.create).not.toHaveBeenCalled();
    });

    it("deve recusar ciclo de outro animal", async () => {
      vi.mocked(db.weightRecord.findUnique).mockResolvedValue(null);
      vi.mocked(db.animal.findUnique).mockResolvedValue({ id: "1", status: "ATIVO" } as never);
      vi.mocked(db.animalCycle.findUnique).mockResolvedValue({
        id: validWeightData.cicloId,
        status: "ATIVO",
        animalId: "550e8400-e29b-41d4-a716-44665544ffff",
      } as never);

      await expect(createWeightRecord(validWeightData)).rejects.toThrow(
        "Ciclo não encontrado para este animal"
      );
    });

    it("deve salvar quem registrou (criadoPorId)", async () => {
      vi.mocked(db.weightRecord.findUnique).mockResolvedValue(null);
      vi.mocked(db.animal.findUnique).mockResolvedValue({ id: "1", status: "ATIVO" } as never);
      vi.mocked(db.animalCycle.findUnique).mockResolvedValue({
        id: validWeightData.cicloId,
        status: "ATIVO",
        animalId: validWeightData.animalId,
      } as never);
      vi.mocked(db.weightRecord.create).mockResolvedValue({ id: "novo" } as never);
      vi.mocked(db.animal.update).mockResolvedValue({} as never);

      const criadoPorId = "550e8400-e29b-41d4-a716-446655440099";
      await createWeightRecord({ ...validWeightData, criadoPorId });

      expect(vi.mocked(db.weightRecord.create).mock.calls[0][0].data.criadoPorId).toBe(criadoPorId);
    });
  });

  describe("getWeightsByAnimal", () => {
    it("deve retornar pesagens do animal", async () => {
      const mockWeights = [
        { id: "1", pesoKg: 420 },
        { id: "2", pesoKg: 451 },
      ];

      vi.mocked(db.weightRecord.findMany).mockResolvedValue(mockWeights as never);

      const result = await getWeightsByAnimal("animal-1");

      expect(result).toHaveLength(2);
    });

    it("deve filtrar por ciclo", async () => {
      vi.mocked(db.weightRecord.findMany).mockResolvedValue([] as never);

      await getWeightsByAnimal("animal-1", "ciclo-1");

      const callArgs = vi.mocked(db.weightRecord.findMany).mock.calls[0]?.[0];
      expect(callArgs?.where?.cicloId).toBe("ciclo-1");
    });
  });
});
