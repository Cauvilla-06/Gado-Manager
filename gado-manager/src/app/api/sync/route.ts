import { NextRequest, NextResponse } from "next/server";
import { processSync } from "@/services/sync-service";
import { getCurrentFarm } from "@/lib/farm";

export async function POST(request: NextRequest) {
  try {
    const { farm } = await getCurrentFarm();
    if (!farm) {
      return NextResponse.json(
        { error: "Nenhuma fazenda encontrada" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const result = await processSync(body, farm.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Erro ao processar sincronização" },
      { status: 500 }
    );
  }
}
