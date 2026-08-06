"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";
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
  data_inicio: string | null;
  hora_publicacao: string | null;
  legenda: string | null;
  objetivo: "atracao" | "educacao" | "conversao" | null;
  formato: "estatico" | "carrossel" | "video" | null;
  link_video: string | null;
  status_id: string;
  responsavel_id: string | null;
  post_pai_id: string | null;
  arquivado: boolean;
  observacoes_internas: string | null;
  clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
  funcionarios: { papeis: { pessoas: { nome: string } | null } | null } | null;
  posts_conteudo_midias: Midia[];
  status_conteudo: { nome: string; cor: string } | null;
}

interface Responsavel {
  id: string;
  nome: string;
  fotoUrl: string | null;
  authUserId?: string | null;
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
  conexao: { label: "Conexão" },
  institucional: { label: "Institucional" },
  bastidores: { label: "Bastidores" },
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
  const [funcionariosComAcesso, setFuncionariosComAcesso] = useState<Responsavel[]>([]);
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
  const [mostrarSubconteudos, setMostrarSubconteudos] = useState(true);
  const [responsaveisPorPost, setResponsaveisPorPost] = useState<Record<string, Responsavel[]>>({});
  const [contagemSubconteudos, setContagemSubconteudos] = useState<Record<string, number>>({});
  const [tituloPaiPorPost, setTituloPaiPorPost] = useState<Record<string, string>>({});
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

  const carregarExtras = useCallback(async (lista: Post[]) => {
    const ids = lista.map((p) => p.id);
    if (ids.length === 0) {
      setResponsaveisPorPost({});
      setContagemSubconteudos({});
      setTituloPaiPorPost({});
      return;
    }
    const supabase = createClient();
    const idsPais = [...new Set(lista.map((p) => p.post_pai_id).filter((x): x is string => !!x))];
    const [{ data: respData }, { data: filhos }, { data: paisData }] = await Promise.all([
      supabase
        .from("posts_conteudo_responsaveis")
        .select("post_id, funcionarios ( id, papeis ( pessoas ( nome, apelido, foto_url ) ) )")
        .in("post_id", ids),
      supabase.from("posts_conteudo").select("post_pai_id").in("post_pai_id", ids),
      idsPais.length > 0 ? supabase.from("posts_conteudo").select("id, titulo").in("id", idsPais) : Promise.resolve({ data: [] }),
    ]);
    const mapa: Record<string, Responsavel[]> = {};
    for (const r of (respData ?? []) as unknown as {
      post_id: string;
      funcionarios: { id: string; papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null } | null;
    }[]) {
      if (!r.funcionarios) continue;
      const pessoa = r.funcionarios.papeis?.pessoas;
      const resp: Responsavel = { id: r.funcionarios.id, nome: pessoa?.apelido || pessoa?.nome || "Colega", fotoUrl: pessoa?.foto_url ?? null };
      if (!mapa[r.post_id]) mapa[r.post_id] = [];
      mapa[r.post_id].push(resp);
    }
    setResponsaveisPorPost(mapa);
    const contFilhos: Record<string, number> = {};
    for (const f of filhos ?? []) {
      if (f.post_pai_id) contFilhos[f.post_pai_id] = (contFilhos[f.post_pai_id] ?? 0) + 1;
    }
    setContagemSubconteudos(contFilhos);

    const mapaPais: Record<string, string> = {};
    for (const pai of (paisData ?? []) as { id: string; titulo: string | null }[]) {
      mapaPais[pai.id] = pai.titulo || "Sem título";
    }
    const tituloPorPost: Record<string, string> = {};
    for (const p of lista) {
      if (p.post_pai_id && mapaPais[p.post_pai_id]) tituloPorPost[p.id] = mapaPais[p.post_pai_id];
    }
    setTituloPaiPorPost(tituloPorPost);
  }, []);

  const carregarKanban = useCallback(async () => {
    setLoadingKanban(true);
    const supabase = createClient();
    let query = supabase
      .from("posts_conteudo")
      .select(
        `id, cliente_id, titulo, data_publicacao, data_inicio, hora_publicacao, legenda, objetivo, formato, link_video, status_id, responsavel_id, post_pai_id, arquivado, observacoes_internas,
         clientes ( papeis ( pessoas ( nome ) ) ),
         funcionarios!responsavel_id ( papeis ( pessoas ( nome ) ) ),
         posts_conteudo_midias ( id, arquivo_path, arquivo_nome, arquivo_tipo, ordem ),
         status_conteudo ( nome, cor )`
      )
      .eq("arquivado", false)
      .order("data_publicacao");
    if (!mostrarSubconteudos) query = query.is("post_pai_id", null);
    if (clienteFiltroId) query = query.eq("cliente_id", clienteFiltroId);
    const { data, error } = await query;
    if (error) console.error("Erro ao carregar kanban:", error);
    const lista = (data as unknown as Post[]) ?? [];
    setPostsKanban(lista);
    setLoadingKanban(false);
    carregarExtras(lista);
  }, [clienteFiltroId, carregarExtras, mostrarSubconteudos]);

  async function moverCardStatus(postId: string, novoStatusId: string) {
    setPostsKanban((atual) => atual.map((p) => (p.id === postId ? { ...p, status_id: novoStatusId } : p)));
    const supabase = createClient();
    await supabase.from("posts_conteudo").update({ status_id: novoStatusId }).eq("id", postId);
    carregarKanban();
  }

  const carregarFuncionariosComAcesso = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("funcionarios")
      .select("id, auth_user_id, papeis ( pessoas ( nome, apelido, foto_url ) )")
      .not("auth_user_id", "is", null);
    const lista = ((data ?? []) as unknown as {
      id: string;
      auth_user_id: string | null;
      papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null;
    }[])
      .map((f) => ({
        id: f.id,
        nome: f.papeis?.pessoas?.apelido || f.papeis?.pessoas?.nome || "Colega",
        fotoUrl: f.papeis?.pessoas?.foto_url ?? null,
        authUserId: f.auth_user_id,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setFuncionariosComAcesso(lista);
  }, []);

  function recarregarTudo() {
    carregarPosts();
    carregarKanban();
  }

  async function renomearPost(post: Post) {
    const novoTitulo = window.prompt("Novo título:", post.titulo ?? "");
    if (novoTitulo === null || novoTitulo.trim() === (post.titulo ?? "")) return;
    const supabase = createClient();
    await supabase.from("posts_conteudo").update({ titulo: novoTitulo.trim() || null }).eq("id", post.id);
    recarregarTudo();
  }

  async function duplicarPost(post: Post) {
    const supabase = createClient();
    const { data: novo } = await supabase
      .from("posts_conteudo")
      .insert({
        titulo: post.titulo ? `${post.titulo} (cópia)` : null,
        cliente_id: post.cliente_id,
        data_publicacao: post.data_publicacao,
        data_inicio: post.data_inicio,
        hora_publicacao: post.hora_publicacao,
        legenda: post.legenda,
        objetivo: post.objetivo,
        formato: post.formato,
        status_id: post.status_id,
        observacoes_internas: post.observacoes_internas,
      })
      .select("id")
      .single();
    const respAtuais = responsaveisPorPost[post.id] ?? [];
    if (novo && respAtuais.length > 0) {
      await supabase.from("posts_conteudo_responsaveis").insert(respAtuais.map((r) => ({ post_id: novo.id, funcionario_id: r.id })));
    }
    recarregarTudo();
  }

  async function excluirPostMenu(post: Post) {
    if (!window.confirm(`Mover "${post.titulo || "esse post"}" pra lixeira? Isso também remove os sub-conteúdos dele (mas eles não ficam salvos na lixeira).`))
      return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("lixeira")
      .insert({ tipo: "conteudo", item_id_original: post.id, titulo: post.titulo, dados: post, excluido_por: user?.id ?? null });
    await supabase.from("posts_conteudo").delete().eq("id", post.id);
    recarregarTudo();
  }

  async function arquivarPostMenu(post: Post) {
    const supabase = createClient();
    await supabase.from("posts_conteudo").update({ arquivado: true }).eq("id", post.id);
    recarregarTudo();
  }

  async function atribuirPostMenu(post: Post, funcionarioId: string) {
    const supabase = createClient();
    const jaTem = (responsaveisPorPost[post.id] ?? []).some((r) => r.id === funcionarioId);
    if (jaTem) {
      setResponsaveisPorPost((atual) => ({ ...atual, [post.id]: (atual[post.id] ?? []).filter((r) => r.id !== funcionarioId) }));
      await supabase.from("posts_conteudo_responsaveis").delete().eq("post_id", post.id).eq("funcionario_id", funcionarioId);
    } else {
      const pessoa = funcionariosComAcesso.find((f) => f.id === funcionarioId);
      if (pessoa) {
        setResponsaveisPorPost((atual) => ({ ...atual, [post.id]: [...(atual[post.id] ?? []), pessoa] }));
        if (pessoa.authUserId) {
          await supabase.from("notificacoes").insert({
            destinatario_id: pessoa.authUserId,
            tipo: "atribuicao_conteudo",
            titulo: "Você foi atribuído a um conteúdo",
            descricao: post.titulo,
            link: `/conteudo/calendario/post/${post.id}`,
          });
        }
      }
      await supabase.from("posts_conteudo_responsaveis").insert({ post_id: post.id, funcionario_id: funcionarioId });
    }
  }

  function copiarLinkPost(post: Post) {
    navigator.clipboard.writeText(`${window.location.origin}/conteudo/calendario/post/${post.id}`);
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
        `id, cliente_id, titulo, data_publicacao, data_inicio, hora_publicacao, legenda, objetivo, formato, link_video, status_id, responsavel_id, post_pai_id, arquivado, observacoes_internas,
         clientes ( papeis ( pessoas ( nome ) ) ),
         funcionarios!responsavel_id ( papeis ( pessoas ( nome ) ) ),
         posts_conteudo_midias ( id, arquivo_path, arquivo_nome, arquivo_tipo, ordem ),
         status_conteudo ( nome, cor )`
      )
      .gte("data_publicacao", inicio)
      .lte("data_publicacao", fim)
      .eq("arquivado", false)
      .order("data_publicacao");
    if (!mostrarSubconteudos) query = query.is("post_pai_id", null);
    if (clienteFiltroId) query = query.eq("cliente_id", clienteFiltroId);

    const { data, error } = await query;
    if (error) {
      console.error("Erro ao carregar posts:", error);
      setErroCarregamento(error.message);
    }
    const lista = (data as unknown as Post[]) ?? [];
    setPosts(lista);
    setLoading(false);
    carregarExtras(lista);
  }, [mes, ano, clienteFiltroId, carregarExtras, mostrarSubconteudos]);

  const router = useRouter();

  async function criarPostRapido(dataISO: string) {
    const supabase = createClient();
    const { data: novo, error } = await supabase
      .from("posts_conteudo")
      .insert({
        cliente_id: clienteFiltroId && clienteFiltroId !== "internas" ? clienteFiltroId : clientes[0]?.id ?? null,
        data_publicacao: dataISO,
        status_id: statusList[0]?.id,
      })
      .select("id")
      .single();
    if (!error && novo) router.push(`/conteudo/calendario/post/${novo.id}`);
  }

  useEffect(() => {
    carregarClientes();
    carregarStatus();
    carregarFuncionariosComAcesso();
    async function carregarConfig() {
      const supabase = createClient();
      const { data } = await supabase.from("configuracoes_conteudo").select("mostrar_subconteudos_no_calendario").eq("id", true).maybeSingle();
      if (data) setMostrarSubconteudos(data.mostrar_subconteudos_no_calendario);
    }
    carregarConfig();
  }, [carregarClientes, carregarStatus, carregarFuncionariosComAcesso]);

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
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-ink mb-1">Calendário de Conteúdo</h1>
        <p className="text-sm text-ink/60">Planejamento e produção das postagens dos clientes.</p>
      </div>

      {erroCarregamento && (
        <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">
          <p className="font-semibold">Erro ao carregar os posts:</p>
          <p className="font-mono text-xs mt-1">{erroCarregamento}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
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
              <h2 className="text-lg font-bold text-ink">
                {MESES[mes]} {ano}
              </h2>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            <button
              onClick={() => setPainelCamposAberto((v) => !v)}
              className={`rounded-full h-10 w-10 flex items-center justify-center border-2 transition-colors ${
                clienteFiltroId ? "border-forest text-forest bg-mint" : "border-black/10 text-ink/50 hover:text-ink hover:bg-surface"
              }`}
              title="Filtrar e escolher quais campos aparecem nos cards"
            >
              ⚙
            </button>
            {painelCamposAberto && (
              <div
                className="absolute z-20 right-0 mt-1 w-64 rounded-2xl bg-white border border-black/10 shadow-lg p-3 space-y-4"
                onMouseLeave={() => setPainelCamposAberto(false)}
              >
                <FiltroClienteConteudo clientes={clientes} valorId={clienteFiltroId} onMudar={setClienteFiltroId} />
                <label className="flex items-center gap-2 px-1 py-1.5 text-sm text-ink cursor-pointer border-b border-black/5 pb-3">
                  <input
                    type="checkbox"
                    checked={mostrarSubconteudos}
                    onChange={(e) => setMostrarSubconteudos(e.target.checked)}
                    className="h-4 w-4 rounded accent-forest"
                  />
                  Mostrar sub-conteúdos
                </label>
                <div>
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
              </div>
            )}
          </div>
          <button
            onClick={() => setLinkPublicoAberto(true)}
            className="rounded-full border-2 border-ink/15 text-ink px-4 py-2 text-sm font-semibold hover:bg-surface transition-colors"
          >
            🔗 Link público
          </button>
          <button
            onClick={() => criarPostRapido(hojeISO)}
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
                className={`min-h-[150px] border-b border-r border-black/5 p-2 ${doMes ? "bg-white" : "bg-surface/40"}`}
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
                    <button onClick={() => criarPostRapido(iso)} className="text-ink/20 hover:text-forest text-sm leading-none">
                      +
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {postsDoDia.slice(0, 3).map((p) => {
                    const mostrarTitulo = camposVisiveis.titulo && p.titulo;
                    const mostrarCliente = camposVisiveis.cliente && !clienteFiltroId;
                    const mostrarFormato = camposVisiveis.formato && p.formato;
                    const respDoPost = responsaveisPorPost[p.id] ?? [];
                    const mostrarResponsavel = camposVisiveis.responsavel && respDoPost.length > 0;
                    return (
                      <button
                        key={p.id}
                        onClick={() => router.push(`/conteudo/calendario/post/${p.id}`)}
                        className={`w-full text-left rounded-lg px-1.5 py-1 leading-tight ${corDoStatus(p.status_conteudo?.cor ?? "cinza").cor}`}
                      >
                        {tituloPaiPorPost[p.id] && (
                          <p className="text-[9px] text-forest font-semibold truncate">↳ {tituloPaiPorPost[p.id]}</p>
                        )}
                        <p className="text-[11px] font-semibold truncate">
                          {mostrarTitulo ? p.titulo : p.hora_publicacao?.slice(0, 5) || "Post"}
                        </p>
                        {mostrarCliente && <p className="text-[10px] opacity-70 truncate">{nomeCliente(p)}</p>}
                        {mostrarFormato && <p className="text-[10px] opacity-70 truncate">{FORMATO_CONFIG[p.formato!]?.label}</p>}
                        {(p.observacoes_internas || mostrarResponsavel) && (
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[10px] opacity-60">{p.observacoes_internas ? "☰" : ""}</span>
                            {mostrarResponsavel && <AvatarStackPost pessoas={respDoPost} tamanho={14} />}
                          </div>
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
                onAbrirCard={(p) => router.push(`/conteudo/calendario/post/${p.id}`)}
                camposVisiveis={camposVisiveis}
                responsaveisPorPost={responsaveisPorPost}
                contagemSubconteudos={contagemSubconteudos}
                tituloPaiPorPost={tituloPaiPorPost}
                acoes={{
                  statusList,
                  funcionariosComAcesso,
                  responsaveisPorPost,
                  onRenomear: renomearPost,
                  onMover: moverCardStatus,
                  onDuplicar: duplicarPost,
                  onExcluir: excluirPostMenu,
                  onArquivar: arquivarPostMenu,
                  onAtribuir: atribuirPostMenu,
                  onCopiarLink: copiarLinkPost,
                }}
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
          onSaved={(novoPostId) => {
            setEditando(null);
            setNovoEmData(null);
            if (novoPostId) {
              router.push(`/conteudo/calendario/post/${novoPostId}`);
            } else {
              carregarPosts();
              if (visualizacao === "kanban") carregarKanban();
            }
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
  onSaved: (postId?: string) => void;
}) {
  const editando = !!post;
  const router = useRouter();
  const legendaRef = useRef<HTMLTextAreaElement>(null);

  const [clientes, setClientes] = useState<ClienteOpcao[]>([]);
  const [clienteId, setClienteId] = useState(post?.cliente_id ?? clienteFixoId ?? "");
  const [titulo, setTitulo] = useState(post?.titulo ?? "");
  const [funcionarios, setFuncionarios] = useState<{ id: string; nome: string; fotoUrl: string | null }[]>([]);
  const [responsaveisSelecionados, setResponsaveisSelecionados] = useState<string[]>([]);
  const [dataPublicacao, setDataPublicacao] = useState(post?.data_publicacao ?? dataInicial ?? "");
  const [horaPublicacao, setHoraPublicacao] = useState(post?.hora_publicacao?.slice(0, 5) ?? "");
  const [legenda, setLegenda] = useState(post?.legenda ?? "");
  const [objetivo, setObjetivo] = useState<string>(post?.objetivo ?? "");
  const [formato, setFormato] = useState<string>(post?.formato ?? "");
  const [linkVideo, setLinkVideo] = useState<string>(post?.link_video ?? "");
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
        .select("id, auth_user_id, papeis ( pessoas ( nome, apelido, foto_url ) )")
        .not("auth_user_id", "is", null);
      const lista = ((data ?? []) as unknown as {
        id: string;
        auth_user_id: string | null;
        papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null;
      }[])
        .map((f) => ({ id: f.id, nome: f.papeis?.pessoas?.apelido || f.papeis?.pessoas?.nome || "Colega", fotoUrl: f.papeis?.pessoas?.foto_url ?? null }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      setFuncionarios(lista);
    }
    carregarFuncionarios();

    if (post) {
      async function carregarResponsaveisExistentes() {
        const supabase = createClient();
        const { data } = await supabase.from("posts_conteudo_responsaveis").select("funcionario_id").eq("post_id", post!.id);
        setResponsaveisSelecionados((data ?? []).map((r) => r.funcionario_id));
      }
      carregarResponsaveisExistentes();
    }

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
        data_publicacao: dataPublicacao,
        hora_publicacao: horaPublicacao || null,
        legenda: legenda || null,
        objetivo: objetivo || null,
        formato: formato || null,
        link_video: formato === "video" ? linkVideo.trim() || null : null,
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

      await supabase.from("posts_conteudo_responsaveis").delete().eq("post_id", postId);
      if (responsaveisSelecionados.length > 0) {
        await supabase
          .from("posts_conteudo_responsaveis")
          .insert(responsaveisSelecionados.map((funcionario_id) => ({ post_id: postId, funcionario_id })));
      }

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
      onSaved(editando ? undefined : postId);
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
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-lg font-bold text-ink shrink-0">{editando ? "Editar post" : "Novo post"}</h2>
          <StatusSelect value={statusId} statusList={statusList} onChange={setStatusId} />
        </div>
        {editando && post && (
          <button
            type="button"
            onClick={() => router.push(`/conteudo/calendario/post/${post.id}`)}
            className="text-xs font-semibold text-forest hover:text-ink mb-4"
          >
            Abrir página completa (comentários internos, histórico, responsáveis) →
          </button>
        )}

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
            <div>
              <span className="block text-sm font-medium text-ink/70 mb-1">Responsáveis</span>
              <div className="flex flex-wrap gap-2 rounded-xl bg-surface p-2.5">
                {funcionarios.length === 0 ? (
                  <p className="text-xs text-ink/40">Nenhum usuário com acesso ao sistema cadastrado.</p>
                ) : (
                  funcionarios.map((f) => {
                    const marcado = responsaveisSelecionados.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() =>
                          setResponsaveisSelecionados((atual) =>
                            marcado ? atual.filter((id) => id !== f.id) : [...atual, f.id]
                          )
                        }
                        className="relative"
                        title={f.nome}
                      >
                        {f.fotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.fotoUrl} alt={f.nome} className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-ink/20 text-ink flex items-center justify-center text-xs font-bold">
                            {f.nome.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        {marcado && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-forest text-white text-[8px] flex items-center justify-center ring-2 ring-white">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
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

          {formato === "video" ? (
            <label className="block">
              <span className="block text-sm font-medium text-ink/70 mb-1">Link do vídeo (Google Drive, etc.)</span>
              <input
                value={linkVideo}
                onChange={(e) => setLinkVideo(e.target.value)}
                className="input"
                placeholder="https://drive.google.com/..."
              />
              <span className="block text-xs text-ink/40 mt-1">
                Vídeos não ficam hospedados aqui — deixa o arquivo no Drive e cola o link de acesso.
              </span>
            </label>
          ) : (
            <div>
              <span className="block text-sm font-medium text-ink/70 mb-1">Mídia</span>
              <input
                type="file"
                accept="image/*"
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
              <span className="block text-xs text-ink/40 mt-1">Sobe as artes na ordem certa — usa as setinhas pra reordenar (importante nos carrosséis).</span>
            </div>
          )}

          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Objetivo</span>
            <select value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className="input">
              <option value="">Nenhum</option>
              {Object.entries(OBJETIVO_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </label>

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
  responsaveisPorPost,
  contagemSubconteudos,
  tituloPaiPorPost,
  acoes,
}: {
  statusList: StatusItem[];
  posts: Post[];
  onMoverCard: (postId: string, novoStatusId: string) => void;
  onAbrirCard: (post: Post) => void;
  camposVisiveis: CamposVisiveis;
  responsaveisPorPost: Record<string, Responsavel[]>;
  contagemSubconteudos: Record<string, number>;
  tituloPaiPorPost: Record<string, string>;
  acoes: AcoesPost;
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
            responsaveisPorPost={responsaveisPorPost}
            contagemSubconteudos={contagemSubconteudos}
            tituloPaiPorPost={tituloPaiPorPost}
            acoes={acoes}
          />
        ))}
      </div>
      <DragOverlay>
        {postAtivo && (
          <KanbanCardConteudo
            post={postAtivo}
            camposVisiveis={camposVisiveis}
            responsaveis={responsaveisPorPost[postAtivo.id] ?? []}
            qtdSubconteudos={contagemSubconteudos[postAtivo.id] ?? 0}
            arrastando
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColuna({
  coluna,
  cards,
  onAbrirCard,
  camposVisiveis,
  responsaveisPorPost,
  contagemSubconteudos,
  tituloPaiPorPost,
  acoes,
}: {
  coluna: StatusItem;
  cards: Post[];
  onAbrirCard: (post: Post) => void;
  camposVisiveis: CamposVisiveis;
  responsaveisPorPost: Record<string, Responsavel[]>;
  contagemSubconteudos: Record<string, number>;
  tituloPaiPorPost: Record<string, string>;
  acoes: AcoesPost;
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
      <div className="space-y-2 min-h-[80px] max-h-[65vh] overflow-y-auto pr-1">
        {cards.map((p) => (
          <KanbanCardArrastavel
            key={p.id}
            post={p}
            statusAtual={coluna.id}
            onAbrirCard={onAbrirCard}
            camposVisiveis={camposVisiveis}
            responsaveis={responsaveisPorPost[p.id] ?? []}
            qtdSubconteudos={contagemSubconteudos[p.id] ?? 0}
            tituloPai={tituloPaiPorPost[p.id]}
            acoes={acoes}
          />
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
  responsaveis,
  qtdSubconteudos,
  tituloPai,
  acoes,
}: {
  post: Post;
  statusAtual: string;
  onAbrirCard: (post: Post) => void;
  camposVisiveis: CamposVisiveis;
  responsaveis: Responsavel[];
  qtdSubconteudos: number;
  tituloPai?: string;
  acoes: AcoesPost;
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
      <KanbanCardConteudo post={post} camposVisiveis={camposVisiveis} responsaveis={responsaveis} qtdSubconteudos={qtdSubconteudos} tituloPai={tituloPai} acoes={acoes} />
    </div>
  );
}

const CORES_AVATAR = [
  "bg-red-400", "bg-orange-400", "bg-amber-500", "bg-lime-500", "bg-emerald-500",
  "bg-teal-500", "bg-sky-500", "bg-indigo-500", "bg-violet-500", "bg-pink-500",
];
function corAvatar(nome: string) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) % CORES_AVATAR.length;
  return CORES_AVATAR[Math.abs(hash) % CORES_AVATAR.length];
}
function iniciaisAvatar(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}
function AvatarPost({ nome, fotoUrl, tamanho = 22 }: { nome: string; fotoUrl?: string | null; tamanho?: number }) {
  if (fotoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={fotoUrl} alt={nome} className="rounded-full object-cover shrink-0 ring-2 ring-white" style={{ height: tamanho, width: tamanho }} />;
  }
  return (
    <div
      className={`rounded-full ${corAvatar(nome)} text-white flex items-center justify-center font-bold shrink-0 ring-2 ring-white`}
      style={{ height: tamanho, width: tamanho, fontSize: Math.max(8, tamanho * 0.36) }}
    >
      {iniciaisAvatar(nome)}
    </div>
  );
}
function AvatarStackPost({ pessoas, tamanho = 20 }: { pessoas: Responsavel[]; tamanho?: number }) {
  if (pessoas.length === 0) return null;
  const visiveis = pessoas.slice(0, 3);
  const resto = pessoas.length - visiveis.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {visiveis.map((p) => (
        <AvatarPost key={p.id} nome={p.nome} fotoUrl={p.fotoUrl} tamanho={tamanho} />
      ))}
      {resto > 0 && (
        <div
          className="rounded-full bg-surface ring-2 ring-white text-ink/60 font-bold flex items-center justify-center shrink-0"
          style={{ height: tamanho, width: tamanho, fontSize: Math.max(7, tamanho * 0.32) }}
        >
          +{resto}
        </div>
      )}
    </div>
  );
}

interface AcoesPost {
  statusList: StatusItem[];
  funcionariosComAcesso: Responsavel[];
  responsaveisPorPost: Record<string, Responsavel[]>;
  onRenomear: (p: Post) => void;
  onMover: (postId: string, novoStatusId: string) => void;
  onDuplicar: (p: Post) => void;
  onExcluir: (p: Post) => void;
  onArquivar: (p: Post) => void;
  onAtribuir: (p: Post, funcionarioId: string) => void;
  onCopiarLink: (p: Post) => void;
}

function FiltroClienteConteudo({
  clientes,
  valorId,
  onMudar,
}: {
  clientes: ClienteOpcao[];
  valorId: string;
  onMudar: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const selecionado = clientes.find((c) => c.id === valorId);
  const sugestoes = clientes.filter((c) => normalizar(c.nome).includes(normalizar(busca)));

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2 px-1">Cliente</p>
      {selecionado ? (
        <div className="flex items-center justify-between rounded-xl bg-mint px-3 py-2">
          <span className="text-sm font-semibold text-forest truncate">{selecionado.nome}</span>
          <button onClick={() => onMudar("")} className="text-forest hover:text-ink text-xs font-bold shrink-0 ml-2">
            ✕
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setAberto(true);
            }}
            onFocus={() => setAberto(true)}
            className="input py-1.5 text-sm"
            placeholder="Todos os clientes — digite pra filtrar..."
          />
          {aberto && busca && (
            <div className="absolute z-30 mt-1 w-full rounded-xl bg-white border border-black/10 shadow-lg max-h-48 overflow-auto">
              {sugestoes.length > 0 ? (
                sugestoes.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onMudar(c.id);
                      setAberto(false);
                      setBusca("");
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface"
                  >
                    {c.nome}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm text-ink/40">Nenhum cliente encontrado.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuAcoesPost({ post, acoes }: { post: Post; acoes: AcoesPost }) {
  const [aberto, setAberto] = useState(false);
  const [submenu, setSubmenu] = useState<"mover" | "atribuir" | null>(null);
  const [posicao, setPosicao] = useState({ top: 0, left: 0 });
  const botaoRef = useRef<HTMLButtonElement>(null);
  const responsaveisAtuais = acoes.responsaveisPorPost[post.id] ?? [];

  function abrir() {
    const rect = botaoRef.current?.getBoundingClientRect();
    if (rect) setPosicao({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 210) });
    setAberto(true);
  }
  function fechar() {
    setAberto(false);
    setSubmenu(null);
  }

  return (
    <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <button
        ref={botaoRef}
        onClick={() => (aberto ? fechar() : abrir())}
        className="h-6 w-6 rounded-full bg-white/90 hover:bg-surface flex items-center justify-center text-ink/50 shadow-sm text-xs font-bold"
      >
        ⋯
      </button>
      {aberto &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={fechar} />
            <div className="fixed z-50 w-52 rounded-xl bg-white border border-black/10 shadow-lg py-1" style={{ top: posicao.top, left: posicao.left }}>
              {submenu === null && (
                <>
                  <button
                    onClick={() => {
                      acoes.onRenomear(post);
                      fechar();
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-ink/70 hover:bg-surface"
                  >
                    Renomear
                  </button>
                  <button onClick={() => setSubmenu("mover")} className="w-full text-left px-3 py-1.5 text-xs text-ink/70 hover:bg-surface">
                    Mover para etapa
                  </button>
                  <button onClick={() => setSubmenu("atribuir")} className="w-full text-left px-3 py-1.5 text-xs text-ink/70 hover:bg-surface">
                    Atribuir a
                  </button>
                  <button
                    onClick={() => {
                      acoes.onDuplicar(post);
                      fechar();
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-ink/70 hover:bg-surface"
                  >
                    Duplicar
                  </button>
                  <button
                    onClick={() => {
                      acoes.onCopiarLink(post);
                      fechar();
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-ink/70 hover:bg-surface"
                  >
                    Copiar link
                  </button>
                  <button
                    onClick={() => {
                      acoes.onArquivar(post);
                      fechar();
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-ink/50 hover:bg-surface"
                  >
                    Arquivar
                  </button>
                  <button
                    onClick={() => {
                      acoes.onExcluir(post);
                      fechar();
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-surface"
                  >
                    Excluir
                  </button>
                </>
              )}
              {submenu === "mover" && (
                <>
                  <button onClick={() => setSubmenu(null)} className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-ink/40 hover:bg-surface">
                    ← Voltar
                  </button>
                  {acoes.statusList.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        acoes.onMover(post.id, s.id);
                        fechar();
                      }}
                      className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs text-ink/70 hover:bg-surface"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${corDoStatus(s.cor).dot}`} />
                      {s.nome}
                    </button>
                  ))}
                </>
              )}
              {submenu === "atribuir" && (
                <>
                  <button onClick={() => setSubmenu(null)} className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-ink/40 hover:bg-surface">
                    ← Voltar
                  </button>
                  <div className="grid grid-cols-5 gap-2 p-2.5">
                    {acoes.funcionariosComAcesso.map((f) => {
                      const marcado = responsaveisAtuais.some((r) => r.id === f.id);
                      return (
                        <button key={f.id} onClick={() => acoes.onAtribuir(post, f.id)} className="relative" title={f.nome}>
                          <AvatarPost nome={f.nome} fotoUrl={f.fotoUrl} tamanho={30} />
                          {marcado && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-forest text-white text-[8px] flex items-center justify-center ring-2 ring-white">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

function KanbanCardConteudo({
  post,
  camposVisiveis,
  responsaveis = [],
  qtdSubconteudos = 0,
  tituloPai,
  acoes,
  arrastando,
}: {
  post: Post;
  camposVisiveis: CamposVisiveis;
  responsaveis?: Responsavel[];
  qtdSubconteudos?: number;
  tituloPai?: string;
  acoes?: AcoesPost;
  arrastando?: boolean;
}) {
  const mostrarTitulo = camposVisiveis.titulo && post.titulo;
  const mostrarCliente = camposVisiveis.cliente;
  const mostrarFormato = camposVisiveis.formato && post.formato;
  const mostrarResponsavel = camposVisiveis.responsavel && responsaveis.length > 0;
  const temIndicador = post.observacoes_internas || qtdSubconteudos > 0;

  return (
    <div
      className={`relative group/card rounded-2xl bg-white p-3 cursor-grab active:cursor-grabbing transition-shadow ${arrastando ? "w-72" : "w-full"} ${
        arrastando ? "shadow-2xl rotate-2 border-2 border-forest/30" : "border border-black/5 shadow-sm hover:shadow-md"
      }`}
    >
      {acoes && !arrastando && (
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
          <MenuAcoesPost post={post} acoes={acoes} />
        </div>
      )}
      {tituloPai && (
        <p className="text-[10px] text-forest font-semibold truncate mb-0.5 flex items-center gap-1">
          <span>↳</span> {tituloPai}
        </p>
      )}
      <p className="text-sm font-semibold text-ink truncate pr-5">
        {mostrarTitulo ? post.titulo : nomeCliente(post) || "Sem título"}
      </p>
      {mostrarCliente && <p className="text-xs text-ink/50 truncate mt-0.5">{nomeCliente(post)}</p>}

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {mostrarFormato && (
          <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-surface text-ink/60">{FORMATO_CONFIG[post.formato!]?.label}</span>
        )}
        {post.data_inicio && <span className="text-[10px] text-ink/40">Início: {formatarDataChip(post.data_inicio)}</span>}
        <span className="text-[10px] text-ink/40">
          Publica: {formatarDataChip(post.data_publicacao)}
          {post.hora_publicacao && ` ${post.hora_publicacao.slice(0, 5)}`}
        </span>
      </div>

      {(temIndicador || mostrarResponsavel) && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/5">
          <div className="flex items-center gap-2 text-ink/40">
            {post.observacoes_internas && <span title="Tem observações">☰</span>}
            {qtdSubconteudos > 0 && (
              <span className="flex items-center gap-0.5 text-[11px]" title="Sub-conteúdos">
                🔗 {qtdSubconteudos}
              </span>
            )}
          </div>
          {mostrarResponsavel && <AvatarStackPost pessoas={responsaveis} />}
        </div>
      )}
    </div>
  );
}
