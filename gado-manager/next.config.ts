import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

// Read runtime tunnel URL to allow cross-origin dev requests
function getAllowedDevOrigins(): string[] {
  // O Cloudflare Tunnel gera um subdominio *.trycloudflare.com NOVO a cada execucao.
  // O wildcard garante que o site sempre funcione pelo link do tunnel, sem precisar
  // reiniciar o servidor nem editar esta config a cada URL nova.
  const origins = ["192.168.1.175", "*.trycloudflare.com"];
  try {
    const configPath = path.join(process.cwd(), ".runtime-config", "server-url.json");
    const raw = fs.readFileSync(configPath, "utf-8").replace(/^\uFEFF/, "");
    const config = JSON.parse(raw);
    if (config.url) {
      const hostname = new URL(config.url).hostname;
      if (!origins.includes(hostname)) {
        origins.push(hostname);
      }
    }
  } catch {
    // Config not found, ignore
  }
  return origins;
}

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  allowedDevOrigins: getAllowedDevOrigins(),

  // Otimizações de performance
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Webpack config para code splitting
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },

  async headers() {
    return [
      {
        // Cache agressivo para assets estáticos
        source: "/(.*)\\.(ico|png|svg|jpg|jpeg|gif|webp|woff|woff2|ttf|eot)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache para rotas de API com dados que mudam pouco
        source: "/api/dashboard/stats",
        headers: [
          {
            key: "Cache-Control",
            value: "private, s-maxage=30, stale-while-revalidate=60",
          },
        ],
      },
      {
        // Cache para API de config
        source: "/api/config/server-url",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
      {
        // Aplicar headers em todas as rotas da API
        // CORS restrito (audit 3.2): sem Allow-Origin * quando se usa credenciais.
        // O CORS_ORIGIN define domínios permitidos; padrão: mesmo origem (sem header CORS).
        source: "/api/:path*",
        headers: [
          ...securityHeaders,
          ...(process.env.CORS_ORIGIN
            ? [
                {
                  key: "Access-Control-Allow-Origin",
                  value: process.env.CORS_ORIGIN,
                },
                {
                  key: "Access-Control-Allow-Methods",
                  value: "GET, POST, PUT, DELETE, OPTIONS",
                },
                {
                  key: "Access-Control-Allow-Headers",
                  value: "Content-Type, Authorization",
                },
                {
                  key: "Access-Control-Allow-Credentials",
                  value: "true",
                },
                {
                  key: "Access-Control-Max-Age",
                  value: "86400",
                },
              ]
            : []),
        ],
      },
      {
        // Aplicar security headers em todas as rotas
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
