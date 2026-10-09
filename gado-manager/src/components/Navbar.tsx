"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LogOut, Beef, ChevronDown, Users, UserCog } from "lucide-react";
import { clearDataCache } from "@/lib/use-cached-data";

interface FarmInfo {
  id: string;
  name: string;
  code: string;
  role: string;
  animalCount: number;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
}

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [farms, setFarms] = useState<FarmInfo[]>([]);
  const [currentFarm, setCurrentFarm] = useState<FarmInfo | null>(null);
  const [showFarmMenu, setShowFarmMenu] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch current user on mount — com cache em sessionStorage para não
  // recarregar tudo a cada F5 / troca de fazenda.
  useEffect(() => {
    async function fetchUser() {
      try {
        const cached = sessionStorage.getItem("gm:user");
        if (cached) {
          setUser(JSON.parse(cached));
          setLoading(false);
          // Revalida em background para pegar mudanças de sessão.
          const res = await fetch("/api/auth/me", { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            if (data.user) {
              setUser(data.user);
              sessionStorage.setItem("gm:user", JSON.stringify(data.user));
            } else {
              sessionStorage.removeItem("gm:user");
              setUser(null);
            }
          } else if (res.status === 401) {
            sessionStorage.removeItem("gm:user");
            setUser(null);
          }
          return;
        }
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          sessionStorage.setItem("gm:user", JSON.stringify(data.user));
        }
      } catch {
        // Not authenticated
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  // Fetch farms when user is known
  useEffect(() => {
    if (!user) return;

    async function loadFarms() {
      try {
        const cached = sessionStorage.getItem("gm:farms");
        if (cached) {
          applyFarms(JSON.parse(cached));
        }
        const res = await fetch("/api/farms", { credentials: "include" });
        const data = await res.json();
        if (Array.isArray(data)) {
          sessionStorage.setItem("gm:farms", JSON.stringify(data));
          applyFarms(data);
        }
      } catch (err) {
        console.error(err);
      }
    }

    function applyFarms(data: FarmInfo[]) {
          setFarms(data);
          if (data.length > 0) {
            const selectedFarmId = document.cookie
              .split("; ")
              .find((c) => c.startsWith("selected-farm-id="))
              ?.split("=")[1];
            const farm = selectedFarmId
              ? data.find((f: FarmInfo) => f.id === selectedFarmId) || data[0]
              : data[0];
            setCurrentFarm(farm);
          }
        }
    loadFarms();
  }, [user]);

  // Fetch pending requests
  useEffect(() => {
    if (!currentFarm || !["OWNER", "ADMIN"].includes(currentFarm.role)) return;

    async function loadRequests() {
      try {
        const res = await fetch("/api/farms/join", { credentials: "include" });
        const data = await res.json();
        if (Array.isArray(data)) {
          setPendingRequests(data.length);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadRequests();
  }, [currentFarm]);

  async function handleLogout(todosDispositivos = false) {
    if (
      todosDispositivos &&
      !window.confirm(
        "Encerrar a sessão em TODOS os dispositivos (celular, bots e outros navegadores)?"
      )
    ) {
      return;
    }
    sessionStorage.removeItem("gm:user");
    sessionStorage.removeItem("gm:farms");
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ todosDispositivos }),
    });
    window.location.href = "/login"; // eslint-disable-line @next/next/no-location-assign-relative-destination
  }

  // Don't render on auth pages
  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <Beef className="h-6 w-6 text-primary" />
            <span className="hidden sm:inline">GadoManager</span>
          </div>
          <div className="ml-auto h-8 w-20 rounded-md bg-muted animate-pulse" />
        </div>
      </header>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <Beef className="h-6 w-6 text-primary" />
            <span className="hidden sm:inline">GadoManager</span>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg tracking-tight"
        >
          <Beef className="h-6 w-6 text-primary" />
          <span className="hidden sm:inline">GadoManager</span>
          <span className="sm:hidden">GM</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Dashboard
          </Link>
          <Link
            href="/animals"
            className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Animais
          </Link>
          <Link
            href="/reports"
            className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Relatórios
          </Link>

          {/* Farm selector */}
          {currentFarm && (
            <div className="relative ml-2">
              <button
                onClick={() => setShowFarmMenu(!showFarmMenu)}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                <Beef className="h-3.5 w-3.5 text-primary" />
                <span className="hidden sm:inline max-w-[120px] truncate">
                  {currentFarm.name}
                </span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {showFarmMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowFarmMenu(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border bg-card shadow-lg">
                    <div className="p-2">
                      <p className="px-2 py-1 text-xs text-muted-foreground font-medium">
                        Minhas Fazendas
                      </p>
                      {farms.map((f) => (
                        <button
                          key={f.id}
                          onClick={async () => {
                            setCurrentFarm(f);
                            setShowFarmMenu(false);
                            await fetch("/api/farms/switch", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ farmId: f.id }),
                            });
                            // Dados pertencem à fazenda: limpa caches.
                            sessionStorage.removeItem("gm:farms");
                            clearDataCache();
                            window.location.reload();
                          }}
                          className={`w-full text-left rounded-md px-2 py-2 text-sm transition-colors ${
                            currentFarm.id === f.id
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-accent"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">{f.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {f.animalCount} 🐄
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">
                              {f.role === "OWNER"
                                ? "Proprietário"
                                : f.role === "ADMIN"
                                ? "Admin"
                                : "Membro"}
                            </span>
                          </div>
                          {currentFarm.id === f.id && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono select-all">
                                {f.code}
                              </code>
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(f.code);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(f.code);
                                  }
                                }}
                                className="text-xs text-primary hover:underline cursor-pointer select-none"
                              >
                                copiar
                              </span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="border-t p-2 space-y-1">
                      <Link
                        href="/farms/members"
                        onClick={() => setShowFarmMenu(false)}
                        className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent w-full"
                      >
                        <UserCog className="h-3.5 w-3.5" />
                        Membros da fazenda
                      </Link>
                      <Link
                        href="/farms/join"
                        onClick={() => setShowFarmMenu(false)}
                        className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent w-full"
                      >
                        🔗 Entrar em outra fazenda
                      </Link>
                      {["OWNER", "ADMIN"].includes(currentFarm.role) && (
                        <Link
                          href="/farms/requests"
                          onClick={() => setShowFarmMenu(false)}
                          className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-accent w-full"
                        >
                          <span className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5" />
                            Pedidos de entrada
                          </span>
                          {pendingRequests > 0 && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                              {pendingRequests}
                            </span>
                          )}
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setShowFarmMenu(false);
                          handleLogout(true);
                        }}
                        className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-red-600 hover:bg-accent w-full text-left"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sair de todos os dispositivos
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* User + logout */}
          <div className="ml-1 flex items-center gap-2">
            <span className="hidden sm:inline text-sm text-muted-foreground">
              {user.name}
            </span>
            <button
              onClick={() => handleLogout()}
              className="rounded-md p-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
