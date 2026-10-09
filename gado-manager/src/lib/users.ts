import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/validations";

/**
 * Busca usuário pelo e-mail sem diferenciar maiúsculas/minúsculas.
 * Contas antigas podem ter sido gravadas com maiúsculas ("Joao@x.com");
 * contas novas já são gravadas normalizadas.
 */
export async function findUserByEmail(email: string) {
  const normalized = normalizeEmail(email);

  const exact = await db.user.findUnique({ where: { email: normalized } });
  if (exact) return exact;

  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "User" WHERE lower(trim("email")) = ${normalized} LIMIT 1
  `;
  if (rows.length === 0) return null;
  return db.user.findUnique({ where: { id: rows[0].id } });
}
