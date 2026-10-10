/**
 * Regras de permissão por nível na fazenda.
 * Sem acesso a banco: usadas nas rotas (com o nível vindo do requireFarm)
 * e nas telas (para mostrar/esconder botões). O servidor sempre confere de novo.
 */

export type FarmRole = "OWNER" | "ADMIN" | "MEMBER";

/** Lançar pesagem, vacina, vermífugo, vitamina (site e app). */
export function canRecord(role: string): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MEMBER";
}

/** Cadastrar, excluir ou vender boi; iniciar ciclo. */
export function canManageHerd(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Ver/aprovar pedidos de entrada e remover membros. */
export function canManageMembers(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/**
 * Quem pode remover quem:
 * - OWNER remove ADMIN e MEMBER;
 * - ADMIN remove só MEMBER;
 * - ninguém remove o OWNER (a fazenda não pode ficar sem dono).
 */
export function canRemoveMember(actorRole: string, targetRole: string): boolean {
  if (targetRole === "OWNER") return false;
  if (actorRole === "OWNER") return targetRole === "ADMIN" || targetRole === "MEMBER";
  if (actorRole === "ADMIN") return targetRole === "MEMBER";
  return false;
}
