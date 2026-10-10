import { describe, it, expect } from "vitest";
import { canManageHerd, canManageMembers, canRecord, canRemoveMember } from "../permissions";

describe("permissions", () => {
  it("todos os níveis lançam registros de manejo", () => {
    expect(canRecord("OWNER")).toBe(true);
    expect(canRecord("ADMIN")).toBe(true);
    expect(canRecord("MEMBER")).toBe(true);
    expect(canRecord("QUALQUER")).toBe(false);
  });

  it("só OWNER e ADMIN gerenciam rebanho e membros", () => {
    for (const fn of [canManageHerd, canManageMembers]) {
      expect(fn("OWNER")).toBe(true);
      expect(fn("ADMIN")).toBe(true);
      expect(fn("MEMBER")).toBe(false);
    }
  });

  it("OWNER remove ADMIN e MEMBER", () => {
    expect(canRemoveMember("OWNER", "ADMIN")).toBe(true);
    expect(canRemoveMember("OWNER", "MEMBER")).toBe(true);
  });

  it("ADMIN remove só MEMBER", () => {
    expect(canRemoveMember("ADMIN", "MEMBER")).toBe(true);
    expect(canRemoveMember("ADMIN", "ADMIN")).toBe(false);
  });

  it("ninguém remove o OWNER e MEMBER não remove ninguém", () => {
    expect(canRemoveMember("OWNER", "OWNER")).toBe(false);
    expect(canRemoveMember("ADMIN", "OWNER")).toBe(false);
    expect(canRemoveMember("MEMBER", "MEMBER")).toBe(false);
  });
});
