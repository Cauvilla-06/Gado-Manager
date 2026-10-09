import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const model = () => ({ findMany: vi.fn(), createMany: vi.fn() });
  const weightRecord = model();
  const vaccination = model();
  const vermifuge = model();
  const vitamin = model();
  const animal = { findMany: vi.fn(), update: vi.fn() };
  const animalCycle = { findMany: vi.fn() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx: any = { weightRecord, vaccination, vermifuge, vitamin, animal, animalCycle };
  return {
    db: {
      ...tx,
      $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});

import { processSync } from "../sync-service";
import { db } from "@/lib/db";

const FARM = "farm-1";
const USER = "550e8400-e29b-41d4-a716-446655440099";
const ANIMAL_ID = "550e8400-e29b-41d4-a716-446655440000";
const CYCLE_ID = "550e8400-e29b-41d4-a716-446655440001";
const OTHER_CYCLE = "550e8400-e29b-41d4-a716-44665544ffff";

const id = (n: number) => `550e8400-e29b-41d4-a716-4466554400${String(n).padStart(2, "0")}`;

function pesagem(n: number, extra: Record<string, unknown> = {}) {
  return {
    clientGeneratedId: id(n),
    animalNumero: "001",
    pesoKg: 400 + n,
    dataPesagem: "2026-10-01",
    ...extra,
  };
}

function setup({ status = "ATIVO", cycles = [{ id: CYCLE_ID, animalId: ANIMAL_ID, status: "ATIVO" }] } = {}) {
  vi.mocked(db.weightRecord.findMany).mockResolvedValue([] as never);
  vi.mocked(db.animal.findMany).mockResolvedValue([
    { id: ANIMAL_ID, numeroIdentificacao: "001", status },
  ] as never);
  vi.mocked(db.animalCycle.findMany).mockImplementation((async (args: {
    where: { id?: { in: string[] }; animalId?: unknown };
  }) => {
    if (args.where.id) return cycles.filter((c) => args.where.id!.in.includes(c.id));
    return cycles.filter((c) => c.status === "ATIVO").map((c) => ({ id: c.id, animalId: c.animalId }));
  }) as never);
  vi.mocked(db.weightRecord.createMany).mockImplementation((async (args: { data: unknown[] }) => ({
    count: args.data.length,
  })) as never);
  vi.mocked(db.animal.update).mockResolvedValue({} as never);
}

const empty = { vacinas: [], vermifugos: [], vitaminas: [] };

describe("sync-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grava pesagens válidas e salva quem registrou", async () => {
    setup();
    const result = await processSync({ pesagens: [pesagem(1), pesagem(2)], ...empty }, FARM, USER);

    expect(result.pesagensProcessadas).toBe(2);
    expect(result.rejeitados).toEqual([]);
    const data = vi.mocked(db.weightRecord.createMany).mock.calls[0]![0]!.data as unknown as Array<{
      criadoPorId: string;
      cicloId: string;
    }>;
    expect(data.every((d) => d.criadoPorId === USER && d.cicloId === CYCLE_ID)).toBe(true);
  });

  it("recusa só o registro com texto malicioso, sem travar o lote", async () => {
    setup();
    const result = await processSync(
      { pesagens: [pesagem(1), pesagem(2, { observacao: "<script>alert(1)</script>" })], ...empty },
      FARM,
      USER
    );

    expect(result.pesagensProcessadas).toBe(1);
    expect(result.rejeitados).toEqual([id(2)]);
    expect(result.erros[0]).toContain("Animal nº 001 ");
  });

  it("recusa ciclo de outro animal/fazenda", async () => {
    setup({
      cycles: [
        { id: CYCLE_ID, animalId: ANIMAL_ID, status: "ATIVO" },
        { id: OTHER_CYCLE, animalId: "animal-de-outra-fazenda", status: "ATIVO" },
      ],
    });
    const result = await processSync(
      { pesagens: [pesagem(1, { cicloId: OTHER_CYCLE })], ...empty },
      FARM,
      USER
    );

    expect(result.pesagensProcessadas).toBe(0);
    expect(result.rejeitados).toEqual([id(1)]);
    expect(db.weightRecord.createMany).not.toHaveBeenCalled();
  });

  it("recusa registro em animal vendido", async () => {
    setup({ status: "VENDIDO" });
    const result = await processSync({ pesagens: [pesagem(1)], ...empty }, FARM, USER);

    expect(result.pesagensProcessadas).toBe(0);
    expect(result.rejeitados).toEqual([id(1)]);
  });

  it("conta como duplicado o que já existe no servidor ou repete no lote", async () => {
    setup();
    vi.mocked(db.weightRecord.findMany).mockResolvedValue([{ clientGeneratedId: id(1) }] as never);
    const result = await processSync(
      { pesagens: [pesagem(1), pesagem(2), pesagem(2)], ...empty },
      FARM,
      USER
    );

    expect(result.duplicados).toBe(2);
    expect(result.pesagensProcessadas).toBe(1);
  });

  it("recusa lote acima do limite", async () => {
    setup();
    const pesagens = Array.from({ length: 501 }, (_, i) => pesagem(i % 100));
    await expect(processSync({ pesagens, ...empty }, FARM, USER)).rejects.toThrow();
  });

  it("erro ao gravar não vaza detalhe interno e devolve os registros como recusados", async () => {
    setup();
    vi.mocked(db.weightRecord.createMany).mockRejectedValue(new Error("SQLITE_BUSY: detalhe interno"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await processSync({ pesagens: [pesagem(1)], ...empty }, FARM, USER);

    expect(result.rejeitados).toEqual([id(1)]);
    expect(result.erros.join(" ")).not.toContain("SQLITE_BUSY");
    spy.mockRestore();
  });
});
