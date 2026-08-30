"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

import { ArrowLeft, Users, Shield, User, Copy, Crown } from "lucide-react";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

interface FarmData {
  name: string;
  code: string;
}

export default function FarmMembersPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [farm, setFarm] = useState<FarmData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.id) setCurrentUserId(data.user.id);
      })
      .catch(() => {});

    fetch("/api/farms/members")
      .then((res) => res.json())
      .then((data) => {
        if (data.members) setMembers(data.members);
        if (data.farm) setFarm(data.farm);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function copyCode() {
    if (!farm) return;
    navigator.clipboard.writeText(farm.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            const isMe = member.id === currentUserId;
            return (
              <div
                key={member.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    <RoleIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {member.name}
                      {isMe && (
                        <span className="ml-1.5 text-xs text-muted-foreground">(você)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeColor(member.role)}`}
                  >
                    {roleLabel(member.role)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
