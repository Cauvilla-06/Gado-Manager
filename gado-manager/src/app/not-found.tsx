import Link from "next/link";
import { AlertTriangle, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h1 className="text-2xl font-bold tracking-tight">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-md">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Home className="h-4 w-4" />
            Voltar ao dashboard
          </Link>
          <Link
            href="/animals"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            Ver animais
          </Link>
        </div>
      </div>
    </div>
  );
}
