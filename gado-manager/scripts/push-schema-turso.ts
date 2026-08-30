import { createClient } from "@libsql/client";
import "dotenv/config";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function main() {
  console.log("Connecting to Turso...");

  const statements = [
    `CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "atualizadoEm" DATETIME NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,

    `CREATE TABLE IF NOT EXISTS "Farm" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "atualizadoEm" DATETIME NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Farm_code_key" ON "Farm"("code")`,

    `CREATE TABLE IF NOT EXISTS "FarmMembership" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "farmId" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'MEMBER',
      "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
      FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "FarmMembership_userId_farmId_key" ON "FarmMembership"("userId", "farmId")`,
    `CREATE INDEX IF NOT EXISTS "FarmMembership_userId_idx" ON "FarmMembership"("userId")`,
    `CREATE INDEX IF NOT EXISTS "FarmMembership_farmId_idx" ON "FarmMembership"("farmId")`,

    `CREATE TABLE IF NOT EXISTS "FarmRequest" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "farmId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDENTE',
      "message" TEXT,
      "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "atualizadoEm" DATETIME NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
      FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "FarmRequest_userId_idx" ON "FarmRequest"("userId")`,
    `CREATE INDEX IF NOT EXISTS "FarmRequest_farmId_idx" ON "FarmRequest"("farmId")`,
    `CREATE INDEX IF NOT EXISTS "FarmRequest_status_idx" ON "FarmRequest"("status")`,

    `CREATE TABLE IF NOT EXISTS "Animal" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "farmId" TEXT NOT NULL,
      "numeroIdentificacao" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ATIVO',
      "cicloAtualId" TEXT,
      "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "atualizadoEm" DATETIME NOT NULL,
      FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "Animal_farmId_idx" ON "Animal"("farmId")`,
    `CREATE INDEX IF NOT EXISTS "Animal_numeroIdentificacao_idx" ON "Animal"("numeroIdentificacao")`,
    `CREATE INDEX IF NOT EXISTS "Animal_status_idx" ON "Animal"("status")`,

    `CREATE TABLE IF NOT EXISTS "AnimalCycle" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "animalId" TEXT NOT NULL,
      "numeroCiclo" INTEGER NOT NULL,
      "dataInicio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "dataFim" DATETIME,
      "status" TEXT NOT NULL DEFAULT 'ATIVO',
      "observacoes" TEXT,
      "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "atualizadoEm" DATETIME NOT NULL,
      FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "AnimalCycle_animalId_numeroCiclo_key" ON "AnimalCycle"("animalId", "numeroCiclo")`,
    `CREATE INDEX IF NOT EXISTS "AnimalCycle_animalId_idx" ON "AnimalCycle"("animalId")`,
    `CREATE INDEX IF NOT EXISTS "AnimalCycle_status_idx" ON "AnimalCycle"("status")`,

    `CREATE TABLE IF NOT EXISTS "WeightRecord" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "animalId" TEXT NOT NULL,
      "cicloId" TEXT NOT NULL,
      "criadoPorId" TEXT,
      "pesoKg" REAL NOT NULL,
      "dataPesagem" DATETIME NOT NULL,
      "dataRegistro" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "observacao" TEXT,
      "origem" TEXT NOT NULL DEFAULT 'WEB',
      "clientGeneratedId" TEXT,
      "sincronizado" BOOLEAN NOT NULL DEFAULT 1,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL,
      FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE,
      FOREIGN KEY ("cicloId") REFERENCES "AnimalCycle"("id") ON DELETE CASCADE,
      FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE SET NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "WeightRecord_clientGeneratedId_key" ON "WeightRecord"("clientGeneratedId")`,
    `CREATE INDEX IF NOT EXISTS "WeightRecord_animalId_idx" ON "WeightRecord"("animalId")`,
    `CREATE INDEX IF NOT EXISTS "WeightRecord_cicloId_idx" ON "WeightRecord"("cicloId")`,
    `CREATE INDEX IF NOT EXISTS "WeightRecord_criadoPorId_idx" ON "WeightRecord"("criadoPorId")`,
    `CREATE INDEX IF NOT EXISTS "WeightRecord_dataPesagem_idx" ON "WeightRecord"("dataPesagem")`,

    `CREATE TABLE IF NOT EXISTS "Vaccination" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "animalId" TEXT NOT NULL,
      "cicloId" TEXT NOT NULL,
      "criadoPorId" TEXT,
      "nomeVacina" TEXT NOT NULL,
      "dataAplicacao" DATETIME NOT NULL,
      "dataProximaDose" DATETIME,
      "lote" TEXT,
      "observacao" TEXT,
      "origem" TEXT NOT NULL DEFAULT 'WEB',
      "clientGeneratedId" TEXT,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL,
      FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE,
      FOREIGN KEY ("cicloId") REFERENCES "AnimalCycle"("id") ON DELETE CASCADE,
      FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE SET NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Vaccination_clientGeneratedId_key" ON "Vaccination"("clientGeneratedId")`,
    `CREATE INDEX IF NOT EXISTS "Vaccination_animalId_idx" ON "Vaccination"("animalId")`,
    `CREATE INDEX IF NOT EXISTS "Vaccination_cicloId_idx" ON "Vaccination"("cicloId")`,
    `CREATE INDEX IF NOT EXISTS "Vaccination_criadoPorId_idx" ON "Vaccination"("criadoPorId")`,
    `CREATE INDEX IF NOT EXISTS "Vaccination_dataAplicacao_idx" ON "Vaccination"("dataAplicacao")`,

    `CREATE TABLE IF NOT EXISTS "Vermifuge" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "animalId" TEXT NOT NULL,
      "cicloId" TEXT NOT NULL,
      "criadoPorId" TEXT,
      "nomeVermifugo" TEXT NOT NULL,
      "dose" TEXT,
      "dataAplicacao" DATETIME NOT NULL,
      "dataProximaDose" DATETIME,
      "observacao" TEXT,
      "origem" TEXT NOT NULL DEFAULT 'WEB',
      "clientGeneratedId" TEXT,
      "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "atualizadoEm" DATETIME NOT NULL,
      FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE,
      FOREIGN KEY ("cicloId") REFERENCES "AnimalCycle"("id") ON DELETE CASCADE,
      FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE SET NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Vermifuge_clientGeneratedId_key" ON "Vermifuge"("clientGeneratedId")`,
    `CREATE INDEX IF NOT EXISTS "Vermifuge_animalId_idx" ON "Vermifuge"("animalId")`,
    `CREATE INDEX IF NOT EXISTS "Vermifuge_cicloId_idx" ON "Vermifuge"("cicloId")`,
    `CREATE INDEX IF NOT EXISTS "Vermifuge_criadoPorId_idx" ON "Vermifuge"("criadoPorId")`,
    `CREATE INDEX IF NOT EXISTS "Vermifuge_dataAplicacao_idx" ON "Vermifuge"("dataAplicacao")`,

    `CREATE TABLE IF NOT EXISTS "Vitamin" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "animalId" TEXT NOT NULL,
      "cicloId" TEXT NOT NULL,
      "criadoPorId" TEXT,
      "nomeVitamina" TEXT NOT NULL,
      "dose" TEXT,
      "dataAplicacao" DATETIME NOT NULL,
      "dataProximaDose" DATETIME,
      "observacao" TEXT,
      "origem" TEXT NOT NULL DEFAULT 'WEB',
      "clientGeneratedId" TEXT,
      "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "atualizadoEm" DATETIME NOT NULL,
      FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE,
      FOREIGN KEY ("cicloId") REFERENCES "AnimalCycle"("id") ON DELETE CASCADE,
      FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE SET NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Vitamin_clientGeneratedId_key" ON "Vitamin"("clientGeneratedId")`,
    `CREATE INDEX IF NOT EXISTS "Vitamin_animalId_idx" ON "Vitamin"("animalId")`,
    `CREATE INDEX IF NOT EXISTS "Vitamin_cicloId_idx" ON "Vitamin"("cicloId")`,
    `CREATE INDEX IF NOT EXISTS "Vitamin_criadoPorId_idx" ON "Vitamin"("criadoPorId")`,
    `CREATE INDEX IF NOT EXISTS "Vitamin_dataAplicacao_idx" ON "Vitamin"("dataAplicacao")`,
  ];

  // Create tables in order (tables with FKs first won't work, so we rely on IF NOT EXISTS)
  // Actually, SQLite handles this with foreign_keys pragma. Let's execute in order.
  for (const sql of statements) {
    try {
      await client.execute(sql);
      const tableMatch = sql.match(/CREATE TABLE IF NOT EXISTS "(\w+)"/);
      const indexMatch = sql.match(/CREATE.*INDEX IF NOT EXISTS "(\w+)"/);
      if (tableMatch) console.log(`  ✅ Table: ${tableMatch[1]}`);
      else if (indexMatch) console.log(`  📑 Index: ${indexMatch[1]}`);
    } catch (err: any) {
      console.error(`  ❌ Failed: ${err.message}`);
      console.error(`     SQL: ${sql.substring(0, 80)}...`);
    }
  }

  console.log("\n✅ Schema created on Turso!");
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
