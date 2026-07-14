"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/pessoas/clientes", label: "Clientes" },
  { href: "/pessoas/funcionarios", label: "Funcionários" },
  { href: "/pessoas/prestadores", label: "Prestadores" },
];

export default function PessoasLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-ink mb-1">Pessoas</h1>
        <p className="text-sm text-ink/60 mb-4">
          Cadastro central de clientes, funcionários e prestadores da Easy Company.
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
