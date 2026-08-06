"use client";

import Link from "next/link";
import {
  Briefcase,
  AlertTriangle,
  Compass,
  ShieldCheck,
  ListTree,
  Share2,
  Building2,
  Wrench,
  Calendar,
  Trash2,
} from "lucide-react";

const SECOES = [
  { href: "/configuracoes/cargos", label: "Cargos", desc: "Cargos usados no cadastro de funcionários", icon: <Briefcase size={18} /> },
  {
    href: "/configuracoes/modelos-projeto",
    label: "Modelos de Projeto",
    desc: "Projetos com etapas pré-definidas, prontos pra reusar",
    icon: <ListTree size={18} />,
  },
  { href: "/configuracoes/lixeira", label: "Lixeira", desc: "Tarefas, docs e conteúdos excluídos — restaure em até 30 dias", icon: <Trash2 size={18} /> },
  {
    href: "/configuracoes/calendario-conteudo",
    label: "Calendário de Conteúdo",
    desc: "Como o Calendário e o Kanban exibem os posts",
    icon: <Calendar size={18} />,
  },
  {
    href: "/configuracoes/motivos-encerramento",
    label: "Motivos de encerramento",
    desc: "Usados ao encerrar um contrato recorrente",
    icon: <AlertTriangle size={18} />,
  },
  { href: "/configuracoes/origens", label: "Origens", desc: "De onde vieram os clientes", icon: <Compass size={18} /> },
  {
    href: "/configuracoes/perfis-acesso",
    label: "Perfis de acesso",
    desc: "O que cada perfil de usuário pode ver e fazer",
    icon: <ShieldCheck size={18} />,
  },
  { href: "/configuracoes/planos-conta", label: "Planos de conta", desc: "Categorias usadas no DRE", icon: <ListTree size={18} /> },
  { href: "/configuracoes/redes-sociais", label: "Redes sociais", desc: "Usadas no Calendário de Conteúdo", icon: <Share2 size={18} /> },
  { href: "/configuracoes/segmentos", label: "Segmentos", desc: "Segmento de mercado dos clientes", icon: <Building2 size={18} /> },
  { href: "/configuracoes/servicos", label: "Serviços", desc: "Serviços vendidos nos contratos", icon: <Wrench size={18} /> },
  {
    href: "/configuracoes/status-conteudo",
    label: "Status de conteúdo",
    desc: "Etapas do Calendário de Conteúdo",
    icon: <Calendar size={18} />,
  },
];

export default function ConfiguracoesPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-ink mb-1">Configurações</h1>
      <p className="text-sm text-ink/60 mb-8">
        Campos cadastráveis usados em várias partes do sistema — o que você cadastrar aqui já
        aparece automaticamente nos formulários que usam esses campos.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SECOES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center gap-3 rounded-2xl bg-card border border-black/5 p-4 hover:shadow-md hover:border-forest/20 transition-all"
          >
            <span className="shrink-0 h-9 w-9 rounded-xl bg-surface flex items-center justify-center text-ink/60">
              {s.icon}
            </span>
            <span>
              <span className="block text-sm font-bold text-ink">{s.label}</span>
              <span className="block text-xs text-ink/50">{s.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
