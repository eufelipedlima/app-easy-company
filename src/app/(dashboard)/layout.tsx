"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tocarSomCaixaEntrada, tocarSomMensagemPrivada, tocarSomMensagemGrupo } from "@/lib/sons";
import { Users, Users2, FileText, ChevronDown, ChevronUp, ChevronsLeft, LogOut, Repeat, Package, BarChart3, DollarSign, Receipt, Settings, UserCheck, Briefcase, HardHat, Landmark, Wrench, Wallet, Compass, Building2, FileBarChart, AlertTriangle, Calendar, CalendarDays, Share2, ShieldCheck, MessageCircle, UserCircle, Inbox, ListChecks, Home, Menu, X } from "lucide-react";

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
    label: "Chat",
    icon: <MessageCircle size={18} />,
    href: "/chat",
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
    label: "Central de Clientes",
    icon: <Building2 size={18} />,
    href: "/central-clientes",
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
    label: "Meu Time",
    icon: <Users2 size={18} />,
    areaSlug: "equipe",
    href: "/equipe",
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
  const [aberto, setAberto] = useState<string | null>(null);

  const [contasAbertas, setContasAbertas] = useState(false);
  const [colapsado, setColapsado] = useState(false);
  const [hoverExpandido, setHoverExpandido] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  useEffect(() => {
    setMenuMobileAberto(false);
  }, [pathname]);

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

  // Sons de notificação — tocam em qualquer tela do sistema, não só
  // quando a pessoa está no Chat ou na Caixa de Entrada.
  useEffect(() => {
    let canalNotificacoes: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    let canalMensagens: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

    async function iniciar() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: participacoes } = await supabase
        .from("chat_participantes")
        .select("canal_id, chat_canais ( tipo )")
        .eq("auth_user_id", user.id);
      const tipoPorCanal = new Map<string, string>();
      for (const p of (participacoes ?? []) as unknown as { canal_id: string; chat_canais: { tipo: string } | null }[]) {
        if (p.chat_canais?.tipo) tipoPorCanal.set(p.canal_id, p.chat_canais.tipo);
      }

      canalNotificacoes = supabase
        .channel("som-notificacoes")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notificacoes", filter: `destinatario_id=eq.${user.id}` },
          () => tocarSomCaixaEntrada()
        )
        .subscribe();

      canalMensagens = supabase
        .channel("som-mensagens")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_mensagens" }, (payload) => {
          const nova = payload.new as { autor_id: string; canal_id: string };
          if (nova.autor_id === user.id) return;
          const tipo = tipoPorCanal.get(nova.canal_id);
          if (!tipo) return;
          if (tipo === "dm") tocarSomMensagemPrivada();
          else tocarSomMensagemGrupo();
        })
        .subscribe();
    }
    iniciar();

    return () => {
      if (canalNotificacoes) createClient().removeChannel(canalNotificacoes);
      if (canalMensagens) createClient().removeChannel(canalMensagens);
    };
  }, []);

  useEffect(() => {
    async function carregarPermissoes() {
      const supabase = createClient();
      const areas = ["financeiro", "contratos", "conteudo", "pessoas", "configuracoes", "tarefas", "docs", "equipe"];
      const resultados = await Promise.all(areas.map((slug) => supabase.rpc("meu_nivel_acesso", { area_slug: slug })));
      const mapa: Record<string, "nenhum" | "visualizar" | "completo"> = {};
      areas.forEach((slug, i) => {
        mapa[slug] = (resultados[i].data as "nenhum" | "visualizar" | "completo" | null) ?? "completo";
      });
      setPermissoes(mapa);
    }
    carregarPermissoes();
  }, []);

  // Trava de verdade: mesmo digitando o link direto, quem não tem
  // permissão pra área é mandado de volta pro Início — não é só
  // esconder do menu, o acesso à página em si fica bloqueado.
  const PREFIXO_PARA_AREA: Record<string, string> = {
    "/financeiro": "financeiro",
    "/contratos": "contratos",
    "/conteudo": "conteudo",
    "/pessoas": "pessoas",
    "/configuracoes": "configuracoes",
    "/tarefas": "tarefas",
    "/docs": "docs",
    "/equipe": "equipe",
  };
  useEffect(() => {
    if (!permissoes || !pathname) return;
    const prefixo = Object.keys(PREFIXO_PARA_AREA).find((p) => pathname.startsWith(p));
    if (prefixo && permissoes[PREFIXO_PARA_AREA[prefixo]] === "nenhum") {
      router.replace("/inicio");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissoes, pathname]);

  const acessoBloqueado =
    !!permissoes &&
    !!Object.keys(PREFIXO_PARA_AREA).find((p) => pathname?.startsWith(p) && permissoes[PREFIXO_PARA_AREA[p]] === "nenhum");

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
    <div className="flex h-screen overflow-hidden relative">
      {/* Barra superior — só no celular/tablet, abre a gaveta do menu */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-ink text-white flex items-center justify-between px-4 z-20">
        <button onClick={() => setMenuMobileAberto(true)} className="text-white/70 hover:text-white transition-colors" title="Abrir menu">
          <Menu size={22} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-reduzida.png" alt="Easy Company" className="h-7 w-auto object-contain" />
        <span className="w-[22px]" />
      </div>

      {/* Fundo escurecido atrás da gaveta aberta no mobile */}
      {menuMobileAberto && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-30 anim-entrada-escala"
          onClick={() => setMenuMobileAberto(false)}
        />
      )}

      {colapsado && hoverExpandido && <div className="hidden lg:block w-[68px] shrink-0" />}

      <aside
        onMouseEnter={() => colapsado && setHoverExpandido(true)}
        onMouseLeave={() => setHoverExpandido(false)}
        className={`shrink-0 bg-ink text-white flex flex-col h-full transition-all duration-200 fixed lg:static inset-y-0 left-0 z-40 w-64 ${
          menuMobileAberto ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 ${expandidoVisual ? "lg:w-64" : "lg:w-[68px]"} ${
          colapsado && hoverExpandido ? "lg:absolute lg:z-30 lg:left-0 lg:top-0 lg:h-full lg:shadow-2xl" : "lg:relative"
        }`}
      >
        <div className={`px-6 py-7 flex items-center justify-between ${expandidoVisual ? "" : "lg:justify-center lg:px-0"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-completa.png" alt="Easy Company" className={`h-8 w-auto object-contain ${expandidoVisual ? "lg:block" : "lg:hidden"}`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-reduzida.png" alt="Easy Company" className={`h-9 w-auto object-contain hidden ${expandidoVisual ? "" : "lg:block"}`} />
          <button
            onClick={() => setMenuMobileAberto(false)}
            className="lg:hidden text-white/40 hover:text-white transition-colors shrink-0"
            title="Fechar menu"
          >
            <X size={20} />
          </button>
          {expandidoVisual && (
            <button
              onClick={alternarColapsado}
              className="hidden lg:block text-white/40 hover:text-white transition-colors shrink-0"
              title={colapsado ? "Fixar menu expandido" : "Minimizar menu"}
            >
              <ChevronsLeft size={18} className={colapsado ? "rotate-180" : ""} />
            </button>
          )}
        </div>

        {!expandidoVisual && (
          <button
            onClick={alternarColapsado}
            className="hidden lg:block mx-auto mb-2 text-white/30 hover:text-white transition-colors"
            title="Expandir menu"
          >
            <ChevronsLeft size={16} className="rotate-180" />
          </button>
        )}

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto min-h-0">
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

      <div className="flex-1 min-w-0 h-full overflow-y-auto pt-14 lg:pt-0">{acessoBloqueado ? null : children}</div>
    </div>
  );
}
