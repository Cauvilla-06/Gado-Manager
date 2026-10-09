import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/farm";
import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { apiHandler } from "@/lib/api-errors";
import { farmNameSchema } from "@/lib/validations";

export const GET = apiHandler(async () => {
  const user = await requireUser();

  const memberships = await db.farmMembership.findMany({
    where: { userId: user.id },
    include: {
      farm: {
        include: {
          _count: { select: { animals: true, memberships: true } },
        },
      },
    },
    orderBy: { criadoEm: "asc" },
  });

  const farms = memberships.map((m) => ({
    ...m.farm,
    role: m.role,
    animalCount: m.farm._count.animals,
    memberCount: m.farm._count.memberships,
  }));

  return NextResponse.json(farms);
});

export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireUser();

  const body = await request.json();
  const name = farmNameSchema.parse(body?.name);

  // Generate a unique code for the farm
  const shortId = uuidv4().replace(/-/g, "").substring(0, 8);
  const code = `farm-${shortId}`;

  // Create farm and add user as OWNER in a transaction
  const farm = await db.$transaction(async (tx) => {
    const newFarm = await tx.farm.create({
      data: {
        name,
        code,
      },
    });

    await tx.farmMembership.create({
      data: {
        userId: user.id,
        farmId: newFarm.id,
        role: "OWNER",
      },
    });

    return newFarm;
  });

  return NextResponse.json({ success: true, farm }, { status: 201 });
});
