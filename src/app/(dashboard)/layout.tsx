"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Users, FileText, ChevronDown, ChevronUp, LogOut, Repeat, Package, BarChart3, DollarSign, Receipt, Settings, UserCheck, Briefcase, HardHat, Landmark, ListTree, Wrench, Wallet, Compass, Building2, FileBarChart } from "lucide-react";

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
  {
    label: "Contratos",
    icon: <FileText size={18} />,
    itens: [
      { href: "/contratos/analise", label: "Análise", icon: <BarChart3 size={15} /> },
      { href: "/contratos/pontuais", label: "Pontuais", icon: <Package size={15} /> },
      { href: "/contratos/recorrentes", label: "Recorrentes", icon: <Repeat size={15} /> },
    ],
  },
  {
    label: "Financeiro",
    icon: <DollarSign size={18} />,
    itens: [
      { href: "/financeiro/analise", label: "Análise", icon: <BarChart3 size={15} /> },
      { href: "/financeiro/bancos", label: "Bancos", icon: <Landmark size={15} /> },
      { href: "/financeiro/dre", label: "DRE", icon: <FileBarChart size={15} /> },
      { href: "/financeiro/lancamentos", label: "Lançamentos", icon: <Receipt size={15} /> },
    ],
  },
  {
    label: "Pessoas",
    icon: <Users size={18} />,
    itens: [
      { href: "/pessoas/clientes", label: "Pessoas", icon: <UserCheck size={15} /> },
      { href: "/pessoas/funcionarios", label: "Funcionários", icon: <Briefcase size={15} /> },
      { href: "/pessoas/prestadores", label: "Prestadores", icon: <HardHat size={15} /> },
    ],
  },
  {
    label: "Configurações",
    icon: <Settings size={18} />,
    itens: [
      { href: "/configuracoes/cargos", label: "Cargos", icon: <Briefcase size={15} /> },
      { href: "/configuracoes/origens", label: "Origens", icon: <Compass size={15} /> },
      { href: "/configuracoes/planos-conta", label: "Planos de conta", icon: <ListTree size={15} /> },
      { href: "/configuracoes/segmentos", label: "Segmentos", icon: <Building2 size={15} /> },
      { href: "/configuracoes/servicos", label: "Serviços", icon: <Wrench size={15} /> },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState<string | null>(
    MENU.find((g) => g.itens?.some((i) => pathname?.startsWith(i.href)))?.label ?? "Pessoas"
  );

  const [contasAbertas, setContasAbertas] = useState(false);
  const [bancos, setBancos] = useState<{ id: string; nome: string; saldo_inicial: number }[]>([]);
  const [lancamentosPagos, setLancamentosPagos] = useState<
    { tipo: string; valor: number; banco_id: string | null; banco_destino_id: string | null }[]
  >([]);

  async function carregarContas() {
    const supabase = createClient();
    const [{ data: b }, { data: l }] = await Promise.all([
      supabase.from("bancos").select("id, nome, saldo_inicial").eq("ativo", true).order("nome"),
      supabase.from("lancamentos").select("tipo, valor, banco_id, banco_destino_id").eq("situacao", "pago"),
    ]);
    setBancos(b ?? []);
    setLancamentosPagos(l ?? []);
  }

  useEffect(() => {
    carregarContas();
    // Recarrega toda vez que muda de página, assim o saldo nunca fica desatualizado
    // sem precisar dar F5.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function saldoDoBanco(bancoId: string, saldoInicial: number) {
    let saldo = saldoInicial;
    for (const l of lancamentosPagos) {
      if (l.tipo === "receita" && l.banco_id === bancoId) saldo += l.valor;
      else if (l.tipo === "despesa" && l.banco_id === bancoId) saldo -= l.valor;
      else if (l.tipo === "transferencia") {
        if (l.banco_id === bancoId) saldo -= l.valor;
        if (l.banco_destino_id === bancoId) saldo += l.valor;
      }
    }
    return saldo;
  }

  const CORES_CONTA = ["bg-violet-400", "bg-teal-400", "bg-amber-400", "bg-rose-400", "bg-sky-400"];
  const saldoTotal = bancos.reduce((s, b) => s + saldoDoBanco(b.id, b.saldo_inicial), 0);

  function formatarMoeda(valor: number) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

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

        <div className="px-3 pb-3 border-t border-white/10 pt-3">
          <button
            onClick={() => {
              setContasAbertas((v) => !v);
              carregarContas();
            }}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/60 hover:text-white transition-colors"
          >
            <Wallet size={16} />
            <span className="flex-1 text-left">Contas</span>
            {contasAbertas ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {contasAbertas && (
            <div className="mt-1 mb-2 rounded-xl bg-white/5 px-3 py-3 space-y-2">
              {bancos.length === 0 ? (
                <p className="text-xs text-white/40">Nenhuma conta cadastrada.</p>
              ) : (
                bancos.map((b, i) => (
                  <div key={b.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-white/70">
                      <span className={`h-2 w-2 rounded-full ${CORES_CONTA[i % CORES_CONTA.length]}`} />
                      {b.nome}
                    </span>
                    <span className="font-semibold text-white">
                      {formatarMoeda(saldoDoBanco(b.id, b.saldo_inicial))}
                    </span>
                  </div>
                ))
              )}
              <div className="flex items-center justify-between text-xs pt-2 border-t border-white/10">
                <span className="text-white/50 uppercase tracking-wide">Saldo total</span>
                <span className="font-bold text-white">{formatarMoeda(saldoTotal)}</span>
              </div>
            </div>
          )}
        </div>

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
