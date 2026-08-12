"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/financeiro/configuracoes/planos-conta", label: "Planos de conta" },
  { href: "/financeiro/configuracoes/bancos", label: "Bancos" },
];

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="w-full px-6 sm:px-8 lg:px-10 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-ink mb-1">Configurações financeiras</h1>
        <p className="text-sm text-ink/60 mb-4">
          Cadastre os bancos e planos de conta usados nos lançamentos.
        </p>
        <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1">
          {ABAS.map((aba) => {
            const ativo = pathname?.startsWith(aba.href);
            return (
              <Link
                key={aba.href}
                href={aba.href}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                  ativo ? "bg-ink text-white" : "text-ink/60 hover:text-ink"
                }`}
              >
                {aba.label}
              </Link>
            );
          })}
        </div>
      </div>
      {children}
    </main>
  );
}
