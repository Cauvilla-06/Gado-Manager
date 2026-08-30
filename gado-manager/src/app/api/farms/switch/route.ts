import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { farmId } = body;

    if (!farmId) {
      return NextResponse.json({ error: "farmId obrigatório" }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true });

    // Set cookie that expires in 30 days
    response.cookies.set("selected-farm-id", farmId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Erro ao trocar fazenda" }, { status: 500 });
  }
}
