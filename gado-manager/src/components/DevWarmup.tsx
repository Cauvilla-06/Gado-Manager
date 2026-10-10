"use client";

import { useEffect } from "react";

/**
 * SÓ EM DESENVOLVIMENTO (`npm run dev`).
 *
 * No modo dev o Next monta cada página e cada rota da API na PRIMEIRA vez que
 * ela é acessada (1 a 7 s). Nesse meio tempo o clique parece "não funcionar" e
 * a página não aparece de primeira. Este componente pede essas rotas em segundo
 * plano, uma por vez, logo depois que o site abre — quando o usuário clicar,
 * já estão prontas. Em produção (`npm run build`) não faz nada.
 */

// ID que não existe: só serve para o Next montar as rotas dinâmicas (/animals/[id]...)
const DUMMY_ID = "00000000-0000-4000-8000-000000000000";

const ROUTES = [
  "/animals",
  `/animals/${DUMMY_ID}`,
  `/api/animals/${DUMMY_ID}`,
  `/animals/${DUMMY_ID}/report`,
  `/api/animals/${DUMMY_ID}/report`,
  `/animals/${DUMMY_ID}/history`,
  "/reports",
  "/api/reports/general",
  "/animals/new",
  "/farms/members",
  "/api/farms/members",
  "/farms/requests",
  "/api/farms/join",
  "/farms/join",
];

const FLAG = "gm:dev-warmup";

export default function DevWarmup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    try {
      if (sessionStorage.getItem(FLAG)) return;
    } catch {
      // sem sessionStorage: aquece mesmo assim
    }

    let cancelled = false;
    const run = async () => {
      // Marca só quando começa de fato: o StrictMode do React (dev) monta,
      // desmonta e monta de novo — marcar antes fazia o aquecimento nunca rodar.
      try {
        if (sessionStorage.getItem(FLAG)) return;
        sessionStorage.setItem(FLAG, "1");
      } catch {
        // ignore
      }
      for (const route of ROUTES) {
        if (cancelled) return;
        try {
          // Rotas da API: OPTIONS (o Next responde sozinho, sem rodar a rota e
          // sem erro 404/403 no console) — só para o Next montá-la.
          await fetch(route, {
            method: route.startsWith("/api/") ? "OPTIONS" : "GET",
            credentials: "include",
          });
        } catch {
          // servidor reiniciando etc.: ignora e segue
        }
      }
    };

    // Começa depois que a página atual terminou de carregar
    const start = () => void run();
    const idle = window.requestIdleCallback?.(start, { timeout: 3000 });
    const timer = idle === undefined ? window.setTimeout(start, 1500) : undefined;

    return () => {
      cancelled = true;
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
