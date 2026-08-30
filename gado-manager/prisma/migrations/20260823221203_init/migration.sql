-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numeroIdentificacao" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "cicloAtualId" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AnimalCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animalId" TEXT NOT NULL,
    "numeroCiclo" INTEGER NOT NULL,
    "dataInicio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataFim" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "observacoes" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "AnimalCycle_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeightRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animalId" TEXT NOT NULL,
    "cicloId" TEXT NOT NULL,
    "pesoKg" REAL NOT NULL,
    "dataPesagem" DATETIME NOT NULL,
    "dataRegistro" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacao" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'WEB',
    "clientGeneratedId" TEXT,
    "sincronizado" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "WeightRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WeightRecord_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "AnimalCycle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vaccination" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animalId" TEXT NOT NULL,
    "cicloId" TEXT NOT NULL,
    "nomeVacina" TEXT NOT NULL,
    "dataAplicacao" DATETIME NOT NULL,
    "dataProximaDose" DATETIME,
    "lote" TEXT,
    "observacao" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'WEB',
    "clientGeneratedId" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Vaccination_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Vaccination_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "AnimalCycle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Animal_numeroIdentificacao_idx" ON "Animal"("numeroIdentificacao");

-- CreateIndex
CREATE INDEX "Animal_status_idx" ON "Animal"("status");

-- CreateIndex
CREATE INDEX "AnimalCycle_animalId_idx" ON "AnimalCycle"("animalId");

-- CreateIndex
CREATE INDEX "AnimalCycle_status_idx" ON "AnimalCycle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalCycle_animalId_numeroCiclo_key" ON "AnimalCycle"("animalId", "numeroCiclo");

-- CreateIndex
CREATE UNIQUE INDEX "WeightRecord_clientGeneratedId_key" ON "WeightRecord"("clientGeneratedId");

-- CreateIndex
CREATE INDEX "WeightRecord_animalId_idx" ON "WeightRecord"("animalId");

-- CreateIndex
CREATE INDEX "WeightRecord_cicloId_idx" ON "WeightRecord"("cicloId");

-- CreateIndex
CREATE INDEX "WeightRecord_dataPesagem_idx" ON "WeightRecord"("dataPesagem");

-- CreateIndex
CREATE INDEX "WeightRecord_clientGeneratedId_idx" ON "WeightRecord"("clientGeneratedId");

-- CreateIndex
CREATE UNIQUE INDEX "Vaccination_clientGeneratedId_key" ON "Vaccination"("clientGeneratedId");

-- CreateIndex
CREATE INDEX "Vaccination_animalId_idx" ON "Vaccination"("animalId");

-- CreateIndex
CREATE INDEX "Vaccination_cicloId_idx" ON "Vaccination"("cicloId");

-- CreateIndex
CREATE INDEX "Vaccination_dataAplicacao_idx" ON "Vaccination"("dataAplicacao");

-- CreateIndex
CREATE INDEX "Vaccination_clientGeneratedId_idx" ON "Vaccination"("clientGeneratedId");
