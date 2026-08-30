import { NextRequest, NextResponse } from "next/server";
import { getGeneralReport } from "@/services/report-service";
import { getCurrentFarm } from "@/lib/farm";

export async function GET(request: NextRequest) {
  try {
    const { farm } = await getCurrentFarm();
    if (!farm) {
      return NextResponse.json({ error: "Nenhuma fazenda encontrada" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const periodDays = searchParams.get("periodDays")
      ? parseInt(searchParams.get("periodDays")!)
      : undefined;

    const report = await getGeneralReport(farm.id, { status, periodDays });
    return NextResponse.json(report);
  } catch (error) {
    console.error("Error generating general report:", error);
    return NextResponse.json(
      { error: "Erro ao gerar relatório geral" },
      { status: 500 }
    );
  }
}
