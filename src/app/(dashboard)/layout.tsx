"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Users, FileText, ChevronDown, ChevronUp, ChevronsLeft, LogOut, Repeat, Package, BarChart3, DollarSign, Receipt, Settings, UserCheck, Briefcase, HardHat, Landmark, Wrench, Wallet, Compass, Building2, FileBarChart, AlertTriangle, Calendar, CalendarDays, Share2, ShieldCheck, MessageCircle, UserCircle, Inbox, ListChecks, Home } from "lucide-react";

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
  areaSlug?: string;
}

const MENU: Grupo[] = [
  {
    label: "Início",
    icon: <Home size={18} />,
    href: "/inicio",
  },
  {
    label: "Pauta",
    icon: <CalendarDays size={18} />,
    href: "/inicio/pauta",
  },
  {
    label: "Caixa de Entrada",
    icon: <Inbox size={18} />,
    href: "/caixa-de-entrada",
  },
  {
    label: "Chat",
    icon: <MessageCircle size={18} />,
    href: "/chat",
  },
  {
    label: "Conteúdo",
    icon: <Calendar size={18} />,
    areaSlug: "conteudo",
    href: "/conteudo/calendario",
  },
  {
    label: "Tarefas",
    icon: <ListChecks size={18} />,
    areaSlug: "tarefas",
    href: "/tarefas",
  },
  {
    label: "Central de Clientes",
    icon: <Building2 size={18} />,
    href: "/central-clientes",
  },
  {
    label: "Contratos",
    icon: <FileText size={18} />,
    areaSlug: "contratos",
    itens: [
      { href: "/contratos/analise", label: "Análise", icon: <BarChart3 size={15} /> },
      { href: "/contratos/pontuais", label: "Pontuais", icon: <Package size={15} /> },
      { href: "/contratos/recorrentes", label: "Recorrentes", icon: <Repeat size={15} /> },
    ],
  },
  {
    label: "Financeiro",
    icon: <DollarSign size={18} />,
    areaSlug: "financeiro",
    itens: [
      { href: "/financeiro/analise", label: "Análise", icon: <BarChart3 size={15} /> },
      { href: "/financeiro/bancos", label: "Bancos", icon: <Landmark size={15} /> },
      { href: "/financeiro/despesas-fixas", label: "Despesas Fixas", icon: <Repeat size={15} /> },
      { href: "/financeiro/dre", label: "DRE", icon: <FileBarChart size={15} /> },
      { href: "/financeiro/inadimplencia", label: "Inadimplência", icon: <AlertTriangle size={15} /> },
      { href: "/financeiro/lancamentos", label: "Lançamentos", icon: <Receipt size={15} /> },
    ],
  },
  {
    label: "Pessoas",
    icon: <Users size={18} />,
    areaSlug: "pessoas",
    itens: [
      { href: "/pessoas/clientes", label: "Pessoas", icon: <UserCheck size={15} /> },
      { href: "/pessoas/funcionarios", label: "Funcionários", icon: <Briefcase size={15} /> },
      { href: "/pessoas/prestadores", label: "Prestadores", icon: <HardHat size={15} /> },
    ],
  },
  {
    label: "Configurações",
    icon: <Settings size={18} />,
    areaSlug: "configuracoes",
    href: "/configuracoes",
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState<string | null>(
    MENU.find((g) => g.itens?.some((i) => pathname?.startsWith(i.href)))?.label ?? "Pessoas"
  );

  const [contasAbertas, setContasAbertas] = useState(false);
  const [colapsado, setColapsado] = useState(false);
  const [hoverExpandido, setHoverExpandido] = useState(false);

  useEffect(() => {
    const salvo = localStorage.getItem("menu-colapsado");
    if (salvo === "true") setColapsado(true);
  }, []);

  function alternarColapsado() {
    setColapsado((atual) => {
      const novo = !atual;
      localStorage.setItem("menu-colapsado", String(novo));
      return novo;
    });
  }

  const expandidoVisual = !colapsado || hoverExpandido;

  const [permissoes, setPermissoes] = useState<Record<string, "nenhum" | "visualizar" | "completo"> | null>(null);

  useEffect(() => {
    async function verificarPerfilCompleto() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: funcionario } = await supabase.from("funcionarios").select("perfil_completo").eq("auth_user_id", user.id).maybeSingle();
      if (funcionario && funcionario.perfil_completo === false) {
        router.replace("/completar-perfil");
      }
    }
    verificarPerfilCompleto();
  }, [router]);

  useEffect(() => {
    async function carregarPermissoes() {
      const supabase = createClient();
      const areas = ["financeiro", "contratos", "conteudo", "pessoas", "configuracoes", "tarefas", "docs"];
      const resultados = await Promise.all(areas.map((slug) => supabase.rpc("meu_nivel_acesso", { area_slug: slug })));
      const mapa: Record<string, "nenhum" | "visualizar" | "completo"> = {};
      areas.forEach((slug, i) => {
        mapa[slug] = (resultados[i].data as "nenhum" | "visualizar" | "completo" | null) ?? "completo";
      });
      setPermissoes(mapa);
    }
    carregarPermissoes();
  }, []);

  const menuVisivel = MENU.filter((grupo) => !grupo.areaSlug || !permissoes || permissoes[grupo.areaSlug] !== "nenhum");

  const [chatNaoLidas, setChatNaoLidas] = useState(0);

  const recalcularChatNaoLidas = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: participacoes } = await supabase
      .from("chat_participantes")
      .select("canal_id, ultima_leitura")
      .eq("auth_user_id", user.id);
    if (!participacoes || participacoes.length === 0) {
      setChatNaoLidas(0);
      return;
    }
    const contagens = await Promise.all(
      participacoes.map(async (p) => {
        const { count } = await supabase
          .from("chat_mensagens")
          .select("id", { count: "exact", head: true })
          .eq("canal_id", p.canal_id)
          .gt("created_at", p.ultima_leitura)
          .neq("autor_id", user.id);
        return count ?? 0;
      })
    );
    setChatNaoLidas(contagens.reduce((s, c) => s + c, 0));
  }, []);

  useEffect(() => {
    recalcularChatNaoLidas();
  }, [recalcularChatNaoLidas, pathname]);

  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel("layout-chat-mensagens")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_mensagens" }, () => {
        recalcularChatNaoLidas();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [recalcularChatNaoLidas]);

  const [caixaEntradaNaoLidas, setCaixaEntradaNaoLidas] = useState(0);

  const recalcularCaixaEntrada = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { count } = await supabase
      .from("notificacoes")
      .select("id", { count: "exact", head: true })
      .eq("destinatario_id", user.id)
      .eq("lida", false);
    setCaixaEntradaNaoLidas(count ?? 0);
  }, []);

  useEffect(() => {
    recalcularCaixaEntrada();
  }, [recalcularCaixaEntrada, pathname]);

  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel("layout-notificacoes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificacoes" }, () => {
        recalcularCaixaEntrada();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [recalcularCaixaEntrada]);

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
    <div className="flex min-h-screen relative">
      {colapsado && hoverExpandido && <div className="w-[68px] shrink-0" />}

      <aside
        onMouseEnter={() => colapsado && setHoverExpandido(true)}
        onMouseLeave={() => setHoverExpandido(false)}
        className={`shrink-0 bg-ink text-white flex flex-col min-h-screen transition-all duration-200 ${
          expandidoVisual ? "w-64" : "w-[68px]"
        } ${colapsado && hoverExpandido ? "absolute z-30 left-0 top-0 h-full shadow-2xl" : "relative"}`}
      >
        <div className={`px-6 py-7 flex items-center ${expandidoVisual ? "justify-between" : "justify-center px-0"}`}>
          {expandidoVisual ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo-completa.png" alt="Easy Company" className="h-8 w-auto object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo-reduzida.png" alt="Easy Company" className="h-9 w-auto object-contain" />
          )}
          {expandidoVisual && (
            <button
              onClick={alternarColapsado}
              className="text-white/40 hover:text-white transition-colors shrink-0"
              title={colapsado ? "Fixar menu expandido" : "Minimizar menu"}
            >
              <ChevronsLeft size={18} className={colapsado ? "rotate-180" : ""} />
            </button>
          )}
        </div>

        {!expandidoVisual && (
          <button
            onClick={alternarColapsado}
            className="mx-auto mb-2 text-white/30 hover:text-white transition-colors"
            title="Expandir menu"
          >
            <ChevronsLeft size={16} className="rotate-180" />
          </button>
        )}

        <nav className="flex-1 px-3 space-y-1">
          {menuVisivel.map((grupo) => {
            if (grupo.href) {
              const ativo = pathname?.startsWith(grupo.href);
              const badge =
                grupo.label === "Chat" && chatNaoLidas > 0
                  ? chatNaoLidas
                  : grupo.label === "Caixa de Entrada" && caixaEntradaNaoLidas > 0
                  ? caixaEntradaNaoLidas
                  : null;
              return (
                <Link
                  key={grupo.label}
                  href={grupo.href}
                  title={grupo.label}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    !expandidoVisual ? "justify-center px-0" : ""
                  } ${ativo ? "bg-forest text-white" : "text-white/60 hover:bg-forest/50 hover:text-white"}`}
                >
                  <span className="relative">
                    {grupo.icon}
                    {badge && !expandidoVisual && (
                      <span className="absolute -top-1.5 -right-1.5 h-2 w-2 rounded-full bg-red-500" />
                    )}
                  </span>
                  {expandidoVisual && <span className="flex-1">{grupo.label}</span>}
                  {badge && expandidoVisual && (
                    <span className="shrink-0 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            }

            const expandido = aberto === grupo.label;
            const grupoAtivo = grupo.itens?.some((i) => pathname?.startsWith(i.href));

            return (
              <div key={grupo.label}>
                <button
                  onClick={() => (expandidoVisual ? setAberto(expandido ? null : grupo.label) : undefined)}
                  title={grupo.label}
                  className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    !expandidoVisual ? "justify-center px-0" : ""
                  } ${grupoAtivo ? "text-white" : "text-white/60 hover:text-white"}`}
                >
                  {grupo.icon}
                  {expandidoVisual && (
                    <>
                      <span className="flex-1 text-left">{grupo.label}</span>
                      <ChevronDown size={15} className={`transition-transform ${expandido ? "rotate-180" : ""}`} />
                    </>
                  )}
                </button>

                {expandido && expandidoVisual && (
                  <div className="mt-1 ml-3 pl-3 border-l border-white/10 space-y-0.5">
                    {grupo.itens?.map((item) => {
                      const ativo = pathname === item.href;
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

        {(!permissoes || permissoes.financeiro !== "nenhum") && (
          <div className="px-3 pb-3 border-t border-white/10 pt-3">
            <button
              onClick={() => {
                if (!expandidoVisual) return;
                setContasAbertas((v) => !v);
                carregarContas();
              }}
              title="Contas"
              className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/60 hover:text-white transition-colors ${
                !expandidoVisual ? "justify-center px-0" : ""
              }`}
            >
              <Wallet size={16} />
              {expandidoVisual && (
                <>
                  <span className="flex-1 text-left">Contas</span>
                  {contasAbertas ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </>
              )}
            </button>

            {contasAbertas && expandidoVisual && (
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
        )}

        <div className="px-3 pb-6 space-y-0.5">
          <Link
            href="/perfil"
            title="Meu perfil"
            className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/50 hover:bg-forest/50 hover:text-white transition-colors ${
              !expandidoVisual ? "justify-center px-0" : ""
            }`}
          >
            <UserCircle size={16} />
            {expandidoVisual && "Meu perfil"}
          </Link>
          <button
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              router.replace("/login");
            }}
            title="Sair"
            className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/50 hover:bg-forest/50 hover:text-white transition-colors ${
              !expandidoVisual ? "justify-center px-0" : ""
            }`}
          >
            <LogOut size={16} />
            {expandidoVisual && "Sair"}
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
