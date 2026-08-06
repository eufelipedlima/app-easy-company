"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/configuracoes/cargos", label: "Cargos" },
  { href: "/configuracoes/modelos-projeto", label: "Modelos de Projeto" },
  { href: "/configuracoes/lixeira", label: "Lixeira" },
  { href: "/configuracoes/calendario-conteudo", label: "Calendário de Conteúdo" },
  { href: "/configuracoes/motivos-encerramento", label: "Motivos de encerramento" },
  { href: "/configuracoes/origens", label: "Origens" },
  { href: "/configuracoes/perfis-acesso", label: "Perfis de acesso" },
  { href: "/configuracoes/planos-conta", label: "Planos de conta" },
  { href: "/configuracoes/redes-sociais", label: "Redes sociais" },
  { href: "/configuracoes/segmentos", label: "Segmentos" },
  { href: "/configuracoes/servicos", label: "Serviços" },
  { href: "/configuracoes/status-conteudo", label: "Status de conteúdo" },
];

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const naPaginaInicial = pathname === "/configuracoes";
  const abaAtual = ABAS.find((a) => pathname?.startsWith(a.href));

  if (naPaginaInicial) {
    return <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/configuracoes"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/50 hover:text-ink mb-5"
      >
        ← Configurações
      </Link>
      {abaAtual && <h1 className="text-2xl font-extrabold text-ink mb-6">{abaAtual.label}</h1>}
      {children}
    </main>
  );
}
