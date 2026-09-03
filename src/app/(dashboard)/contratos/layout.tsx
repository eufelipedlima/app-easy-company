"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/contratos/recorrentes", label: "Recorrentes" },
  { href: "/contratos/pontuais", label: "Pontuais" },
  { href: "/contratos/analise", label: "Análise" },
];

export default function ContratosLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="w-full px-6 sm:px-8 lg:px-10 py-10">
      <div className="flex items-center gap-6 border-b-2 border-black/5 mb-8">
        {ABAS.map((aba) => {
          const ativo = pathname?.startsWith(aba.href);
          return (
            <Link
              key={aba.href}
              href={aba.href}
              className={`relative pb-3 text-sm font-bold transition-colors ${ativo ? "text-ink" : "text-ink/40 hover:text-ink/70"}`}
            >
              {aba.label}
              {ativo && <span className="absolute left-0 right-0 -bottom-0.5 h-[3px] rounded-full bg-ink" />}
            </Link>
          );
        })}
      </div>
      {children}
    </main>
  );
}
