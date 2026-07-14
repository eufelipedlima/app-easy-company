"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Users, FileText, ChevronDown, LogOut, Repeat, Package, BarChart3, DollarSign, Receipt, Settings } from "lucide-react";

interface SubItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface Grupo {
  label: string;
  icon: React.ReactNode;
  href?: string;
  itens?: SubItem[];
}

const MENU: Grupo[] = [
  { label: "Pessoas", icon: <Users size={18} />, href: "/pessoas" },
  {
    label: "Contratos",
    icon: <FileText size={18} />,
    itens: [
      { href: "/contratos/recorrentes", label: "Recorrentes", icon: <Repeat size={15} /> },
      { href: "/contratos/pontuais", label: "Pontuais", icon: <Package size={15} /> },
      { href: "/contratos/analise", label: "Análise", icon: <BarChart3 size={15} /> },
    ],
  },
  {
    label: "Financeiro",
    icon: <DollarSign size={18} />,
    itens: [
      { href: "/financeiro/analise", label: "Análise", icon: <BarChart3 size={15} /> },
      { href: "/financeiro/lancamentos", label: "Lançamentos", icon: <Receipt size={15} /> },
      { href: "/financeiro/configuracoes", label: "Configurações", icon: <Settings size={15} /> },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState<string | null>(
    MENU.find((g) => g.itens?.some((i) => pathname?.startsWith(i.href)))?.label ?? "Contratos"
  );

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 bg-ink text-white flex flex-col min-h-screen">
        <div className="px-6 py-7">
          <p className="text-sm font-extrabold tracking-wide">EASY COMPANY</p>
          <p className="text-xs text-white/50 mt-0.5">Sistema interno</p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {MENU.map((grupo) => {
            if (grupo.href) {
              const ativo = pathname?.startsWith(grupo.href);
              return (
                <Link
                  key={grupo.label}
                  href={grupo.href}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    ativo ? "bg-forest text-white" : "text-white/60 hover:bg-forest/50 hover:text-white"
                  }`}
                >
                  {grupo.icon}
                  {grupo.label}
                </Link>
              );
            }

            const expandido = aberto === grupo.label;
            const grupoAtivo = grupo.itens?.some((i) => pathname?.startsWith(i.href));

            return (
              <div key={grupo.label}>
                <button
                  onClick={() => setAberto(expandido ? null : grupo.label)}
                  className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    grupoAtivo ? "text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  {grupo.icon}
                  <span className="flex-1 text-left">{grupo.label}</span>
                  <ChevronDown
                    size={15}
                    className={`transition-transform ${expandido ? "rotate-180" : ""}`}
                  />
                </button>

                {expandido && (
                  <div className="mt-1 ml-3 pl-3 border-l border-white/10 space-y-0.5">
                    {grupo.itens?.map((item) => {
                      const ativo = pathname?.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            ativo ? "bg-forest text-white" : "text-white/50 hover:bg-forest/40 hover:text-white"
                          }`}
                        >
                          {item.icon}
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="px-3 pb-6">
          <button
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              router.replace("/login");
            }}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/50 hover:bg-forest/50 hover:text-white transition-colors"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
