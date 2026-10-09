import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { randomBytes } from "crypto";

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL || "file:./prisma/dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Proteção: o seed cria dados e uma conta de demonstração. Rodar contra o
  // banco remoto (Turso) por engano deixaria essa conta em produção.
  const isRemote = !!process.env.TURSO_DATABASE_URL && !process.env.TURSO_DATABASE_URL.startsWith("file:");
  if (isRemote && process.env.SEED_ALLOW_REMOTE !== "1") {
    console.error(
      "Seed cancelado: TURSO_DATABASE_URL aponta para um banco remoto.\n" +
        "Se tiver certeza, rode com SEED_ALLOW_REMOTE=1."
    );
    process.exit(1);
  }

  console.log("Seeding database...");

  // Create demo user — senha via SEED_DEMO_PASSWORD ou gerada aleatoriamente
  const demoPassword =
    process.env.SEED_DEMO_PASSWORD || `demo-${randomBytes(9).toString("base64url")}1`;
  const passwordHash = await bcrypt.hash(demoPassword, 12);
  const user = await prisma.user.create({
    data: {
      name: "Demo User",
      email: "demo@gado.com",
      passwordHash,
    },
  });

  // Create farm
  const farm = await prisma.farm.create({
    data: {
      name: "Fazenda Demo",
      code: "fazenda-demo",
    },
  });

  // Create membership
  await prisma.farmMembership.create({
    data: {
      userId: user.id,
      farmId: farm.id,
      role: "OWNER",
    },
  });

  // Create second farm for testing farm switch
  const farm2 = await prisma.farm.create({
    data: {
      name: "Fazenda Secundária",
      code: "fazenda-sec",
    },
  });

  await prisma.farmMembership.create({
    data: {
      userId: user.id,
      farmId: farm2.id,
      role: "OWNER",
    },
  });

  // Create sample animals on farm 1
  const animal1 = await prisma.animal.create({
    data: { numeroIdentificacao: "001", status: "ATIVO", farmId: farm.id },
  });

  const animal2 = await prisma.animal.create({
    data: { numeroIdentificacao: "002", status: "ATIVO", farmId: farm.id },
  });

  const animal3 = await prisma.animal.create({
    data: { numeroIdentificacao: "157", status: "ATIVO", farmId: farm.id },
  });

  // Create sample animals on farm 2
  const animal4 = await prisma.animal.create({
    data: { numeroIdentificacao: "201", status: "ATIVO", farmId: farm2.id },
  });

  const animal5 = await prisma.animal.create({
    data: { numeroIdentificacao: "202", status: "ATIVO", farmId: farm2.id },
  });

  // Create cycles
  const cycle1 = await prisma.animalCycle.create({
    data: { animalId: animal1.id, numeroCiclo: 1, status: "ATIVO" },
  });

  const cycle2 = await prisma.animalCycle.create({
    data: { animalId: animal2.id, numeroCiclo: 1, status: "ATIVO" },
  });

  const cycle3 = await prisma.animalCycle.create({
    data: { animalId: animal3.id, numeroCiclo: 1, status: "ATIVO" },
  });

  const cycle4 = await prisma.animalCycle.create({
    data: { animalId: animal4.id, numeroCiclo: 1, status: "ATIVO" },
  });

  const cycle5 = await prisma.animalCycle.create({
    data: { animalId: animal5.id, numeroCiclo: 1, status: "ATIVO" },
  });

  // Update animals with current cycle
  await prisma.animal.update({ where: { id: animal1.id }, data: { cicloAtualId: cycle1.id } });
  await prisma.animal.update({ where: { id: animal2.id }, data: { cicloAtualId: cycle2.id } });
  await prisma.animal.update({ where: { id: animal3.id }, data: { cicloAtualId: cycle3.id } });
  await prisma.animal.update({ where: { id: animal4.id }, data: { cicloAtualId: cycle4.id } });
  await prisma.animal.update({ where: { id: animal5.id }, data: { cicloAtualId: cycle5.id } });

  // Create weight records for animal 001
  const weightDates1 = ["2026-07-01", "2026-07-08", "2026-07-15", "2026-07-22", "2026-07-29", "2026-08-05", "2026-08-12", "2026-08-19"];
  const weights1 = [380, 388, 395, 401, 408, 415, 422, 430];

  for (let i = 0; i < weightDates1.length; i++) {
    await prisma.weightRecord.create({
      data: {
        animalId: animal1.id,
        cicloId: cycle1.id,
        pesoKg: weights1[i],
        dataPesagem: new Date(weightDates1[i]),
        origem: "WEB",
        sincronizado: true,
      },
    });
  }

  // Create weight records for animal 002
  const weightDates2 = ["2026-07-10", "2026-07-17", "2026-07-24", "2026-07-31", "2026-08-07", "2026-08-14"];
  const weights2 = [420, 428, 435, 441, 448, 456];

  for (let i = 0; i < weightDates2.length; i++) {
    await prisma.weightRecord.create({
      data: {
        animalId: animal2.id,
        cicloId: cycle2.id,
        pesoKg: weights2[i],
        dataPesagem: new Date(weightDates2[i]),
        origem: "WEB",
        sincronizado: true,
      },
    });
  }

  // Create weight records for animal 157
  const weightDates3 = ["2026-08-01", "2026-08-08", "2026-08-15", "2026-08-22"];
  const weights3 = [420, 430, 438, 451];

  for (let i = 0; i < weightDates3.length; i++) {
    await prisma.weightRecord.create({
      data: {
        animalId: animal3.id,
        cicloId: cycle3.id,
        pesoKg: weights3[i],
        dataPesagem: new Date(weightDates3[i]),
        origem: "WEB",
        sincronizado: true,
      },
    });
  }

  // Create weight records for farm 2 animals
  const weightDates4 = ["2026-08-01", "2026-08-08", "2026-08-15"];
  const weights4 = [350, 358, 365];

  for (let i = 0; i < weightDates4.length; i++) {
    await prisma.weightRecord.create({
      data: {
        animalId: animal4.id,
        cicloId: cycle4.id,
        pesoKg: weights4[i],
        dataPesagem: new Date(weightDates4[i]),
        origem: "WEB",
        sincronizado: true,
      },
    });
  }

  // Create vaccinations
  await prisma.vaccination.create({
    data: {
      animalId: animal1.id,
      cicloId: cycle1.id,
      nomeVacina: "Febre Aftosa",
      dataAplicacao: new Date("2026-07-05"),
      dataProximaDose: new Date("2026-10-05"),
      lote: "FA-2026-A",
      observacao: "Primeira dose do ciclo",
    },
  });

  await prisma.vaccination.create({
    data: {
      animalId: animal1.id,
      cicloId: cycle1.id,
      nomeVacina: "Brucelose",
      dataAplicacao: new Date("2026-07-15"),
      lote: "BR-2026-01",
    },
  });

  await prisma.vaccination.create({
    data: {
      animalId: animal2.id,
      cicloId: cycle2.id,
      nomeVacina: "Clostridiose",
      dataAplicacao: new Date("2026-07-12"),
      dataProximaDose: new Date("2026-08-12"),
      lote: "CL-2026-B",
    },
  });

  await prisma.vaccination.create({
    data: {
      animalId: animal3.id,
      cicloId: cycle3.id,
      nomeVacina: "Febre Aftosa",
      dataAplicacao: new Date("2026-08-05"),
      lote: "FA-2026-C",
    },
  });

  console.log("Seed completed successfully!");
  console.log(`Demo login: demo@gado.com / ${demoPassword}`);
  console.log(`Farm codes: fazenda-demo, fazenda-sec`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
