import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const many = () => ({ findMany: vi.fn().mockResolvedValue([]) });
  return {
    db: {
      animal: { findUnique: vi.fn() },
      animalCycle: { findFirst: vi.fn(), findUnique: vi.fn() },
      weightRecord: many(),
      vaccination: many(),
      vermifuge: many(),
      vitamin: many(),
    },
  };
});

import { getIndividualReport } from "../report-service";
import { db } from "@/lib/db";

describe("report-service / getIndividualReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.animal.findUnique).mockResolvedValue({ id: "meu-animal" } as never);
  });

  it("só busca o ciclo pedido se ele for DESTE animal (IDOR)", async () => {
    vi.mocked(db.animalCycle.findFirst).mockResolvedValue(null);

    await expect(getIndividualReport("meu-animal", "ciclo-de-outra-fazenda")).rejects.toThrow(
      "Ciclo não encontrado"
    );
    expect(db.animalCycle.findFirst).toHaveBeenCalledWith({
      where: { id: "ciclo-de-outra-fazenda", animalId: "meu-animal" },
    });
    expect(db.weightRecord.findMany).not.toHaveBeenCalled();
  });
});
