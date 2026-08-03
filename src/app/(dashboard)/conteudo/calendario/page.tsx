"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { corDoStatus } from "@/lib/status-conteudo";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

interface Midia {
  id: string;
  arquivo_path: string;
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
  ordem: number;
  url?: string;
}

interface StatusItem {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

interface Post {
  id: string;
  cliente_id: string;
  titulo: string | null;
  data_publicacao: string;
  hora_publicacao: string | null;
  legenda: string | null;
  objetivo: "atracao" | "educacao" | "conversao" | null;
  formato: "estatico" | "carrossel" | "video" | null;
  status_id: string;
  responsavel_id: string | null;
  observacoes_internas: string | null;
  clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
  funcionarios: { papeis: { pessoas: { nome: string } | null } | null } | null;
  posts_conteudo_midias: Midia[];
  status_conteudo: { nome: string; cor: string } | null;
}

interface CamposVisiveis {
  titulo: boolean;
  cliente: boolean;
  formato: boolean;
  responsavel: boolean;
}

const CAMPOS_VISIVEIS_PADRAO: CamposVisiveis = { titulo: true, cliente: true, formato: true, responsavel: true };

function carregarCamposVisiveis(): CamposVisiveis {
  if (typeof window === "undefined") return CAMPOS_VISIVEIS_PADRAO;
  try {
    const salvo = localStorage.getItem("conteudo-campos-visiveis");
    return salvo ? { ...CAMPOS_VISIVEIS_PADRAO, ...JSON.parse(salvo) } : CAMPOS_VISIVEIS_PADRAO;
  } catch {
    return CAMPOS_VISIVEIS_PADRAO;
  }
}

function nomeResponsavel(p: Post) {
  return p.funcionarios?.papeis?.pessoas?.nome ?? null;
}

interface ClienteOpcao {
  id: string;
  nome: string;
}

const OBJETIVO_CONFIG: Record<string, { label: string }> = {
  atracao: { label: "Atração" },
  educacao: { label: "Educação" },
  conversao: { label: "Conversão" },
};

const FORMATO_CONFIG: Record<string, { label: string }> = {
  estatico: { label: "Estático" },
  carrossel: { label: "Carrossel" },
  video: { label: "Vídeo" },
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "🥰", "😎", "🤩", "🥳",
  "👍", "👏", "🙌", "🔥", "✨", "💥", "💪", "🙏", "❤️", "💛",
  "💚", "💙", "💜", "⭐", "🎉", "🎯", "📈", "📸", "🎬", "🎁",
  "✅", "❗", "❓", "👀", "💡", "📌", "🚀", "🌟", "😉", "😄",
];

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatarDataChip(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// Um cliente só entra no calendário de conteúdo se tiver pelo menos um contrato
// recorrente ativo usando um serviço marcado como "Gera Calendário de Conteúdo"
// (isso é configurado em Configurações → Serviços).
async function buscarClientesComConteudo(
  supabase: ReturnType<typeof createClient>
): Promise<(ClienteOpcao & { token: string })[]> {
  const { data: servicosValidos } = await supabase
    .from("servicos")
    .select("id")
    .eq("gera_calendario_conteudo", true);
  const idsServicos = (servicosValidos ?? []).map((s) => s.id);
  if (idsServicos.length === 0) return [];

  const { data: contratosValidos } = await supabase
    .from("contratos")
    .select("cliente_id")
    .eq("tipo_contrato", "recorrente")
    .eq("status", "ativo")
    .in("servico_id", idsServicos);
  const idsClientes = [...new Set((contratosValidos ?? []).map((c) => c.cliente_id).filter(Boolean))];
  if (idsClientes.length === 0) return [];

  const { data } = await supabase
    .from("clientes")
    .select("id, link_publico_token, papeis ( pessoas ( nome ) )")
    .in("id", idsClientes);
  return ((data ?? []) as unknown as {
    id: string;
    link_publico_token: string;
    papeis: { pessoas: { nome: string } | null } | null;
  }[])
    .map((c) => ({ id: c.id, nome: c.papeis?.pessoas?.nome ?? "—", token: c.link_publico_token }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

function nomeCliente(p: Post) {
  return p.clientes?.papeis?.pessoas?.nome ?? "—";
}

export function CalendarioConteudoConteudo({ viewInicial }: { viewInicial: "calendario" | "kanban" }) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [clienteFiltroId, setClienteFiltroId] = useState("");
  const [clientes, setClientes] = useState<ClienteOpcao[]>([]);
  const [statusList, setStatusList] = useState<StatusItem[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Post | null>(null);
  const [novoEmData, setNovoEmData] = useState<string | null>(null);
  const [linkPublicoAberto, setLinkPublicoAberto] = useState(false);
  const [camposVisiveis, setCamposVisiveis] = useState<CamposVisiveis>(CAMPOS_VISIVEIS_PADRAO);
  const [painelCamposAberto, setPainelCamposAberto] = useState(false);

  useEffect(() => {
    setCamposVisiveis(carregarCamposVisiveis());
  }, []);

  function alternarCampoVisivel(campo: keyof CamposVisiveis) {
    setCamposVisiveis((atual) => {
      const novo = { ...atual, [campo]: !atual[campo] };
      localStorage.setItem("conteudo-campos-visiveis", JSON.stringify(novo));
      return novo;
    });
  }
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [visualizacao, setVisualizacao] = useState<"calendario" | "kanban">(viewInicial);
  const [postsKanban, setPostsKanban] = useState<Post[]>([]);
  const [loadingKanban, setLoadingKanban] = useState(false);
  const [mesKanban, setMesKanban] = useState(hoje.getMonth());
  const [anoKanban, setAnoKanban] = useState(hoje.getFullYear());
  const [todosOsMesesKanban, setTodosOsMesesKanban] = useState(false);
  const kanbanScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = kanbanScrollRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!el) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [visualizacao]);

  const carregarKanban = useCallback(async () => {
    setLoadingKanban(true);
    const supabase = createClient();
    let query = supabase
      .from("posts_conteudo")
      .select(
        `id, cliente_id, titulo, data_publicacao, hora_publicacao, legenda, objetivo, formato, status_id, responsavel_id, observacoes_internas,
         clientes ( papeis ( pessoas ( nome ) ) ),
         funcionarios ( papeis ( pessoas ( nome ) ) ),
         posts_conteudo_midias ( id, arquivo_path, arquivo_nome, arquivo_tipo, ordem ),
         status_conteudo ( nome, cor )`
      )
      .order("data_publicacao");
    if (clienteFiltroId) query = query.eq("cliente_id", clienteFiltroId);
    const { data, error } = await query;
    if (error) console.error("Erro ao carregar kanban:", error);
    setPostsKanban((data as unknown as Post[]) ?? []);
    setLoadingKanban(false);
  }, [clienteFiltroId]);

  async function moverCardStatus(postId: string, novoStatusId: string) {
    setPostsKanban((atual) => atual.map((p) => (p.id === postId ? { ...p, status_id: novoStatusId } : p)));
    const supabase = createClient();
    await supabase.from("posts_conteudo").update({ status_id: novoStatusId }).eq("id", postId);
    carregarKanban();
  }

  const carregarClientes = useCallback(async () => {
    const supabase = createClient();
    const lista = await buscarClientesComConteudo(supabase);
    setClientes(lista);
  }, []);

  const carregarStatus = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("status_conteudo").select("id, nome, cor, ordem").order("ordem");
    setStatusList(data ?? []);
  }, []);

  const carregarPosts = useCallback(async () => {
    setLoading(true);
    setErroCarregamento(null);
    const supabase = createClient();
    const inicio = toISODate(new Date(ano, mes, 1));
    const fim = toISODate(new Date(ano, mes + 1, 0));
    let query = supabase
      .from("posts_conteudo")
      .select(
        `id, cliente_id, titulo, data_publicacao, hora_publicacao, legenda, objetivo, formato, status_id, responsavel_id, observacoes_internas,
         clientes ( papeis ( pessoas ( nome ) ) ),
         funcionarios ( papeis ( pessoas ( nome ) ) ),
         posts_conteudo_midias ( id, arquivo_path, arquivo_nome, arquivo_tipo, ordem ),
         status_conteudo ( nome, cor )`
      )
      .gte("data_publicacao", inicio)
      .lte("data_publicacao", fim)
      .order("data_publicacao");
    if (clienteFiltroId) query = query.eq("cliente_id", clienteFiltroId);

    const { data, error } = await query;
    if (error) {
      console.error("Erro ao carregar posts:", error);
      setErroCarregamento(error.message);
    }
    setPosts((data as unknown as Post[]) ?? []);
    setLoading(false);
  }, [mes, ano, clienteFiltroId]);

  const router = useRouter();

  useEffect(() => {
    carregarClientes();
    carregarStatus();
  }, [carregarClientes, carregarStatus]);

  useEffect(() => {
    carregarPosts();
  }, [carregarPosts]);

  useEffect(() => {
    if (visualizacao === "kanban") carregarKanban();
  }, [visualizacao, carregarKanban]);

  const primeiroDiaMes = new Date(ano, mes, 1);
  const ultimoDiaMes = new Date(ano, mes + 1, 0);
  const inicioGrade = new Date(primeiroDiaMes);
  inicioGrade.setDate(inicioGrade.getDate() - primeiroDiaMes.getDay());
  const fimGrade = new Date(ultimoDiaMes);
  fimGrade.setDate(fimGrade.getDate() + (6 - ultimoDiaMes.getDay()));

  const dias: Date[] = [];
  for (const d = new Date(inicioGrade); d <= fimGrade; d.setDate(d.getDate() + 1)) {
    dias.push(new Date(d));
  }

  const postsPorDia = new Map<string, Post[]>();
  for (const p of posts) {
    const lista = postsPorDia.get(p.data_publicacao) ?? [];
    lista.push(p);
    postsPorDia.set(p.data_publicacao, lista);
  }

  const hojeISO = toISODate(hoje);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink mb-1">Calendário de Conteúdo</h1>
          <p className="text-sm text-ink/60">Planejamento e produção das postagens dos clientes.</p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1.5 shadow-inner shrink-0">
          <button
            onClick={() => router.push("/conteudo/calendario")}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
              visualizacao === "calendario" ? "bg-ink text-white shadow-md scale-105" : "text-ink/50 hover:text-ink hover:bg-white/60"
            }`}
          >
            Calendário
          </button>
          <button
            onClick={() => router.push("/conteudo/calendario/kanban")}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
              visualizacao === "kanban" ? "bg-ink text-white shadow-md scale-105" : "text-ink/50 hover:text-ink hover:bg-white/60"
            }`}
          >
            Kanban
          </button>
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setPainelCamposAberto((v) => !v)}
            className="rounded-full h-10 w-10 flex items-center justify-center border-2 border-black/10 text-ink/50 hover:text-ink hover:bg-surface transition-colors"
            title="Escolher quais campos aparecem nos cards"
          >
            ⚙
          </button>
          {painelCamposAberto && (
            <div
              className="absolute z-20 right-0 mt-1 w-60 rounded-2xl bg-white border border-black/10 shadow-lg p-3"
              onMouseLeave={() => setPainelCamposAberto(false)}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2 px-1">Campos visíveis</p>
              {(
                [
                  ["titulo", "Título"],
                  ["cliente", "Cliente"],
                  ["formato", "Formato"],
                  ["responsavel", "Responsável"],
                ] as [keyof CamposVisiveis, string][]
              ).map(([campo, label]) => (
                <label key={campo} className="flex items-center gap-2 px-1 py-1.5 text-sm text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={camposVisiveis[campo]}
                    onChange={() => alternarCampoVisivel(campo)}
                    className="h-4 w-4 rounded accent-forest"
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {erroCarregamento && (
        <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">
          <p className="font-semibold">Erro ao carregar os posts:</p>
          <p className="font-mono text-xs mt-1">{erroCarregamento}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          {visualizacao === "calendario" && (
            <>
              <button
                onClick={() => {
                  const d = new Date(ano, mes - 1, 1);
                  setMes(d.getMonth());
                  setAno(d.getFullYear());
                }}
                className="rounded-full h-9 w-9 flex items-center justify-center hover:bg-surface text-ink/50"
              >
                ←
              </button>
              <button
                onClick={() => {
                  setMes(hoje.getMonth());
                  setAno(hoje.getFullYear());
                }}
                className="rounded-full border-2 border-ink/15 px-4 py-1.5 text-sm font-semibold hover:bg-surface"
              >
                Hoje
              </button>
              <button
                onClick={() => {
                  const d = new Date(ano, mes + 1, 1);
                  setMes(d.getMonth());
                  setAno(d.getFullYear());
                }}
                className="rounded-full h-9 w-9 flex items-center justify-center hover:bg-surface text-ink/50"
              >
                →
              </button>
              <h2 className="text-lg font-bold text-ink ml-2">
                {MESES[mes]} {ano}
              </h2>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={clienteFiltroId}
            onChange={(e) => setClienteFiltroId(e.target.value)}
            className="input py-2 !w-auto"
          >
            <option value="">Todos os clientes</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <button
            onClick={() => setLinkPublicoAberto(true)}
            className="rounded-full border-2 border-ink/15 text-ink px-4 py-2 text-sm font-semibold hover:bg-surface transition-colors"
          >
            🔗 Link público
          </button>
          <button
            onClick={() => setNovoEmData(hojeISO)}
            className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors"
          >
            + Novo post
          </button>
        </div>
      </div>

      {visualizacao === "calendario" && (
        <>
          <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
            <div className="grid grid-cols-7 bg-surface text-xs font-semibold text-ink/50 uppercase tracking-wide">
              {DIAS_SEMANA.map((d) => (
            <div key={d} className="px-3 py-2 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {dias.map((dia) => {
            const iso = toISODate(dia);
            const doMes = dia.getMonth() === mes;
            const postsDoDia = postsPorDia.get(iso) ?? [];
            return (
              <div
                key={iso}
                className={`min-h-[110px] border-b border-r border-black/5 p-2 ${doMes ? "bg-white" : "bg-surface/40"}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-semibold ${
                      iso === hojeISO
                        ? "bg-ink text-white rounded-full h-5 w-5 flex items-center justify-center"
                        : doMes
                        ? "text-ink/60"
                        : "text-ink/25"
                    }`}
                  >
                    {dia.getDate()}
                  </span>
                  {doMes && (
                    <button onClick={() => setNovoEmData(iso)} className="text-ink/20 hover:text-forest text-sm leading-none">
                      +
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {postsDoDia.slice(0, 3).map((p) => {
                    const mostrarTitulo = camposVisiveis.titulo && p.titulo;
                    const mostrarCliente = camposVisiveis.cliente && !clienteFiltroId;
                    const mostrarFormato = camposVisiveis.formato && p.formato;
                    const mostrarResponsavel = camposVisiveis.responsavel && nomeResponsavel(p);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setEditando(p)}
                        className={`w-full text-left rounded-lg px-1.5 py-1 leading-tight ${corDoStatus(p.status_conteudo?.cor ?? "cinza").cor}`}
                      >
                        <p className="text-[11px] font-semibold truncate">
                          {mostrarTitulo ? p.titulo : p.hora_publicacao?.slice(0, 5) || "Post"}
                        </p>
                        {(mostrarCliente || mostrarFormato || mostrarResponsavel) && (
                          <p className="text-[10px] opacity-70 truncate">
                            {[
                              mostrarCliente ? nomeCliente(p) : null,
                              mostrarFormato ? FORMATO_CONFIG[p.formato!]?.label : null,
                              mostrarResponsavel ? nomeResponsavel(p) : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </button>
                    );
                  })}
                  {postsDoDia.length > 3 && <p className="text-[10px] text-ink/40 px-1.5">+{postsDoDia.length - 3} mais</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-4">
        {statusList.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5 text-xs text-ink/60">
            <span className={`h-2.5 w-2.5 rounded-full ${corDoStatus(s.cor).dot}`} />
            {s.nome}
          </span>
        ))}
      </div>
        </>
      )}

      {visualizacao === "kanban" && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select
              value={mesKanban}
              onChange={(e) => setMesKanban(Number(e.target.value))}
              disabled={todosOsMesesKanban}
              className="input py-1.5 !w-auto disabled:opacity-40"
            >
              {MESES.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={anoKanban}
              onChange={(e) => setAnoKanban(Number(e.target.value))}
              disabled={todosOsMesesKanban}
              className="input py-1.5 !w-auto disabled:opacity-40"
            >
              {Array.from({ length: 4 }, (_, i) => hoje.getFullYear() - 1 + i).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-ink/60 cursor-pointer">
              <input
                type="checkbox"
                checked={todosOsMesesKanban}
                onChange={(e) => setTodosOsMesesKanban(e.target.checked)}
                className="h-4 w-4 rounded accent-forest"
              />
              Todos os meses
            </label>
          </div>

          <div ref={kanbanScrollRef} className="overflow-x-auto pb-4 min-h-[65vh]">
            {loadingKanban ? (
              <p className="text-sm text-ink/50">Carregando...</p>
            ) : (
              <KanbanBoard
                statusList={statusList}
                posts={
                  todosOsMesesKanban
                    ? postsKanban
                    : postsKanban.filter((p) => {
                        const d = new Date(p.data_publicacao + "T00:00:00");
                        return d.getMonth() === mesKanban && d.getFullYear() === anoKanban;
                      })
                }
                onMoverCard={moverCardStatus}
                onAbrirCard={setEditando}
                camposVisiveis={camposVisiveis}
              />
            )}
          </div>
        </>
      )}

      {linkPublicoAberto && <LinkPublicoModal onClose={() => setLinkPublicoAberto(false)} />}

      {(editando || novoEmData) && (
        <PostModal
          post={editando}
          dataInicial={novoEmData}
          clienteFixoId={clienteFiltroId || null}
          statusList={statusList}
          onClose={() => {
            setEditando(null);
            setNovoEmData(null);
          }}
          onSaved={() => {
            setEditando(null);
            setNovoEmData(null);
            carregarPosts();
            if (visualizacao === "kanban") carregarKanban();
          }}
        />
      )}
    </main>
  );
}

export default function CalendarioConteudoPage() {
  return <CalendarioConteudoConteudo viewInicial="calendario" />;
}

function StatusSelect({
  value,
  statusList,
  onChange,
}: {
  value: string;
  statusList: StatusItem[];
  onChange: (v: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const atual = statusList.find((s) => s.id === value);
  const corAtual = corDoStatus(atual?.cor ?? "cinza");

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap ${corAtual.cor}`}
      >
        <span className={`h-2 w-2 rounded-full shrink-0 ${corAtual.dot}`} />
        {atual?.nome ?? "Selecione"}
        <span className="text-xs opacity-60">▾</span>
      </button>
      {aberto && (
        <div
          className="absolute z-20 right-0 mt-1 w-64 rounded-2xl bg-white border border-black/10 shadow-lg p-1.5 max-h-80 overflow-y-auto"
          onMouseLeave={() => setAberto(false)}
        >
          {statusList.map((s) => {
            const cor = corDoStatus(s.cor);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onChange(s.id);
                  setAberto(false);
                }}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl text-sm font-medium hover:bg-surface whitespace-nowrap ${
                  s.id === value ? "bg-surface" : ""
                }`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${cor.dot}`} />
                {s.nome}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="rounded-full h-8 w-8 flex items-center justify-center border border-black/10 hover:bg-surface text-base"
        title="Inserir emoji"
      >
        🙂
      </button>
      {aberto && (
        <div
          className="absolute z-20 right-0 mt-1 w-64 rounded-2xl bg-white border border-black/10 shadow-lg p-2 grid grid-cols-8 gap-1"
          onMouseLeave={() => setAberto(false)}
        >
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onPick(e);
                setAberto(false);
              }}
              className="text-lg hover:bg-surface rounded-lg h-8 w-8 flex items-center justify-center"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PostModal({
  post,
  dataInicial,
  clienteFixoId,
  statusList,
  onClose,
  onSaved,
}: {
  post: Post | null;
  dataInicial: string | null;
  clienteFixoId: string | null;
  statusList: StatusItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editando = !!post;
  const legendaRef = useRef<HTMLTextAreaElement>(null);

  const [clientes, setClientes] = useState<ClienteOpcao[]>([]);
  const [clienteId, setClienteId] = useState(post?.cliente_id ?? clienteFixoId ?? "");
  const [titulo, setTitulo] = useState(post?.titulo ?? "");
  const [funcionarios, setFuncionarios] = useState<ClienteOpcao[]>([]);
  const [responsavelId, setResponsavelId] = useState(post?.responsavel_id ?? "");
  const [dataPublicacao, setDataPublicacao] = useState(post?.data_publicacao ?? dataInicial ?? "");
  const [horaPublicacao, setHoraPublicacao] = useState(post?.hora_publicacao?.slice(0, 5) ?? "");
  const [legenda, setLegenda] = useState(post?.legenda ?? "");
  const [objetivo, setObjetivo] = useState<string>(post?.objetivo ?? "");
  const [formato, setFormato] = useState<string>(post?.formato ?? "");
  const [statusId, setStatusId] = useState<string>(post?.status_id ?? statusList[0]?.id ?? "");
  const [observacoes, setObservacoes] = useState(post?.observacoes_internas ?? "");
  const [midiasExistentes, setMidiasExistentes] = useState<Midia[]>(
    [...(post?.posts_conteudo_midias ?? [])].sort((a, b) => a.ordem - b.ordem)
  );
  const [novosArquivos, setNovosArquivos] = useState<File[]>([]);
  const [comentarios, setComentarios] = useState<{ id: string; autor: string; texto: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!statusId && statusList[0]) setStatusId(statusList[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusList]);

  useEffect(() => {
    async function carregarClientes() {
      const supabase = createClient();
      const lista = await buscarClientesComConteudo(supabase);
      setClientes(lista);
    }
    carregarClientes();

    async function carregarFuncionarios() {
      const supabase = createClient();
      const { data } = await supabase
        .from("funcionarios")
        .select("id, papeis ( pessoas ( nome ) )")
        .eq("ativo", true);
      const lista = ((data ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[])
        .map((f) => ({ id: f.id, nome: f.papeis?.pessoas?.nome ?? "—" }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      setFuncionarios(lista);
    }
    carregarFuncionarios();

    if (post) {
      async function carregarComentarios() {
        const supabase = createClient();
        const { data } = await supabase
          .from("posts_conteudo_comentarios")
          .select("id, autor, texto, created_at")
          .eq("post_id", post!.id)
          .order("created_at");
        setComentarios(data ?? []);
      }
      carregarComentarios();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function inserirEmoji(emoji: string) {
    const textarea = legendaRef.current;
    if (!textarea) {
      setLegenda((l) => l + emoji);
      return;
    }
    const inicio = textarea.selectionStart ?? legenda.length;
    const fim = textarea.selectionEnd ?? legenda.length;
    const novoTexto = legenda.slice(0, inicio) + emoji + legenda.slice(fim);
    setLegenda(novoTexto);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = inicio + emoji.length;
    });
  }

  function adicionarArquivos(files: FileList | null) {
    if (!files) return;
    setNovosArquivos((atual) => [...atual, ...Array.from(files)]);
  }

  function removerNovoArquivo(index: number) {
    setNovosArquivos((atual) => atual.filter((_, i) => i !== index));
  }

  function removerMidiaExistente(id: string) {
    setMidiasExistentes((atual) => atual.filter((m) => m.id !== id));
  }

  function moverMidiaExistente(index: number, direcao: -1 | 1) {
    setMidiasExistentes((atual) => {
      const novo = [...atual];
      const alvo = index + direcao;
      if (alvo < 0 || alvo >= novo.length) return atual;
      [novo[index], novo[alvo]] = [novo[alvo], novo[index]];
      return novo;
    });
  }

  function moverNovoArquivo(index: number, direcao: -1 | 1) {
    setNovosArquivos((atual) => {
      const novo = [...atual];
      const alvo = index + direcao;
      if (alvo < 0 || alvo >= novo.length) return atual;
      [novo[index], novo[alvo]] = [novo[alvo], novo[index]];
      return novo;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId || !dataPublicacao || !statusId) {
      setErro("Selecione o cliente, a data de publicação e o status.");
      return;
    }
    setSaving(true);
    setErro(null);
    try {
      const supabase = createClient();
      const payload = {
        cliente_id: clienteId,
        titulo: titulo.trim() || null,
        responsavel_id: responsavelId || null,
        data_publicacao: dataPublicacao,
        hora_publicacao: horaPublicacao || null,
        legenda: legenda || null,
        objetivo: objetivo || null,
        formato: formato || null,
        status_id: statusId,
        observacoes_internas: observacoes || null,
      };

      let postId = post?.id;
      if (editando && post) {
        const { error } = await supabase.from("posts_conteudo").update(payload).eq("id", post.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("posts_conteudo").insert(payload).select("id").single();
        if (error) throw error;
        postId = data.id;
      }
      if (!postId) throw new Error("Não foi possível salvar o post.");

      const idsOriginais = (post?.posts_conteudo_midias ?? []).map((m) => m.id);
      const idsMantidos = new Set(midiasExistentes.map((m) => m.id));
      const idsRemovidos = idsOriginais.filter((id) => !idsMantidos.has(id));
      if (idsRemovidos.length > 0) {
        await supabase.from("posts_conteudo_midias").delete().in("id", idsRemovidos);
      }

      for (let i = 0; i < midiasExistentes.length; i++) {
        await supabase.from("posts_conteudo_midias").update({ ordem: i }).eq("id", midiasExistentes[i].id);
      }

      for (let i = 0; i < novosArquivos.length; i++) {
        const arquivo = novosArquivos[i];
        const path = `${postId}/${Date.now()}-${arquivo.name}`;
        const { error: uploadError } = await supabase.storage.from("conteudo-midia").upload(path, arquivo);
        if (uploadError) throw uploadError;
        await supabase.from("posts_conteudo_midias").insert({
          post_id: postId,
          arquivo_path: path,
          arquivo_nome: arquivo.name,
          arquivo_tipo: arquivo.type,
          ordem: midiasExistentes.length + i,
        });
      }

      setSaving(false);
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar post.");
      setSaving(false);
    }
  }

  async function excluir() {
    if (!post) return;
    if (!window.confirm("Excluir este post do calendário?")) return;
    const supabase = createClient();
    await supabase.from("posts_conteudo").delete().eq("id", post.id);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto overflow-x-visible"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="text-lg font-bold text-ink shrink-0">{editando ? "Editar post" : "Novo post"}</h2>
          <StatusSelect value={statusId} statusList={statusList} onChange={setStatusId} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Título</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="input"
              placeholder="Ex: Promoção de aniversário, Bastidores da produção..."
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-ink/70 mb-1">Cliente *</span>
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="input" required>
                <option value="">Selecione...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ink/70 mb-1">Responsável</span>
              <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="input">
                <option value="">Sem responsável</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-ink/70 mb-1">Data de publicação *</span>
              <input
                type="date"
                required
                value={dataPublicacao}
                onChange={(e) => setDataPublicacao(e.target.value)}
                className="input"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ink/70 mb-1">Horário</span>
              <input
                type="time"
                value={horaPublicacao}
                onChange={(e) => setHoraPublicacao(e.target.value)}
                className="input"
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="block text-sm font-medium text-ink/70">Legenda</span>
              <EmojiPicker onPick={inserirEmoji} />
            </div>
            <textarea
              ref={legendaRef}
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              className="input"
              rows={4}
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-ink/70 mb-1">Mídia</span>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(e) => adicionarArquivos(e.target.files)}
              className="input"
            />
            {(midiasExistentes.length > 0 || novosArquivos.length > 0) && (
              <div className="mt-2 space-y-1.5">
                {midiasExistentes.map((m, i) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-sm">
                    <span className="truncate">
                      {i + 1}. {m.arquivo_nome ?? "arquivo"}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => moverMidiaExistente(i, -1)} disabled={i === 0} className="text-ink/40 hover:text-ink disabled:opacity-20 px-1">
                        ↑
                      </button>
                      <button type="button" onClick={() => moverMidiaExistente(i, 1)} disabled={i === midiasExistentes.length - 1} className="text-ink/40 hover:text-ink disabled:opacity-20 px-1">
                        ↓
                      </button>
                      <button type="button" onClick={() => removerMidiaExistente(m.id)} className="text-ink/40 hover:text-red-600 px-1">
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                {novosArquivos.map((f, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-xl bg-mint px-3 py-2 text-sm">
                    <span className="truncate">
                      {midiasExistentes.length + i + 1}. {f.name} <span className="text-xs text-forest">(novo)</span>
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => moverNovoArquivo(i, -1)} disabled={i === 0} className="text-ink/40 hover:text-ink disabled:opacity-20 px-1">
                        ↑
                      </button>
                      <button type="button" onClick={() => moverNovoArquivo(i, 1)} disabled={i === novosArquivos.length - 1} className="text-ink/40 hover:text-ink disabled:opacity-20 px-1">
                        ↓
                      </button>
                      <button type="button" onClick={() => removerNovoArquivo(i)} className="text-ink/40 hover:text-red-600 px-1">
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <span className="block text-sm font-medium text-ink/70 mb-1">Formato</span>
            <div className="flex items-center gap-1 rounded-full bg-surface p-1 w-fit">
              <button
                type="button"
                onClick={() => setFormato("")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${formato === "" ? "bg-ink text-white" : "text-ink/60"}`}
              >
                Nenhum
              </button>
              {Object.entries(FORMATO_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormato(key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${formato === key ? "bg-ink text-white" : "text-ink/60"}`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-ink/70 mb-1">Objetivo</span>
            <div className="flex items-center gap-1 rounded-full bg-surface p-1 w-fit">
              <button
                type="button"
                onClick={() => setObjetivo("")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${objetivo === "" ? "bg-ink text-white" : "text-ink/60"}`}
              >
                Nenhum
              </button>
              {Object.entries(OBJETIVO_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setObjetivo(key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${objetivo === key ? "bg-ink text-white" : "text-ink/60"}`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Observações internas (a equipe só vê aqui)</span>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="input" rows={2} />
          </label>

          {comentarios.length > 0 && (
            <div className="rounded-2xl bg-surface p-3 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-ink/40">Comentários do cliente</p>
              {comentarios.map((c) => (
                <div key={c.id} className="text-sm">
                  <span className={`font-semibold ${c.autor === "cliente" ? "text-amber-700" : "text-ink"}`}>
                    {c.autor === "cliente" ? "Cliente" : "Equipe"}:
                  </span>{" "}
                  {c.texto}
                </div>
              ))}
            </div>
          )}

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
            >
              {saving ? "Salvando..." : editando ? "Salvar alterações" : "Salvar post"}
            </button>
            <button type="button" onClick={onClose} className="text-sm font-semibold text-ink/60 hover:text-ink">
              Cancelar
            </button>
            {editando && (
              <button type="button" onClick={excluir} className="ml-auto text-sm font-semibold text-red-500 hover:text-red-700">
                Excluir
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function LinkPublicoModal({ onClose }: { onClose: () => void }) {
  const [clientes, setClientes] = useState<(ClienteOpcao & { token: string })[]>([]);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<(ClienteOpcao & { token: string }) | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const lista = await buscarClientesComConteudo(supabase);
      setClientes(lista);
    }
    carregar();
  }, []);

  const filtrados = clientes.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase()));
  const link = selecionado ? `${window.location.origin}/calendario/${selecionado.token}` : "";

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-1">Link público do calendário</h2>
        <p className="text-sm text-ink/60 mb-4">Escolha o cliente pra gerar o link de acompanhamento.</p>

        {!selecionado ? (
          <>
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="input mb-2"
              placeholder="Buscar cliente..."
            />
            <div className="max-h-72 overflow-y-auto rounded-2xl border border-black/5">
              {filtrados.length === 0 ? (
                <p className="p-4 text-sm text-ink/50">Nenhum cliente encontrado.</p>
              ) : (
                filtrados.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelecionado(c)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface border-b border-black/5 last:border-0"
                  >
                    {c.nome}
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div>
            <p className="text-sm font-semibold text-ink mb-2">{selecionado.nome}</p>
            <div className="flex items-center gap-2 mb-4">
              <input readOnly value={link} className="input text-xs" onFocus={(e) => e.target.select()} />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(link);
                  setCopiado(true);
                }}
                className="shrink-0 rounded-full bg-forest text-white px-4 py-2 text-sm font-bold hover:bg-ink transition-colors"
              >
                {copiado ? "Copiado!" : "Copiar"}
              </button>
            </div>
            <button
              onClick={() => {
                setSelecionado(null);
                setCopiado(false);
              }}
              className="text-sm font-semibold text-ink/50 hover:text-ink"
            >
              ← Escolher outro cliente
            </button>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-black/5">
          <button onClick={onClose} className="text-sm font-semibold text-ink/60 hover:text-ink">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function KanbanBoard({
  statusList,
  posts,
  onMoverCard,
  onAbrirCard,
  camposVisiveis,
}: {
  statusList: StatusItem[];
  posts: Post[];
  onMoverCard: (postId: string, novoStatusId: string) => void;
  onAbrirCard: (post: Post) => void;
  camposVisiveis: CamposVisiveis;
}) {
  const [ativoId, setAtivoId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const postAtivo = posts.find((p) => p.id === ativoId) ?? null;

  function handleDragStart(e: DragStartEvent) {
    setAtivoId(e.active.id as string);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setAtivoId(null);
    if (over && active.data.current?.statusAtual !== over.id) {
      onMoverCard(active.id as string, over.id as string);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setAtivoId(null)}>
      <div className="flex gap-4 min-w-max items-start">
        {statusList.map((coluna) => (
          <KanbanColuna
            key={coluna.id}
            coluna={coluna}
            cards={posts.filter((p) => p.status_id === coluna.id)}
            onAbrirCard={onAbrirCard}
            camposVisiveis={camposVisiveis}
          />
        ))}
      </div>
      <DragOverlay>{postAtivo && <KanbanCardConteudo post={postAtivo} camposVisiveis={camposVisiveis} arrastando />}</DragOverlay>
    </DndContext>
  );
}

function KanbanColuna({
  coluna,
  cards,
  onAbrirCard,
  camposVisiveis,
}: {
  coluna: StatusItem;
  cards: Post[];
  onAbrirCard: (post: Post) => void;
  camposVisiveis: CamposVisiveis;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  const cor = corDoStatus(coluna.cor);

  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 rounded-3xl border-2 p-3 min-h-[60vh] transition-all duration-150 ${cor.colBg} ${
        isOver ? `${cor.colBorder} scale-[1.02] shadow-lg` : "border-transparent"
      }`}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cor.dot}`} />
        <p className="text-sm font-bold text-ink truncate">{coluna.nome}</p>
        <span className={`ml-auto text-xs font-bold rounded-full px-2 py-0.5 shrink-0 ${cor.cor}`}>{cards.length}</span>
      </div>
      <div className="space-y-2 min-h-[80px]">
        {cards.map((p) => (
          <KanbanCardArrastavel key={p.id} post={p} statusAtual={coluna.id} onAbrirCard={onAbrirCard} camposVisiveis={camposVisiveis} />
        ))}
      </div>
    </div>
  );
}

function KanbanCardArrastavel({
  post,
  statusAtual,
  onAbrirCard,
  camposVisiveis,
}: {
  post: Post;
  statusAtual: string;
  onAbrirCard: (post: Post) => void;
  camposVisiveis: CamposVisiveis;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: post.id,
    data: { statusAtual },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && onAbrirCard(post)}
      className={`touch-none transition-opacity ${isDragging ? "opacity-30" : "opacity-100"}`}
    >
      <KanbanCardConteudo post={post} camposVisiveis={camposVisiveis} />
    </div>
  );
}

function KanbanCardConteudo({
  post,
  camposVisiveis,
  arrastando,
}: {
  post: Post;
  camposVisiveis: CamposVisiveis;
  arrastando?: boolean;
}) {
  const mostrarTitulo = camposVisiveis.titulo && post.titulo;
  const mostrarCliente = camposVisiveis.cliente;
  const mostrarFormato = camposVisiveis.formato && post.formato;
  const mostrarResponsavel = camposVisiveis.responsavel && nomeResponsavel(post);

  return (
    <div
      className={`rounded-2xl bg-white p-3 cursor-grab active:cursor-grabbing transition-shadow w-72 ${
        arrastando ? "shadow-2xl rotate-2 border-2 border-forest/30" : "border border-black/5 shadow-sm hover:shadow-md"
      }`}
    >
      <p className="text-sm font-semibold text-ink truncate">
        {mostrarTitulo ? post.titulo : nomeCliente(post) || "Sem título"}
      </p>
      {(mostrarCliente || mostrarFormato || mostrarResponsavel) && (
        <p className="text-xs text-ink/50 truncate mt-0.5">
          {[
            mostrarCliente ? nomeCliente(post) : null,
            mostrarFormato ? FORMATO_CONFIG[post.formato!]?.label : null,
            mostrarResponsavel ? nomeResponsavel(post) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <p className="text-xs text-ink/40 mt-1">
        {formatarDataChip(post.data_publicacao)}
        {post.hora_publicacao && ` · ${post.hora_publicacao.slice(0, 5)}`}
      </p>
    </div>
  );
}
