"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/configuracoes/cargos", label: "Cargos" },
  { href: "/configuracoes/motivos-encerramento", label: "Motivos de encerramento" },
  { href: "/configuracoes/origens", label: "Origens" },
  { href: "/configuracoes/planos-conta", label: "Planos de conta" },
  { href: "/configuracoes/redes-sociais", label: "Redes sociais" },
  { href: "/configuracoes/segmentos", label: "Segmentos" },
  { href: "/configuracoes/servicos", label: "Serviços" },
  { href: "/configuracoes/status-conteudo", label: "Status de conteúdo" },
];

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-ink mb-1">Configurações</h1>
        <p className="text-sm text-ink/60 mb-4">
          Campos cadastráveis usados em várias partes do sistema — o que você cadastrar aqui já
          aparece automaticamente nos formulários que usam esses campos.
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
