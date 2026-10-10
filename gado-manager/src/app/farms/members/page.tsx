"use client";

import { useState } from "react";
import Link from "next/link";

import { ArrowLeft, Users, Shield, User, Copy, Crown, UserMinus, AlertTriangle } from "lucide-react";
import { useCachedData, invalidateDataCache } from "@/lib/use-cached-data";
import { canRemoveMember } from "@/lib/permissions";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

interface MembersData {
  farm: { name: string; code: string };
  members: Member[];
  me: { id: string; role: string };
}

export default function FarmMembersPage() {
  const { data, loading, error, mutate } = useCachedData<MembersData>(
    "farm:members",
    async () => {
      const res = await fetch("/api/farms/members");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Erro ao carregar membros");
      return body;
    }
  );
  const [copied, setCopied] = useState(false);
  const [toRemove, setToRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const farm = data?.farm ?? null;
  const members = data?.members ?? [];
  const me = data?.me ?? null;

  function copyCode() {
    if (!farm) return;
    navigator.clipboard.writeText(farm.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function confirmRemove() {
    if (!toRemove) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/farms/members/${encodeURIComponent(toRemove.id)}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Erro ao remover membro");

      // Tira da lista na hora e atualiza o resto (contagens do menu etc.)
      mutate((current) => ({
        ...(current as MembersData),
        members: (current?.members ?? []).filter((m) => m.id !== toRemove.id),
      }));
      invalidateDataCache("session");
      setMessage({ text: `${toRemove.name} foi removido(a) da fazenda.`, type: "success" });
      setToRemove(null);
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Erro ao remover membro",
        type: "error",
      });
    } finally {
      setRemoving(false);
    }
  }

  function roleLabel(role: string) {
    switch (role) {
      case "OWNER": return "Proprietário";
      case "ADMIN": return "Admin";
      default: return "Membro";
    }
  }

  function roleIcon(role: string) {
    switch (role) {
      case "OWNER": return Crown;
      case "ADMIN": return Shield;
      default: return User;
    }
  }

  function roleBadgeColor(role: string) {
    switch (role) {
      case "OWNER": return "bg-amber-100 text-amber-800";
      case "ADMIN": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-700";
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-2xl mx-auto rounded-xl border bg-card p-6 text-center animate-fade-in">
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Link href="/" className="mt-3 inline-block text-sm text-primary hover:underline">
          Voltar ao dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="rounded-lg p-2 hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Membros da Fazenda</h1>
          <p className="text-sm text-muted-foreground">
            {members.length} membro(s) — {farm?.name}
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Farm code card */}
      {farm && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1.5 font-medium">
            Código da fazenda
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm font-mono select-all text-center">
              {farm.code}
            </code>
            <button
              onClick={copyCode}
              className="shrink-0 flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Compartilhe este código para que outros possam solicitar entrada
          </p>
        </div>
      )}

      {/* Members list */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="border-b p-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Membros
          </h2>
        </div>
        <div className="divide-y">
          {members.map((member) => {
            const RoleIcon = roleIcon(member.role);
            const isMe = member.id === me?.id;
            const removable = !!me && !isMe && canRemoveMember(me.role, member.role);
            return (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <RoleIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.name}
                      {isMe && (
                        <span className="ml-1.5 text-xs text-muted-foreground">(você)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.email}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeColor(member.role)}`}
                  >
                    {roleLabel(member.role)}
                  </span>
                  {removable && (
                    <button
                      onClick={() => {
                        setMessage(null);
                        setToRemove(member);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                      title={`Remover ${member.name} da fazenda`}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      Remover
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Remove Confirmation Dialog */}
      {toRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget && !removing) setToRemove(null); }}
        >
          <div className="mx-4 w-full max-w-md rounded-xl bg-card p-6 shadow-xl animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Remover membro</h3>
                <p className="text-sm text-muted-foreground">
                  {toRemove.name} ({roleLabel(toRemove.role)})
                </p>
              </div>
            </div>
            <p className="text-sm mb-6">
              A pessoa perde o acesso a esta fazenda imediatamente, no site e no app.
              Os registros que ela já lançou continuam salvos. Para voltar, ela precisa
              pedir entrada de novo.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setToRemove(null)}
                disabled={removing}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRemove}
                disabled={removing}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {removing ? "Removendo..." : "Remover"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
