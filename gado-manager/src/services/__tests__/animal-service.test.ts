import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do Prisma
vi.mock("@/lib/db", () => {
  const animal = { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() };
  const animalCycle = { create: vi.fn() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx: any = { animal, animalCycle };
  return {
    db: {
      animal,
      animalCycle,
      $transaction: vi.fn((fn: typeof tx) => fn(tx)),
    },
  };
});

import { createAnimal, getAnimalById, searchAnimals } from "../animal-service";
import { db } from "@/lib/db";

describe("animal-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAnimal", () => {
    it("deve criar um animal com ciclo ativo", async () => {
      const mockAnimal = {
        id: "1",
        numeroIdentificacao: "157",
        status: "ATIVO",
        farmId: "farm-1",
      };
      const mockCycle = {
        id: "cycle-1",
        animalId: "1",
        numeroCiclo: 1,
        status: "ATIVO",
      };

      vi.mocked(db.animal.findFirst).mockResolvedValue(null);
      vi.mocked(db.animal.create).mockResolvedValue(mockAnimal as never);
      vi.mocked(db.animalCycle.create).mockResolvedValue(mockCycle as never);
      vi.mocked(db.animal.update).mockResolvedValue({ ...mockAnimal, cicloAtualId: "cycle-1" } as never);

      const result = await createAnimal({ numeroIdentificacao: "157" }, "farm-1");

      expect(result.animal.numeroIdentificacao).toBe("157");
      expect(result.cycle.numeroCiclo).toBe(1);
      expect(db.animal.create).toHaveBeenCalledTimes(1);
      expect(db.animalCycle.create).toHaveBeenCalledTimes(1);
    });

    it("deve recriar animal com número duplicado ativo", async () => {
      const existingAnimal = {
        id: "1",
        numeroIdentificacao: "157",
        status: "ATIVO",
      };

      vi.mocked(db.animal.findFirst).mockResolvedValue(existingAnimal as never);

      await expect(
        createAnimal({ numeroIdentificacao: "157" }, "farm-1")
      ).rejects.toThrow("Já existe um animal ativo com o número 157");
    });
  });

  describe("getAnimalById", () => {
    it("deve retornar animal quando encontrado", async () => {
      const mockAnimal = {
        id: "1",
        numeroIdentificacao: "157",
        ciclos: [],
      };

      vi.mocked(db.animal.findFirst).mockResolvedValue(mockAnimal as never);

      const result = await getAnimalById("1", "farm-1");

      expect(result).toEqual(mockAnimal);
    });

    it("deve retornar null quando não encontrado", async () => {
      vi.mocked(db.animal.findFirst).mockResolvedValue(null);

      const result = await getAnimalById("999", "farm-1");

      expect(result).toBeNull();
    });
  });

  describe("searchAnimals", () => {
    it("deve buscar animais por número", async () => {
      const mockAnimals = [
        { id: "1", numeroIdentificacao: "157" },
        { id: "2", numeroIdentificacao: "158" },
      ];

      vi.mocked(db.animal.findMany).mockResolvedValue(mockAnimals as never);

      const result = await searchAnimals("157", "farm-1");

      expect(result).toHaveLength(2);
      expect(db.animal.findMany).toHaveBeenCalledTimes(1);
    });

    it("deve filtrar por status", async () => {
      vi.mocked(db.animal.findMany).mockResolvedValue([] as never);

      await searchAnimals("", "farm-1", { status: "ATIVO" });

      const callArgs = vi.mocked(db.animal.findMany).mock.calls[0]?.[0];
      expect(callArgs?.where?.status).toBe("ATIVO");
    });
  });
});
