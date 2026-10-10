"use client";

import { useState } from "react";
import { useSession } from "@/lib/use-session";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, AlertTriangle, Copy } from "lucide-react";

interface FarmInfo {
  id: string;
  name: string;
  code: string;
  role: string;
}

export default function JoinFarmPage() {
  const router = useRouter();
  const [farmCode, setFarmCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  // Mesma sessão do menu (já em cache): sem chamada extra a /api/farms
  const { data: session } = useSession();
  const myFarms: FarmInfo[] = session?.farms ?? [];
  const [copied, setCopied] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      const res = await fetch("/api/farms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmCode: farmCode.trim(), message }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao enviar pedido");
        return;
      }

      setSuccess(true);
      setFarmCode("");
      setMessage("");
    } catch {
      setError("Erro ao enviar pedido");
    } finally {
      setLoading(false);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="max-w-md mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="rounded-lg p-2 hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Entrar em uma fazenda
          </h1>
          <p className="text-sm text-muted-foreground">
            Solicite acesso a uma fazenda existente
          </p>
        </div>
      </div>

      {/* Show user's own farm codes */}
      {myFarms.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-1">Seus códigos de fazenda</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Compartilhe estes códigos com quem quiser entrar:
          </p>
          <div className="space-y-2">
            {myFarms.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <code className="text-xs font-mono text-muted-foreground select-all">
                    {f.code}
                  </code>
                </div>
                <button
                  onClick={() => copyCode(f.code)}
                  className="shrink-0 flex items-center gap-1 rounded-md bg-background border px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  {copied === f.code ? "Copiado!" : "Copiar"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {success ? (
        <div className="rounded-xl border bg-card p-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="font-semibold text-lg">Pedido enviado!</h2>
          <p className="text-sm text-muted-foreground">
            Seu pedido foi enviado para o proprietário da fazenda. Aguarde a
            aprovação.
          </p>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Voltar ao Dashboard
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border bg-card p-6 space-y-4"
        >
          <h3 className="font-semibold">Solicitar acesso</h3>
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Código da Fazenda *</label>
            <input
              type="text"
              value={farmCode}
              onChange={(e) => setFarmCode(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Ex: fazenda-abc123"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              Peça o código ao proprietário da fazenda
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Mensagem (opcional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Apresente-se para o proprietário..."
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !farmCode.trim()}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Enviando..." : "Enviar Pedido"}
            </button>
            <Link
              href="/"
              className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
