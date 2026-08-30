import { NextRequest, NextResponse } from "next/server";

/**
 * Erro customizado para erros de negócio conhecidos.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Erro para recursos não encontrados.
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} não encontrado`, 404, "NOT_FOUND");
  }
}

/**
 * Erro para acess não autorizado.
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = "Não autenticado") {
    super(message, 401, "UNAUTHORIZED");
  }
}

/**
 * Erro para acesso proibido.
 */
export class ForbiddenError extends AppError {
  constructor(message: string = "Acesso proibido") {
    super(message, 403, "FORBIDDEN");
  }
}

/**
 * Handler padronizado para erros em API routes.
 * Retorna response JSON com mensagem amigável em português.
 */
export function handleApiError(error: unknown): NextResponse {
  // Erros de negócio conhecidos
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  // Erros do Prisma
  if (error && typeof error === "object" && "code" in error) {
    const prismaError = error as { code: string; message: string };

    if (prismaError.code === "P2025") {
      return NextResponse.json(
        { error: "Registro não encontrado", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (prismaError.code === "P2002") {
      return NextResponse.json(
        { error: "Registro já existe", code: "CONFLICT" },
        { status: 409 }
      );
    }
  }

  // Erros de validação do Zod
  if (error && typeof error === "object" && "issues" in error) {
    const zodError = error as { issues: Array<{ message: string }> };
    const messages = zodError.issues.map((i) => i.message);
    return NextResponse.json(
      { error: "Dados inválidos", details: messages, code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  // Erro genérico
  console.error("Unhandled error:", error);
  return NextResponse.json(
    { error: "Erro interno do servidor", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}

/**
 * Wrapper para handlers de API com tratamento automático de erros.
 * Uso: export const GET = apiHandler(async (req) => { ... });
 */
export function apiHandler<TContext = Record<string, unknown>>(
  handler: (req: NextRequest, context: TContext) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: TContext) => {
    try {
      return await handler(req, context);
    } catch (error) {
      return handleApiError(error);
    }
  };
}
