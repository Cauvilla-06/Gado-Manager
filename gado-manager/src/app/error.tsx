"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { useState } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [retried, setRetried] = useState(false);

  async function handleRetry() {
    setRetried(true);
    reset();
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <h1 className="text-2xl font-bold tracking-tight mb-1">Algo deu errado</h1>
        <p className="text-sm text-muted-foreground mb-2">
          Ocorreu um erro inesperado ao carregar a página.
        </p>
        {error.digest && (
          <code className="rounded bg-muted px-2 py-1 text-xs font-mono text-muted-foreground select-all">
            {error.digest}
          </code>
        )}
        <p className="text-xs text-muted-foreground mb-6">
          Se isso continuar acontecendo, avise com o código ao lado.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Home className="h-4 w-4" />
            Voltar ao dashboard
          </Link>
          <button
            onClick={handleRetry}
            disabled={retried}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            {retried ? "Recarregando..." : "Tentar novamente"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function generateStaticParams() {
  return [];
}
