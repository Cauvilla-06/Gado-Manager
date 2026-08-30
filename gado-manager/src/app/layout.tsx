import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "GadoManager — Sistema de Gestão de Gado",
  description: "Sistema completo para gerenciamento de gado com controle de pesagens, vacinas, ciclos e relatórios.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background antialiased">
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
