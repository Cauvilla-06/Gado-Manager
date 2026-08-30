import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

// Read runtime tunnel URL to allow cross-origin dev requests
function getAllowedDevOrigins(): string[] {
  const origins = ["192.168.1.175"];
  try {
    const configPath = path.join(process.cwd(), ".runtime-config", "server-url.json");
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);
    if (config.url) {
      const hostname = new URL(config.url).hostname;
      origins.push(hostname);
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

  async headers() {
    return [
      {
        // Aplicar headers em todas as rotas da API
        source: "/api/:path*",
        headers: [
          ...securityHeaders,
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.CORS_ORIGIN || "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-User-Id",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
          {
            key: "Access-Control-Max-Age",
            value: "86400",
          },
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
