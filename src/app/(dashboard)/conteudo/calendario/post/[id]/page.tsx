"use client";

import { useEffect, useLayoutEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { comLinks } from "@/lib/linkify";
import { comMencoesColoridas } from "@/lib/mencao-highlight";
import { normalizar } from "@/lib/normalizar";
import { corDoStatus } from "@/lib/status-conteudo";
import { RichTextEditor } from "@/components/rich-text-editor";
import { BuscaCliente } from "@/components/busca-cliente";
import { Cronometro, formatarDuracao } from "@/components/cronometro";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, Download, X, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { iconeHistorico, comValoresDestacados, segundosPorPessoaDoHistorico } from "@/lib/historico-visual";

interface StatusItem {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}
interface Opcao {
  id: string;
  nome: string;
}
interface Responsavel {
  id: string;
  nome: string;
  fotoUrl: string | null;
  authUserId: string | null;
}
interface Comentario {
  id: string;
  autor_id: string | null;
  texto: string;
  created_at: string;
  doCliente?: boolean;
}
interface HistoricoItem {
  id: string;
  autor_id: string | null;
  descricao: string;
  created_at: string;
}
const ALTURA_COLAPSADA_LEGENDA = 90;

function extrairMencoes(html: string): Set<string> {
  const ids = new Set<string>();
  const regex = /data-mencao-id="([^"]+)"/g;
  let m;
  while ((m = regex.exec(html))) ids.add(m[1]);
  return ids;
}

interface Post {
  id: string;
  titulo: string | null;
  legenda: string | null;
  observacoes_internas: string | null;
  cliente_id: string | null;
  objetivo: string | null;
  formato: string | null;
  status_id: string;
  data_publicacao: string;
  data_inicio: string | null;
  hora_publicacao: string | null;
  post_pai_id: string | null;
  link_video: string | null;
  tempo_total_segundos: number;
  timer_iniciado_em: string | null;
  timer_iniciado_por: string | null;
  excluido_em: string | null;
  excluido_por: string | null;
}

interface Midia {
  id: string;
  arquivo_path: string;
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
  ordem: number;
  url: string;
}

interface SubConteudo {
  id: string;
  titulo: string | null;
  status_id: string;
  data_publicacao: string;
  ordem: number;
}
const OBJETIVO_CONFIG: Record<string, string> = {
  atracao: "Atração",
  educacao: "Educação",
  conversao: "Conversão",
  conexao: "Conexão",
  institucional: "Institucional",
  bastidores: "Bastidores",
};
const FORMATO_CONFIG: Record<string, string> = { estatico: "Estático", carrossel: "Carrossel", video: "Vídeo" };

const CORES_AVATAR = [
  "bg-red-400", "bg-orange-400", "bg-amber-500", "bg-lime-500", "bg-emerald-500",
  "bg-teal-500", "bg-sky-500", "bg-indigo-500", "bg-violet-500", "bg-pink-500",
];
function corAvatar(nome: string) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) % CORES_AVATAR.length;
  return CORES_AVATAR[Math.abs(hash) % CORES_AVATAR.length];
}
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}
function Avatar({ nome, fotoUrl, tamanho = 32 }: { nome: string; fotoUrl?: string | null; tamanho?: number }) {
  if (fotoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={fotoUrl} alt={nome} className="rounded-full object-cover shrink-0 ring-2 ring-white" style={{ height: tamanho, width: tamanho }} />;
  }
  return (
    <div
      className={`rounded-full ${corAvatar(nome)} text-white flex items-center justify-center font-bold shrink-0 ring-2 ring-white`}
      style={{ height: tamanho, width: tamanho, fontSize: Math.max(9, tamanho * 0.36) }}
    >
      {iniciais(nome)}
    </div>
  );
}
function AvatarStack({ pessoas, tamanho = 22 }: { pessoas: Responsavel[]; tamanho?: number }) {
  if (pessoas.length === 0) return null;
  const visiveis = pessoas.slice(0, 4);
  const resto = pessoas.length - visiveis.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {visiveis.map((p) => (
        <Avatar key={p.id} nome={p.nome} fotoUrl={p.fotoUrl} tamanho={tamanho} />
      ))}
      {resto > 0 && (
        <div
          className="rounded-full bg-surface ring-2 ring-white text-ink/60 font-bold flex items-center justify-center shrink-0"
          style={{ height: tamanho, width: tamanho, fontSize: Math.max(8, tamanho * 0.32) }}
        >
          +{resto}
        </div>
      )}
    </div>
  );
}

function formatarDataCurta(iso: string | null) {
  if (!iso) return "Sem data";
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatarQuando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function renderizarTexto(texto: string, todosOsNomes: string[]) {
  if (todosOsNomes.length === 0) return comLinks(texto, "txt");
  const nomesEscapados = [...todosOsNomes].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regexMencao = new RegExp(`@(${nomesEscapados.join("|")})`, "g");
  const partes = texto.split(regexMencao);
  return partes.map((p, i) =>
    todosOsNomes.includes(p) ? (
      <span key={i} className="text-forest font-semibold bg-mint rounded px-1">
        @{p}
      </span>
    ) : (
      <span key={i}>{comLinks(p, `txt-${i}`)}</span>
    )
  );
}

export default function PostDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [veioDePauta, setVeioDePauta] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setVeioDePauta(new URLSearchParams(window.location.search).get("from") === "pauta");
    }
  }, []);

  const [post, setPost] = useState<Post | null>(null);
  const [statusList, setStatusList] = useState<StatusItem[]>([]);
  const [clientes, setClientes] = useState<Opcao[]>([]);
  const [funcionariosComAcesso, setFuncionariosComAcesso] = useState<Responsavel[]>([]);
  const [colegas, setColegas] = useState<Opcao[]>([]);
  const [referenciaveis, setReferenciaveis] = useState<{ id: string; titulo: string; tipo: "tarefa" | "conteudo"; clienteNome: string | null }[]>(
    []
  );
  const [meuId, setMeuId] = useState<string | null>(null);
  const [sessoesTempo, setSessoesTempo] = useState<
    { funcionario_auth_id: string; iniciado_em: string | null; segundos_acumulados: number }[]
  >([]);
  const [meuNome, setMeuNome] = useState("Você");
  const [meuFotoUrl, setMeuFotoUrl] = useState<string | null>(null);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [seletorResponsavelAberto, setSeletorResponsavelAberto] = useState(false);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusAberto, setStatusAberto] = useState(false);
  const [abaLateral, setAbaLateral] = useState<"comentarios" | "historico" | "horas">("comentarios");
  const [painelRecolhido, setPainelRecolhido] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [legenda, setLegenda] = useState("");
  const ultimaLegendaSalvaRef = useRef<string | null>(null);
  const legendaRef = useRef<HTMLTextAreaElement>(null);
  const [legendaRecolhida, setLegendaRecolhida] = useState(false);
  const [legendaTransborda, setLegendaTransborda] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<Opcao | null>(null);
  const [objetivo, setObjetivo] = useState("");
  const [formato, setFormato] = useState("");
  const [linkVideo, setLinkVideo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataPublicacao, setDataPublicacao] = useState("");
  const [horaPublicacao, setHoraPublicacao] = useState("");
  const [midias, setMidias] = useState<Midia[]>([]);
  const [enviandoMidia, setEnviandoMidia] = useState(false);
  const [indiceMidiaAberta, setIndiceMidiaAberta] = useState<number | null>(null);
  const inputMidiaRef = useRef<HTMLInputElement>(null);

  const [tituloPostPai, setTituloPostPai] = useState<string | null>(null);
  const [itensNav, setItensNav] = useState<{ id: string; titulo: string | null; status_id: string }[]>([]);
  const [tituloNav, setTituloNav] = useState<string | null>(null);
  const [idPaiNav, setIdPaiNav] = useState<string | null>(null);
  const [railColapsado, setRailColapsado] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setRailColapsado(localStorage.getItem("conteudo-rail-colapsado") === "true");
    }
  }, []);

  useLayoutEffect(() => {
    const el = legendaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    setLegendaTransborda(el.scrollHeight > ALTURA_COLAPSADA_LEGENDA + 20);
  });

  function alternarRail() {
    setRailColapsado((v) => {
      const novo = !v;
      if (typeof window !== "undefined") localStorage.setItem("conteudo-rail-colapsado", String(novo));
      return novo;
    });
  }
  const [subConteudos, setSubConteudos] = useState<SubConteudo[]>([]);
  const [responsaveisPorSub, setResponsaveisPorSub] = useState<Record<string, Responsavel[]>>({});
  const [novoSubConteudo, setNovoSubConteudo] = useState("");
  const [criandoSub, setCriandoSub] = useState(false);
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [novoComentario, setNovoComentario] = useState("");
  const [mencaoBusca, setMencaoBusca] = useState<string | null>(null);
  const [indiceMencaoComentario, setIndiceMencaoComentario] = useState(0);
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const comentarioRef = useRef<HTMLTextAreaElement>(null);

  const carregarTudo = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [{ data: p }, { data: statusData }, { data: clientesData }, { data: funcData }] = await Promise.all([
      supabase.from("posts_conteudo").select("*").eq("id", id).maybeSingle(),
      supabase.from("status_conteudo").select("id, nome, cor, ordem").order("ordem"),
      supabase.from("clientes").select("id, papeis ( pessoas ( nome ) )"),
      supabase.from("funcionarios").select("id, auth_user_id, papeis ( pessoas ( nome, apelido, foto_url ) )"),
    ]);

    setStatusList(statusData ?? []);
    const listaClientes = ((clientesData ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[])
      .map((c) => ({ id: c.id, nome: c.papeis?.pessoas?.nome ?? "—" }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setClientes(listaClientes);

    const listaFunc = ((funcData ?? []) as unknown as {
      id: string;
      auth_user_id: string | null;
      papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null;
    }[]).map((f) => ({
      id: f.id,
      nome: f.papeis?.pessoas?.apelido || f.papeis?.pessoas?.nome || "Colega",
      fotoUrl: f.papeis?.pessoas?.foto_url ?? null,
      authUserId: f.auth_user_id,
    }));
    setFuncionariosComAcesso(listaFunc.filter((f) => f.authUserId).sort((a, b) => a.nome.localeCompare(b.nome)));
    setColegas(listaFunc.filter((f) => f.authUserId).map((f) => ({ id: f.id, nome: f.nome })));

    if (user) {
      setMeuId(user.id);
      const eu = listaFunc.find((f) => f.authUserId === user.id);
      setMeuNome(eu?.nome ?? "Você");
      setMeuFotoUrl(eu?.fotoUrl ?? null);
    }

    if (p) {
      setPost(p);
      setTitulo(p.titulo ?? "");
      setLegenda(p.legenda ?? "");
      ultimaLegendaSalvaRef.current = p.legenda ?? "";
      setObservacoes(p.observacoes_internas ?? "");
      mencoesObservacoesRef.current = extrairMencoes(p.observacoes_internas ?? "");
      setClienteSelecionado(listaClientes.find((c) => c.id === p.cliente_id) ?? null);
      {
        const supabase2 = createClient();
        const { data: sessoes } = await supabase2
          .from("posts_conteudo_tempo_sessoes")
          .select("funcionario_auth_id, iniciado_em, segundos_acumulados")
          .eq("post_id", id);
        setSessoesTempo(sessoes ?? []);
      }
      {
        const supabase2 = createClient();
        const [{ data: todasTarefas }, { data: todosPosts }] = await Promise.all([
          supabase2
            .from("tarefas")
            .select("id, titulo, clientes ( papeis ( pessoas ( nome ) ) )")
            .is("excluido_em", null)
            .eq("arquivada", false)
            .order("created_at", { ascending: false })
            .limit(300),
          supabase2
            .from("posts_conteudo")
            .select("id, titulo, clientes ( papeis ( pessoas ( nome ) ) )")
            .is("excluido_em", null)
            .eq("arquivado", false)
            .neq("id", id)
            .order("created_at", { ascending: false })
            .limit(300),
        ]);
        setReferenciaveis([
          ...((todasTarefas ?? []) as unknown as { id: string; titulo: string; clientes: { papeis: { pessoas: { nome: string } | null } | null } | null }[]).map(
            (x) => ({ id: x.id, titulo: x.titulo, tipo: "tarefa" as const, clienteNome: x.clientes?.papeis?.pessoas?.nome ?? null })
          ),
          ...((todosPosts ?? []) as unknown as { id: string; titulo: string | null; clientes: { papeis: { pessoas: { nome: string } | null } | null } | null }[]).map(
            (x) => ({ id: x.id, titulo: x.titulo || "Sem título", tipo: "conteudo" as const, clienteNome: x.clientes?.papeis?.pessoas?.nome ?? null })
          ),
        ]);
      }
      setObjetivo(p.objetivo ?? "");
      setFormato(p.formato ?? "");
      setLinkVideo(p.link_video ?? "");
      setDataInicio(p.data_inicio ?? "");
      setDataPublicacao(p.data_publicacao ?? "");
      setHoraPublicacao(p.hora_publicacao ?? "");

      if (p.post_pai_id) {
        const { data: pai } = await supabase.from("posts_conteudo").select("titulo").eq("id", p.post_pai_id).maybeSingle();
        setTituloPostPai(pai?.titulo ?? null);
        setTituloNav(pai?.titulo ?? "Sem título");
        setIdPaiNav(p.post_pai_id);
        const { data: irmaos } = await supabase
          .from("posts_conteudo")
          .select("id, titulo, status_id")
          .eq("post_pai_id", p.post_pai_id)
          .is("excluido_em", null)
          .order("ordem");
        setItensNav(irmaos ?? []);
      } else {
        setTituloPostPai(null);
        setTituloNav(p.titulo || "Sem título");
        setIdPaiNav(p.id);
        const { data: filhos } = await supabase
          .from("posts_conteudo")
          .select("id, titulo, status_id")
          .eq("post_pai_id", p.id)
          .is("excluido_em", null)
          .order("ordem");
        setItensNav(filhos ?? []);
      }

      const { data: midiasData } = await supabase
        .from("posts_conteudo_midias")
        .select("id, arquivo_path, arquivo_nome, arquivo_tipo, ordem")
        .eq("post_id", p.id)
        .order("ordem");
      setMidias(
        (midiasData ?? []).map((m) => ({
          ...m,
          url: supabase.storage.from("conteudo-midia").getPublicUrl(m.arquivo_path).data.publicUrl,
        }))
      );
    }
    setLoading(false);
  }, [id]);

  const carregarSubConteudos = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("posts_conteudo")
      .select("id, titulo, status_id, data_publicacao, ordem")
      .eq("post_pai_id", id)
      .is("excluido_em", null)
      .order("ordem");
    const lista = data ?? [];
    setSubConteudos(lista);

    const ids = lista.map((s) => s.id);
    if (ids.length > 0) {
      const { data: respData } = await supabase
        .from("posts_conteudo_responsaveis")
        .select("post_id, funcionarios ( id, papeis ( pessoas ( nome, apelido, foto_url ) ) )")
        .in("post_id", ids);
      const mapa: Record<string, Responsavel[]> = {};
      for (const r of (respData ?? []) as unknown as {
        post_id: string;
        funcionarios: { id: string; papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null } | null;
      }[]) {
        if (!r.funcionarios) continue;
        const pessoa = r.funcionarios.papeis?.pessoas;
        const resp: Responsavel = {
          id: r.funcionarios.id,
          nome: pessoa?.apelido || pessoa?.nome || "Colega",
          fotoUrl: pessoa?.foto_url ?? null,
          authUserId: null,
        };
        if (!mapa[r.post_id]) mapa[r.post_id] = [];
        mapa[r.post_id].push(resp);
      }
      setResponsaveisPorSub(mapa);
    } else {
      setResponsaveisPorSub({});
    }
  }, [id]);

  useEffect(() => {
    carregarTudo();
    carregarSubConteudos();
  }, [carregarTudo, carregarSubConteudos]);

  const carregarResponsaveis = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("posts_conteudo_responsaveis")
      .select("funcionarios ( id, auth_user_id, papeis ( pessoas ( nome, apelido, foto_url ) ) )")
      .eq("post_id", id);
    const lista = ((data ?? []) as unknown as {
      funcionarios: { id: string; auth_user_id: string | null; papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null } | null;
    }[])
      .map((r) => r.funcionarios)
      .filter(Boolean)
      .map((f) => ({
        id: f!.id,
        nome: f!.papeis?.pessoas?.apelido || f!.papeis?.pessoas?.nome || "Colega",
        fotoUrl: f!.papeis?.pessoas?.foto_url ?? null,
        authUserId: f!.auth_user_id,
      }));
    setResponsaveis(lista);
  }, [id]);

  const carregarComentarios = useCallback(async () => {
    const supabase = createClient();
    const [{ data: internos }, { data: doCliente }] = await Promise.all([
      supabase.from("posts_conteudo_comentarios_internos").select("id, autor_id, texto, created_at").eq("post_id", id).order("created_at"),
      supabase.from("posts_conteudo_comentarios").select("id, texto, created_at, autor").eq("post_id", id).order("created_at"),
    ]);
    const listaInternos: Comentario[] = (internos ?? []).map((c) => ({ ...c, doCliente: false }));
    const listaCliente: Comentario[] = ((doCliente ?? []) as { id: string; texto: string; created_at: string; autor: string }[]).map((c) => ({
      id: `cliente-${c.id}`,
      autor_id: null,
      texto: c.texto,
      created_at: c.created_at,
      doCliente: c.autor === "cliente",
    }));
    const todos = [...listaInternos, ...listaCliente].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    setComentarios(todos);
  }, [id]);

  const carregarHistorico = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("posts_conteudo_historico")
      .select("id, autor_id, descricao, created_at")
      .eq("post_id", id)
      .order("created_at", { ascending: false });
    setHistorico(data ?? []);
  }, [id]);

  useEffect(() => {
    carregarResponsaveis();
    carregarComentarios();
    carregarHistorico();
  }, [carregarResponsaveis, carregarComentarios, carregarHistorico]);

  // Salva a legenda sozinha, alguns instantes depois que a pessoa para de
  // digitar — assim, mesmo se ela fechar a aba ou sair rápido antes do campo
  // perder o foco (que era o único jeito de salvar antes), o texto não se
  // perde.
  useEffect(() => {
    if (ultimaLegendaSalvaRef.current === legenda) return;
    const timer = setTimeout(async () => {
      const supabase = createClient();
      await supabase.from("posts_conteudo").update({ legenda: legenda || null }).eq("id", id);
      ultimaLegendaSalvaRef.current = legenda;
    }, 1000);
    return () => clearTimeout(timer);
  }, [legenda, id]);

  useEffect(() => {
    if (indiceMidiaAberta === null) return;
    function aoTeclar(e: KeyboardEvent) {
      if (midias.length === 0) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndiceMidiaAberta((i) => (i! > 0 ? i! - 1 : midias.length - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndiceMidiaAberta((i) => (i! < midias.length - 1 ? i! + 1 : 0));
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIndiceMidiaAberta(null);
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [indiceMidiaAberta, midias.length]);

  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel(`post-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts_conteudo_comentarios_internos", filter: `post_id=eq.${id}` },
        () => carregarComentarios()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts_conteudo_comentarios", filter: `post_id=eq.${id}` },
        () => carregarComentarios()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [id, carregarComentarios]);

  async function registrarHistorico(descricaoEvento: string, notificar: boolean = false, categoria: string = "geral") {
    const supabase = createClient();
    await supabase.from("posts_conteudo_historico").insert({ post_id: id, autor_id: meuId, descricao: descricaoEvento });
    setHistorico((atual) => [
      { id: `temp-${Date.now()}`, autor_id: meuId, descricao: descricaoEvento, created_at: new Date().toISOString() },
      ...atual,
    ]);

    if (!notificar) return;
    const destinatarios = responsaveis.filter((r) => r.authUserId && r.authUserId !== meuId).map((r) => r.authUserId!);
    if (destinatarios.length === 0) return;

    const tipo = `mudanca_conteudo_${categoria}`;
    const desde = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const { data: recentes } = await supabase
      .from("notificacoes")
      .select("id")
      .eq("link", `/conteudo/calendario/post/${id}`)
      .eq("tipo", tipo)
      .gte("created_at", desde)
      .limit(1);
    if (recentes && recentes.length > 0) return;

    await supabase.from("notificacoes").insert(
      destinatarios.map((destId) => ({
        destinatario_id: destId,
        tipo,
        titulo: `${meuNome} ${descricaoEvento} num conteúdo seu`,
        descricao: post?.titulo ?? null,
        link: `/conteudo/calendario/post/${id}`,
        autor_id: meuId,
        autor_nome: meuNome,
        autor_foto_url: meuFotoUrl,
      }))
    );
  }

  async function salvarCampo(campo: Record<string, string | null>, eventoHistorico?: string, notificar: boolean = false, categoria: string = "geral") {
    const supabase = createClient();
    await supabase.from("posts_conteudo").update(campo).eq("id", id);
    if (eventoHistorico) registrarHistorico(eventoHistorico, notificar, categoria);
  }

  const mencoesObservacoesRef = useRef<Set<string>>(new Set());

  async function notificarNovasMencoesObservacoes() {
    const atuais = extrairMencoes(observacoes);
    const novos = [...atuais].filter((authUserId) => !mencoesObservacoesRef.current.has(authUserId));
    mencoesObservacoesRef.current = atuais;
    if (novos.length === 0 || !meuId) return;
    const supabase = createClient();
    const destinatarios = novos.filter((authUserId) => authUserId !== meuId);
    if (destinatarios.length === 0) return;
    await supabase.from("notificacoes").insert(
      destinatarios.map((authUserId) => ({
        destinatario_id: authUserId,
        tipo: "mencao_conteudo",
        titulo: `${meuNome} te mencionou num conteúdo`,
        descricao: post?.titulo ?? "",
        link: `/conteudo/calendario/post/${id}`,
        autor_id: meuId,
        autor_nome: meuNome,
        autor_foto_url: meuFotoUrl,
      }))
    );
  }

  async function adicionarMidias(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return;

    const arquivosParaEnviar = Array.from(arquivos);

    setEnviandoMidia(true);
    const supabase = createClient();
    let proximaOrdem = midias.length;
    const erros: string[] = [];
    for (const arquivo of arquivosParaEnviar) {
      const extensao = arquivo.name.split(".").pop();
      const caminho = `${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extensao}`;
      const { error } = await supabase.storage.from("conteudo-midia").upload(caminho, arquivo);
      if (!error) {
        const { data: nova, error: erroInsert } = await supabase
          .from("posts_conteudo_midias")
          .insert({ post_id: id, arquivo_path: caminho, arquivo_nome: arquivo.name, arquivo_tipo: arquivo.type, ordem: proximaOrdem })
          .select("id, arquivo_path, arquivo_nome, arquivo_tipo, ordem")
          .single();
        if (nova) {
          const url = supabase.storage.from("conteudo-midia").getPublicUrl(nova.arquivo_path).data.publicUrl;
          setMidias((atual) => [...atual, { ...nova, url }]);
        }
        if (erroInsert) erros.push(`${arquivo.name}: ${erroInsert.message}`);
        proximaOrdem++;
      } else {
        erros.push(`${arquivo.name}: ${error.message}`);
      }
    }
    if (erros.length > 0) {
      alert(`Não foi possível subir ${erros.length === 1 ? "esse arquivo" : "esses arquivos"}:\n\n${erros.join("\n")}`);
    }
    if (arquivosParaEnviar.length > erros.length) {
      registrarHistorico(`adicionou ${arquivosParaEnviar.length > 1 ? `${arquivosParaEnviar.length} artes` : "uma arte"}`, true, "midia");
    }
    setEnviandoMidia(false);
  }

  async function removerMidia(midiaId: string) {
    if (!window.confirm("Remover essa mídia do post?")) return;
    const supabase = createClient();
    await supabase.from("posts_conteudo_midias").delete().eq("id", midiaId);
    setMidias((atual) => atual.filter((m) => m.id !== midiaId));
  }

  async function baixarArquivo(url: string, nomeArquivo: string) {
    try {
      const resposta = await fetch(url);
      const blob = await resposta.blob();
      const urlBlob = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = urlBlob;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(urlBlob);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  async function moverMidia(index: number, direcao: -1 | 1) {
    const alvo = index + direcao;
    if (alvo < 0 || alvo >= midias.length) return;
    const novaOrdem = [...midias];
    [novaOrdem[index], novaOrdem[alvo]] = [novaOrdem[alvo], novaOrdem[index]];
    setMidias(novaOrdem);
    const supabase = createClient();
    await Promise.all(novaOrdem.map((m, i) => supabase.from("posts_conteudo_midias").update({ ordem: i }).eq("id", m.id)));
  }

  async function excluirPost() {
    if (!window.confirm("Mover esse conteúdo (e os sub-conteúdos dele) pra lixeira? Um administrador pode restaurar em até 30 dias.")) return;
    const supabase = createClient();
    const ids = [id, ...subConteudos.map((s) => s.id)];
    await supabase.from("posts_conteudo").update({ excluido_em: new Date().toISOString(), excluido_por: meuId }).in("id", ids);
    router.push(post?.post_pai_id ? `/conteudo/calendario/post/${post.post_pai_id}` : "/conteudo/calendario");
  }

  async function restaurarPost() {
    const supabase = createClient();
    const ids = [id, ...subConteudos.map((s) => s.id)];
    await supabase.from("posts_conteudo").update({ excluido_em: null, excluido_por: null }).in("id", ids);
    setPost((p) => (p ? { ...p, excluido_em: null, excluido_por: null } : p));
  }

  async function excluirPostDefinitivo() {
    if (!window.confirm("Excluir esse conteúdo definitivamente, sem volta nenhuma?")) return;
    const supabase = createClient();
    await supabase.from("posts_conteudo").delete().eq("id", id);
    router.push("/configuracoes/lixeira");
  }

  async function iniciarCronometro() {
    if (!meuId) return;
    const supabase = createClient();
    const agora = new Date().toISOString();
    await supabase
      .from("posts_conteudo_tempo_sessoes")
      .upsert({ post_id: id, funcionario_auth_id: meuId, iniciado_em: agora }, { onConflict: "post_id,funcionario_auth_id" });
    setSessoesTempo((atual) => {
      const semEu = atual.filter((s) => s.funcionario_auth_id !== meuId);
      const minha = atual.find((s) => s.funcionario_auth_id === meuId);
      return [...semEu, { funcionario_auth_id: meuId, iniciado_em: agora, segundos_acumulados: minha?.segundos_acumulados ?? 0 }];
    });
  }

  async function pausarCronometro() {
    const minhaSessao = sessoesTempo.find((s) => s.funcionario_auth_id === meuId);
    if (!meuId || !minhaSessao?.iniciado_em || !post) return;
    const segundosCorridos = Math.floor((Date.now() - new Date(minhaSessao.iniciado_em).getTime()) / 1000);
    const novoAcumuladoMeu = minhaSessao.segundos_acumulados + segundosCorridos;
    const novoTotalGeral = post.tempo_total_segundos + segundosCorridos;
    const supabase = createClient();
    await Promise.all([
      supabase
        .from("posts_conteudo_tempo_sessoes")
        .update({ iniciado_em: null, segundos_acumulados: novoAcumuladoMeu })
        .eq("post_id", id)
        .eq("funcionario_auth_id", meuId),
      supabase.from("posts_conteudo").update({ tempo_total_segundos: novoTotalGeral }).eq("id", id),
    ]);
    setSessoesTempo((atual) =>
      atual.map((s) => (s.funcionario_auth_id === meuId ? { ...s, iniciado_em: null, segundos_acumulados: novoAcumuladoMeu } : s))
    );
    setPost((p) => (p ? { ...p, tempo_total_segundos: novoTotalGeral } : p));
    const minutos = Math.round(segundosCorridos / 60);
    registrarHistorico(`passou ${minutos < 1 ? "menos de 1min" : `${minutos}min`} trabalhando nesse conteúdo`);
  }

  async function toggleResponsavel(funcionarioId: string) {
    const supabase = createClient();
    const pessoa = funcionariosComAcesso.find((f) => f.id === funcionarioId);
    const jaTem = responsaveis.some((r) => r.id === funcionarioId);
    if (jaTem) {
      setResponsaveis((atual) => atual.filter((r) => r.id !== funcionarioId));
      await supabase.from("posts_conteudo_responsaveis").delete().eq("post_id", id).eq("funcionario_id", funcionarioId);
      if (pessoa) registrarHistorico(`removeu ${pessoa.nome} dos responsáveis`, true, "responsavel");
    } else {
      if (pessoa) setResponsaveis((atual) => [...atual, pessoa]);
      await supabase.from("posts_conteudo_responsaveis").insert({ post_id: id, funcionario_id: funcionarioId });
      if (pessoa) registrarHistorico(`atribuiu ${pessoa.nome} como responsável`, true, "responsavel");
      if (pessoa?.authUserId && pessoa.authUserId !== meuId) {
        await supabase.from("notificacoes").insert({
          destinatario_id: pessoa.authUserId,
          tipo: "atribuicao_conteudo",
          titulo: `${meuNome} te atribuiu a um conteúdo`,
          descricao: post?.titulo ?? null,
          link: `/conteudo/calendario/post/${id}`,
          autor_id: meuId,
          autor_nome: meuNome,
          autor_foto_url: meuFotoUrl,
        });
      }
    }
  }

  async function adicionarSubConteudo() {
    if (!novoSubConteudo.trim() || !post) return;
    setCriandoSub(true);
    const supabase = createClient();
    await supabase.from("posts_conteudo").insert({
      titulo: novoSubConteudo.trim(),
      post_pai_id: id,
      cliente_id: post.cliente_id,
      data_publicacao: post.data_publicacao,
      status_id: statusList[0]?.id,
      ordem: subConteudos.length,
    });
    setNovoSubConteudo("");
    setCriandoSub(false);
    carregarSubConteudos();
    registrarHistorico(`adicionou o sub-conteúdo "${novoSubConteudo.trim()}"`);
  }

  async function reordenarSubConteudo(indexAntigo: number, indexNovo: number) {
    const nova = [...subConteudos];
    const [movido] = nova.splice(indexAntigo, 1);
    nova.splice(indexNovo, 0, movido);
    setSubConteudos(nova);
    const supabase = createClient();
    await Promise.all(nova.map((s, i) => supabase.from("posts_conteudo").update({ ordem: i }).eq("id", s.id)));
  }

  async function salvarCampoSub(subId: string, campo: Record<string, string | null>) {
    setSubConteudos((atual) => atual.map((s) => (s.id === subId ? { ...s, ...campo } : s)));
    const supabase = createClient();
    await supabase.from("posts_conteudo").update(campo).eq("id", subId);
  }

  async function toggleResponsavelSub(subId: string, funcionarioId: string) {
    const supabase = createClient();
    const atuais = responsaveisPorSub[subId] ?? [];
    const jaTem = atuais.some((r) => r.id === funcionarioId);
    if (jaTem) {
      setResponsaveisPorSub((atual) => ({ ...atual, [subId]: atuais.filter((r) => r.id !== funcionarioId) }));
      await supabase.from("posts_conteudo_responsaveis").delete().eq("post_id", subId).eq("funcionario_id", funcionarioId);
    } else {
      const pessoa = funcionariosComAcesso.find((f) => f.id === funcionarioId);
      if (pessoa) setResponsaveisPorSub((atual) => ({ ...atual, [subId]: [...atuais, pessoa] }));
      await supabase.from("posts_conteudo_responsaveis").insert({ post_id: subId, funcionario_id: funcionarioId });
      if (pessoa?.authUserId) {
        await supabase.from("notificacoes").insert({
          destinatario_id: pessoa.authUserId,
          tipo: "atribuicao_conteudo",
          titulo: `${meuNome} te atribuiu a um sub-conteúdo`,
          descricao: subConteudos.find((s) => s.id === subId)?.titulo ?? null,
          link: `/conteudo/calendario/post/${subId}`,
          autor_id: meuId,
          autor_nome: meuNome,
          autor_foto_url: meuFotoUrl,
        });
      }
    }
  }

  function nomeDoAutor(authUserId: string) {
    return authUserId === meuId ? meuNome : funcionariosComAcesso.find((f) => f.authUserId === authUserId)?.nome ?? "Alguém";
  }

  async function enviarComentario() {
    if (!novoComentario.trim() || !meuId) return;
    setEnviandoComentario(true);
    const supabase = createClient();
    const texto = novoComentario.trim();
    const { error } = await supabase.from("posts_conteudo_comentarios_internos").insert({ post_id: id, autor_id: meuId, texto });
    if (!error) {
      setNovoComentario("");
      const mencionados = colegas.filter((c) => texto.includes(`@${c.nome}`));
      if (mencionados.length > 0) {
        await supabase.from("notificacoes").insert(
          mencionados
            .map((c) => ({
              destinatario_id: funcionariosComAcesso.find((f) => f.id === c.id)?.authUserId ?? null,
              tipo: "mencao_conteudo",
              titulo: `${meuNome} te mencionou num conteúdo`,
              descricao: post?.titulo || texto.slice(0, 120),
              link: `/conteudo/calendario/post/${id}`,
              autor_id: meuId,
              autor_nome: meuNome,
              autor_foto_url: meuFotoUrl,
            }))
            .filter((n) => n.destinatario_id)
        );
      }
      const idsAuthMencionados = new Set(
        mencionados.map((c) => funcionariosComAcesso.find((f) => f.id === c.id)?.authUserId).filter(Boolean)
      );
      const destinatariosComentario = responsaveis
        .filter((r) => r.authUserId && r.authUserId !== meuId && !idsAuthMencionados.has(r.authUserId))
        .map((r) => r.authUserId!);
      if (destinatariosComentario.length > 0) {
        await supabase.from("notificacoes").insert(
          destinatariosComentario.map((destId) => ({
            destinatario_id: destId,
            tipo: "comentario_conteudo",
            titulo: `${meuNome} comentou num conteúdo seu`,
            descricao: post?.titulo || texto.slice(0, 120),
            link: `/conteudo/calendario/post/${id}`,
            autor_id: meuId,
            autor_nome: meuNome,
            autor_foto_url: meuFotoUrl,
          }))
        );
      }
      carregarComentarios();
    }
    setEnviandoComentario(false);
  }

  function selecionarMencao(nome: string) {
    const textarea = comentarioRef.current;
    if (!textarea) return;
    const pos = textarea.selectionStart ?? novoComentario.length;
    const antes = novoComentario.slice(0, pos);
    const depois = novoComentario.slice(pos);
    const novoAntes = antes.replace(/@([a-zA-ZÀ-ÿ]*)$/, `@${nome} `);
    setNovoComentario(novoAntes + depois);
    setMencaoBusca(null);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = novoAntes.length;
    });
  }

  const colegasParaMencao = funcionariosComAcesso.filter((f) => mencaoBusca !== null && normalizar(f.nome).includes(normalizar(mencaoBusca)));
  const todosOsNomes = [meuNome, ...colegas.map((c) => c.nome)];
  const statusAtual = statusList.find((s) => s.id === post?.status_id);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-ink/50">Carregando...</p>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-ink/50">Conteúdo não encontrado.</p>
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col bg-surface/30">
      <div className="px-8 py-4 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(veioDePauta ? "/inicio/pauta" : "/conteudo/calendario")}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white px-4 py-2 text-sm font-bold hover:bg-forest transition-colors"
          >
            {veioDePauta ? "← Pauta" : "← Calendário de Conteúdo"}
          </button>
          {tituloPostPai && post.post_pai_id && (
            <>
              <span className="text-ink/20">/</span>
              <button
                onClick={() => router.push(`/conteudo/calendario/post/${post.post_pai_id}`)}
                className="text-sm font-semibold text-forest hover:text-ink truncate max-w-xs"
              >
                {tituloPostPai}
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Cronometro
            tempoTotalSegundos={post.tempo_total_segundos}
            minhaSessaoIniciadaEm={sessoesTempo.find((s) => s.funcionario_auth_id === meuId)?.iniciado_em ?? null}
            outrosRodando={sessoesTempo.filter((s) => s.iniciado_em && s.funcionario_auth_id !== meuId).map((s) => nomeDoAutor(s.funcionario_auth_id))}
            onIniciar={iniciarCronometro}
            onPausar={pausarCronometro}
          />
          {!post.excluido_em && (
            <button onClick={excluirPost} className="text-sm font-semibold text-red-500 hover:text-red-700">
              Excluir
            </button>
          )}
        </div>
      </div>

      {post.excluido_em && (
        <div className="mx-8 mt-4 rounded-2xl bg-red-50 border-2 border-red-200 px-5 py-3.5 flex items-center justify-between flex-wrap gap-3 shrink-0">
          <p className="text-sm font-bold text-red-700">
            🗑️ Excluído em {formatarQuando(post.excluido_em)}
            {post.excluido_por && ` por ${nomeDoAutor(post.excluido_por)}`}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={restaurarPost} className="rounded-full bg-forest text-white px-4 py-1.5 text-xs font-semibold hover:brightness-110 transition">
              Restaurar
            </button>
            <button
              onClick={excluirPostDefinitivo}
              className="rounded-full border-2 border-red-300 text-red-700 px-4 py-1.5 text-xs font-semibold hover:bg-red-100 transition"
            >
              Excluir de vez
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {itensNav.length > 0 && (
          <div className={`shrink-0 border-r border-black/5 bg-white/60 flex flex-col transition-all duration-200 ${railColapsado ? "w-10" : "w-64"}`}>
            <button
              onClick={alternarRail}
              className="flex items-center gap-2 px-3 py-3 text-ink/40 hover:text-ink shrink-0"
              title={railColapsado ? "Expandir lista" : "Recolher lista"}
            >
              <span className={`text-xs transition-transform ${railColapsado ? "rotate-180" : ""}`}>◀</span>
              {!railColapsado && <span className="text-[11px] font-bold uppercase tracking-wide">Sub-conteúdos</span>}
            </button>
            {!railColapsado && (
              <div className="flex-1 overflow-y-auto px-2 pb-4">
                {tituloNav && (
                  <button
                    onClick={() => idPaiNav && idPaiNav !== id && router.push(`/conteudo/calendario/post/${idPaiNav}`)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold truncate mb-1 ${
                      idPaiNav === id ? "text-ink" : "text-forest hover:bg-surface"
                    }`}
                  >
                    {idPaiNav !== id && "↑ "}
                    {tituloNav}
                  </button>
                )}
                <div className="space-y-0.5">
                  {itensNav.map((item) => {
                    const st = statusList.find((s) => s.id === item.status_id);
                    const ativo = item.id === id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => router.push(`/conteudo/calendario/post/${item.id}`)}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
                          ativo ? "bg-mint text-forest font-bold" : "text-ink/70 hover:bg-surface"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full shrink-0 ${corDoStatus(st?.cor ?? "cinza").dot}`} />
                        <span className="text-xs truncate">{item.titulo || "Sem título"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-8 py-6 max-w-3xl mx-auto w-full">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={() => {
              if (titulo.trim() !== (post.titulo ?? "")) salvarCampo({ titulo: titulo.trim() || null }, `renomeou para "${titulo.trim()}"`);
            }}
            placeholder="Título do post..."
            className="text-2xl font-extrabold text-ink w-full mb-5 outline-none focus:bg-white rounded-lg px-1 -mx-1 bg-transparent"
          />

          {subConteudos.length > 0 &&
            (() => {
              const total = subConteudos.length;
              const completos = subConteudos.filter((s) => statusList.find((st) => st.id === s.status_id)?.cor === "verde").length;
              const pct = Math.round((completos / total) * 100);
              return (
                <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-ink">Progresso do planejamento</span>
                    <span className="text-sm font-bold text-amber-600">{pct}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-black/5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-forest" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-ink/40 mt-1.5">
                    {completos} de {total} sub-conteúdos concluídos
                  </p>
                </div>
              );
            })()}

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6 rounded-2xl bg-white p-3.5 shadow-sm text-sm">
            <div>
              <span className="block text-xs text-ink/50 mb-1">Status</span>
              <div className="relative">
                <button
                  onClick={() => setStatusAberto((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${corDoStatus(statusAtual?.cor ?? "cinza").cor}`}
                >
                  <span className={`h-2 w-2 rounded-full ${corDoStatus(statusAtual?.cor ?? "cinza").dot}`} />
                  {statusAtual?.nome ?? "—"}
                  <span className="text-xs opacity-60">▾</span>
                </button>
                {statusAberto && (
                  <div className="absolute z-20 mt-1 w-56 rounded-2xl bg-white border border-black/10 shadow-lg p-1.5" onMouseLeave={() => setStatusAberto(false)}>
                    {statusList.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          salvarCampo(
                            { status_id: s.id },
                            `mudou o status de "${statusAtual?.nome ?? "—"}" para "${s.nome}"`,
                            true,
                            "status"
                          );
                          setPost((p) => (p ? { ...p, status_id: s.id } : p));
                          setStatusAberto(false);
                        }}
                        className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl text-sm font-medium hover:bg-surface"
                      >
                        <span className={`h-2 w-2 rounded-full ${corDoStatus(s.cor).dot}`} />
                        {s.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <span className="block text-xs text-ink/50 mb-1">Cliente</span>
              <BuscaCliente
                clientes={clientes}
                valor={clienteSelecionado}
                onSelecionar={(c) => {
                  if (!c) return;
                  setClienteSelecionado(c);
                  salvarCampo({ cliente_id: c.id }, `mudou o cliente para ${c.nome}`);
                }}
              />
            </div>

            <div>
              <span className="block text-xs text-ink/50 mb-1">Responsáveis</span>
              <div className="relative">
                <button
                  onClick={() => setSeletorResponsavelAberto((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-black/10 pl-1 pr-3 py-1 hover:bg-surface"
                >
                  {responsaveis.length > 0 ? (
                    <AvatarStack pessoas={responsaveis} tamanho={26} />
                  ) : (
                    <span className="h-6 w-6 rounded-full bg-surface flex items-center justify-center text-ink/30 text-xs">+</span>
                  )}
                  <span className="text-xs text-ink/50">{responsaveis.length > 0 ? "Editar" : "Adicionar"}</span>
                </button>
                {seletorResponsavelAberto && (
                  <div
                    className="absolute z-20 mt-1 w-64 rounded-2xl bg-white border border-black/10 shadow-lg p-3"
                    onMouseLeave={() => setSeletorResponsavelAberto(false)}
                  >
                    <div className="grid grid-cols-5 gap-2.5">
                      {funcionariosComAcesso.map((f) => {
                        const marcado = responsaveis.some((r) => r.id === f.id);
                        return (
                          <button key={f.id} onClick={() => toggleResponsavel(f.id)} className="relative" title={f.nome}>
                            <Avatar nome={f.nome} fotoUrl={f.fotoUrl} tamanho={34} />
                            {marcado && (
                              <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-forest text-white text-[9px] flex items-center justify-center ring-2 ring-white">
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <span className="block text-xs text-ink/50 mb-1">Formato</span>
              <select
                value={formato}
                onChange={(e) => {
                  setFormato(e.target.value);
                  salvarCampo({ formato: e.target.value || null }, `mudou o formato para "${FORMATO_CONFIG[e.target.value] ?? "nenhum"}"`);
                }}
                className="input"
              >
                <option value="">Nenhum</option>
                {Object.entries(FORMATO_CONFIG).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs text-ink/50 mb-1">Objetivo</span>
              <select
                value={objetivo}
                onChange={(e) => {
                  setObjetivo(e.target.value);
                  salvarCampo({ objetivo: e.target.value || null }, `mudou o objetivo para "${OBJETIVO_CONFIG[e.target.value] ?? "nenhum"}"`);
                }}
                className="input"
              >
                <option value="">Nenhum</option>
                {Object.entries(OBJETIVO_CONFIG).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs text-ink/50 mb-1">Data de início</span>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  salvarCampo(
                    { data_inicio: e.target.value || null },
                    e.target.value ? `mudou a data de início para ${formatarDataCurta(e.target.value)}` : "removeu a data de início",
                    true,
                    "data_inicio"
                  );
                }}
                className="input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-xs text-ink/50 mb-1">Data de vencimento</span>
                <input
                  type="date"
                  value={dataPublicacao}
                  onChange={(e) => {
                    setDataPublicacao(e.target.value);
                    salvarCampo(
                      { data_publicacao: e.target.value || null },
                      e.target.value ? `mudou a data de publicação para ${formatarDataCurta(e.target.value)}` : "removeu a data de publicação",
                      true,
                      "data_publicacao"
                    );
                  }}
                  className="input"
                />
              </div>
              <div>
                <span className="block text-xs text-ink/50 mb-1">Hora</span>
                <input
                  type="time"
                  value={horaPublicacao}
                  onChange={(e) => {
                    setHoraPublicacao(e.target.value);
                    salvarCampo({ hora_publicacao: e.target.value || null }, "mudou o horário de publicação");
                  }}
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
            <span className="block text-sm font-bold text-ink mb-2">Descrição</span>
            <RichTextEditor
              valorHtml={observacoes}
              onChange={setObservacoes}
              onSalvar={() => {
                salvarCampo({ observacoes_internas: observacoes || null }, "atualizou as observações internas");
                notificarNovasMencoesObservacoes();
              }}
              placeholder="Anotações da equipe sobre esse conteúdo..."
              mencionaveis={funcionariosComAcesso.filter((f) => f.authUserId).map((f) => ({ id: f.authUserId!, nome: f.nome, fotoUrl: f.fotoUrl }))}
              referenciaveis={referenciaveis}
            />
          </div>

          <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="block text-sm font-bold text-ink">Mídia</span>
              {formato !== "video" && (
                <span className="text-xs text-ink/40">
                  {midias.length} {midias.length === 1 ? "arquivo" : "arquivos"}
                </span>
              )}
            </div>
            {formato === "video" ? (
              <label className="block">
                <span className="block text-xs text-ink/50 mb-1">Link do vídeo (Google Drive, etc.)</span>
                <div className="flex items-center gap-2">
                  <input
                    value={linkVideo}
                    onChange={(e) => setLinkVideo(e.target.value)}
                    onBlur={() => salvarCampo({ link_video: linkVideo.trim() || null }, "atualizou o link do vídeo")}
                    className="input"
                    placeholder="https://drive.google.com/..."
                  />
                  {linkVideo.trim() && (
                    <a
                      href={linkVideo.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir vídeo"
                      className="shrink-0 h-9 w-9 rounded-full bg-surface flex items-center justify-center text-ink/50 hover:text-forest hover:bg-mint transition-colors"
                    >
                      <ExternalLink size={15} />
                    </a>
                  )}
                </div>
                <span className="block text-xs text-ink/40 mt-1">
                  Vídeos não ficam hospedados aqui — deixa o arquivo no Drive e cola o link de acesso.
                </span>
              </label>
            ) : (
              <div>
                {!formato && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mb-2">
                    Escolhe o formato (Estático, Carrossel ou Vídeo) ali em cima antes de subir a arte.
                  </p>
                )}
                <input
                  ref={inputMidiaRef}
                  type="file"
                  accept={formato === "video" ? "image/*" : "image/*,video/*"}
                  multiple
                  onChange={(e) => adicionarMidias(e.target.files)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => inputMidiaRef.current?.click()}
                  disabled={enviandoMidia}
                  className="rounded-full border-2 border-ink/15 text-ink px-4 py-2 text-xs font-semibold hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {enviandoMidia ? "Enviando..." : midias.length === 0 ? "+ Adicionar arte" : "+ Adicionar mais artes"}
                </button>
                {midias.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {midias.map((m, i) => {
                      const ehVideo = m.arquivo_tipo?.startsWith("video/");
                      return (
                        <div key={m.id} className="relative group rounded-xl overflow-hidden bg-surface border border-black/5 aspect-square">
                          <button type="button" onClick={() => setIndiceMidiaAberta(i)} className="absolute inset-0 w-full h-full">
                            {ehVideo ? (
                              <video src={m.url} className="w-full h-full object-cover" muted />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.url} alt={m.arquivo_nome ?? "arte"} className="w-full h-full object-cover" />
                            )}
                          </button>
                          <span className="absolute top-1.5 left-1.5 h-5 w-5 rounded-full bg-ink/70 text-white text-[10px] font-bold flex items-center justify-center pointer-events-none">
                            {i + 1}
                          </span>
                          {ehVideo && (
                            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="h-8 w-8 rounded-full bg-black/50 flex items-center justify-center">▶</span>
                            </span>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => moverMidia(i, -1)}
                              disabled={i === 0}
                              className="h-7 w-7 rounded-full bg-white/90 text-ink text-xs flex items-center justify-center disabled:opacity-30"
                              title="Mover pra esquerda"
                            >
                              ←
                            </button>
                            <button
                              type="button"
                              onClick={() => setIndiceMidiaAberta(i)}
                              className="h-7 w-7 rounded-full bg-white/90 text-ink text-xs flex items-center justify-center"
                              title="Visualizar"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removerMidia(m.id)}
                              className="h-7 w-7 rounded-full bg-white/90 text-red-600 text-xs flex items-center justify-center"
                              title="Remover"
                            >
                              ✕
                            </button>
                            <button
                              type="button"
                              onClick={() => moverMidia(i, 1)}
                              disabled={i === midias.length - 1}
                              className="h-7 w-7 rounded-full bg-white/90 text-ink text-xs flex items-center justify-center disabled:opacity-30"
                              title="Mover pra direita"
                            >
                              →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <span className="block text-xs text-ink/40 mt-2">
                  {formato === "carrossel"
                    ? "Passa o mouse na arte pra reordenar (setinhas), visualizar ou remover — a ordem aqui é a ordem que aparece no carrossel. Aceita foto ou vídeo leve."
                    : "Pode adicionar quantas artes precisar — foto ou vídeo leve."}
                </span>
              </div>
            )}
          </div>

          <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
            <span className="block text-sm font-bold text-ink mb-2">Legenda</span>
            <textarea
              ref={legendaRef}
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              onBlur={() => {
                salvarCampo({ legenda: legenda || null }, "atualizou a legenda");
                ultimaLegendaSalvaRef.current = legenda;
              }}
              className="input resize-none overflow-hidden"
              rows={1}
              style={legendaRecolhida && legendaTransborda ? { maxHeight: ALTURA_COLAPSADA_LEGENDA, overflow: "hidden" } : undefined}
              placeholder="Texto que vai junto com o post — é isso que o cliente vê na aprovação..."
            />
            {legendaTransborda && (
              <button
                type="button"
                onClick={() => setLegendaRecolhida((v) => !v)}
                className="mt-1 text-xs font-semibold text-ink/50 hover:text-ink"
              >
                {legendaRecolhida ? "▼ Expandir" : "▲ Recolher"}
              </button>
            )}
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <span className="block text-sm font-bold text-ink mb-2">Sub-conteúdos</span>
            <p className="text-xs text-ink/40 mb-3">
              Use isso pra agrupar vários posts dentro de um "pacote" — por exemplo, um post "Conteúdo de Setembro" com um sub-conteúdo pra cada publicação do mês.
            </p>
            {subConteudos.length > 0 && (
              <div className="grid grid-cols-[1fr_110px_90px_110px] gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink/40">
                <span>Nome</span>
                <span>Responsáveis</span>
                <span>Data</span>
                <span>Status</span>
              </div>
            )}
            <div className="space-y-1.5 mb-2">
              <DndContext
                sensors={dndSensors}
                collisionDetection={closestCenter}
                onDragEnd={(e: DragEndEvent) => {
                  const { active, over } = e;
                  if (!over || active.id === over.id) return;
                  const indexAntigo = subConteudos.findIndex((s) => s.id === active.id);
                  const indexNovo = subConteudos.findIndex((s) => s.id === over.id);
                  if (indexAntigo === -1 || indexNovo === -1) return;
                  reordenarSubConteudo(indexAntigo, indexNovo);
                }}
              >
                <SortableContext items={subConteudos.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  {subConteudos.map((s) => (
                    <LinhaSubConteudoArrastavel key={s.id} id={s.id}>
                      <LinhaSubConteudoEditavel
                        sub={s}
                        statusList={statusList}
                        funcionariosComAcesso={funcionariosComAcesso}
                        responsaveis={responsaveisPorSub[s.id] ?? []}
                        onAbrir={() => router.push(`/conteudo/calendario/post/${s.id}`)}
                        onSalvarNome={(novoNome) => salvarCampoSub(s.id, { titulo: novoNome })}
                        onSalvarData={(novaData) => salvarCampoSub(s.id, { data_publicacao: novaData || null })}
                        onSalvarStatus={(novoStatusId) => salvarCampoSub(s.id, { status_id: novoStatusId })}
                        onToggleResponsavel={(funcionarioId) => toggleResponsavelSub(s.id, funcionarioId)}
                      />
                    </LinhaSubConteudoArrastavel>
                  ))}
                </SortableContext>
              </DndContext>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={novoSubConteudo}
                onChange={(e) => setNovoSubConteudo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    adicionarSubConteudo();
                  }
                }}
                className="input text-sm"
                placeholder="Nome do sub-conteúdo..."
              />
              <button
                onClick={adicionarSubConteudo}
                disabled={criandoSub}
                className="shrink-0 text-sm font-semibold text-forest hover:text-ink disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>

        {painelRecolhido ? (
          <button
            onClick={() => setPainelRecolhido(false)}
            className="w-12 shrink-0 border-l border-black/5 bg-white flex flex-col items-center pt-4 hover:bg-surface transition-colors"
            title="Mostrar comentários"
          >
            <span className="text-ink/40 text-lg">💬</span>
          </button>
        ) : (
          <div className="w-96 shrink-0 border-l border-black/5 flex flex-col bg-white">
            <div className="px-5 py-4 border-b border-black/5 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setAbaLateral("comentarios")}
                  className={`text-sm font-bold ${abaLateral === "comentarios" ? "text-ink" : "text-ink/40"}`}
                >
                  Comentários
                </button>
                <button
                  onClick={() => setAbaLateral("historico")}
                  className={`text-sm font-bold ${abaLateral === "historico" ? "text-ink" : "text-ink/40"}`}
                >
                  Histórico
                </button>
                <button
                  onClick={() => setAbaLateral("horas")}
                  className={`text-sm font-bold ${abaLateral === "horas" ? "text-ink" : "text-ink/40"}`}
                >
                  Horas
                </button>
              </div>
              <button onClick={() => setPainelRecolhido(true)} className="text-ink/30 hover:text-ink text-sm" title="Recolher">
                ▶
              </button>
            </div>

            {abaLateral === "comentarios" ? (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {comentarios.length === 0 ? (
                    <p className="text-sm text-ink/40">Nenhum comentário ainda.</p>
                  ) : (
                    comentarios.map((c) => {
                      const nome = c.doCliente ? "Cliente" : nomeDoAutor(c.autor_id!);
                      const fotoAutor = c.doCliente ? null : funcionariosComAcesso.find((f) => f.authUserId === c.autor_id)?.fotoUrl ?? null;
                      return (
                        <div key={c.id} className="flex items-start gap-2.5">
                          {c.doCliente ? (
                            <div className="h-[30px] w-[30px] rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0 ring-2 ring-white">
                              👤
                            </div>
                          ) : (
                            <Avatar nome={nome} fotoUrl={fotoAutor} tamanho={30} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className={`text-sm font-bold ${c.doCliente ? "text-amber-700" : "text-ink"}`}>{nome}</span>
                              <span className="text-[11px] text-ink/40">{formatarQuando(c.created_at)}</span>
                            </div>
                            <p className="text-sm text-ink whitespace-pre-wrap break-words">{renderizarTexto(c.texto, todosOsNomes)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="p-4 border-t border-black/5 shrink-0 relative">
                  <div className="relative">
                    <div
                      aria-hidden
                      className="text-sm whitespace-pre-wrap break-words pointer-events-none absolute inset-0 overflow-hidden rounded-xl z-10"
                      style={{ padding: "0.55rem 0.9rem", color: "var(--ec-ink)" }}
                    >
                      {comMencoesColoridas(novoComentario, colegas)}
                      {novoComentario.endsWith("\n") ? "\u200b" : ""}
                    </div>
                    <textarea
                      ref={comentarioRef}
                      value={novoComentario}
                      onChange={(e) => {
                        const valor = e.target.value;
                        setNovoComentario(valor);
                        const pos = e.target.selectionStart ?? valor.length;
                        const antes = valor.slice(0, pos);
                        const match = antes.match(/@([a-zA-ZÀ-ÿ]*)$/);
                        setMencaoBusca(match ? match[1] : null);
                        setIndiceMencaoComentario(0);
                      }}
                      onKeyDown={(e) => {
                        if (mencaoBusca !== null && colegasParaMencao.length > 0) {
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setIndiceMencaoComentario((i) => Math.min(i + 1, colegasParaMencao.length - 1));
                            return;
                          }
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setIndiceMencaoComentario((i) => Math.max(i - 1, 0));
                            return;
                          }
                          if (e.key === "Enter") {
                            e.preventDefault();
                            selecionarMencao(colegasParaMencao[indiceMencaoComentario].nome);
                            return;
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setMencaoBusca(null);
                            return;
                          }
                        }
                        if (e.key === "Enter" && !e.shiftKey && mencaoBusca === null) {
                          e.preventDefault();
                          enviarComentario();
                        }
                      }}
                      rows={2}
                      placeholder="Escreva um comentário... (@ pra mencionar)"
                      className="input resize-none w-full text-sm relative bg-transparent"
                      style={{ color: "transparent", caretColor: "var(--ec-ink)" }}
                    />
                  </div>
                  {mencaoBusca !== null && colegasParaMencao.length > 0 && (
                    <div className="absolute z-20 bottom-20 left-4 right-4 rounded-2xl bg-white border border-black/10 shadow-lg py-1 max-h-48 overflow-y-auto">
                      {colegasParaMencao.map((c, i) => (
                        <button
                          key={c.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setIndiceMencaoComentario(i)}
                          onClick={() => selecionarMencao(c.nome)}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors ${
                            i === indiceMencaoComentario ? "bg-surface" : "hover:bg-surface/60"
                          }`}
                        >
                          <Avatar nome={c.nome} fotoUrl={c.fotoUrl} tamanho={26} />
                          <span className="font-semibold text-ink">{c.nome}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={enviarComentario}
                    disabled={enviandoComentario || !novoComentario.trim()}
                    className="mt-2 rounded-full bg-ink text-white px-4 py-2 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
                  >
                    Comentar
                  </button>
                </div>
              </>
            ) : abaLateral === "historico" ? (
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {historico.length === 0 ? (
                  <p className="text-sm text-ink/40">Nenhuma alteração registrada ainda.</p>
                ) : (
                  historico.map((h) => (
                    <div key={h.id} className="flex gap-2.5 text-xs text-ink/60 py-1.5">
                      <span className="h-6 w-6 rounded-full bg-surface text-ink/40 flex items-center justify-center shrink-0 mt-0.5">
                        {iconeHistorico(h.descricao)}
                      </span>
                      <div className="min-w-0">
                        <p>
                          <span className="font-semibold text-ink">{h.autor_id ? nomeDoAutor(h.autor_id) : "Alguém"}</span>{" "}
                          {comValoresDestacados(h.descricao)}
                        </p>
                        <span className="block text-[10px] text-ink/40 mt-0.5">{formatarQuando(h.created_at)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-3">Tempo dedicado, por pessoa</p>
                {(() => {
                  const porHistorico = segundosPorPessoaDoHistorico(historico);
                  const idsComRodando = new Set(sessoesTempo.filter((s) => s.iniciado_em).map((s) => s.funcionario_auth_id));
                  const todosOsIds = new Set([...porHistorico.keys(), ...idsComRodando]);
                  const linhas = Array.from(todosOsIds).map((autorId) => ({
                    autorId,
                    nome: nomeDoAutor(autorId),
                    segundosAcumulados: porHistorico.get(autorId) ?? 0,
                    rodandoDesde: sessoesTempo.find((s) => s.funcionario_auth_id === autorId)?.iniciado_em ?? null,
                  }));
                  if (linhas.length === 0) {
                    return <p className="text-sm text-ink/40">Ninguém registrou tempo nesse conteúdo ainda.</p>;
                  }
                  return (
                    <div className="space-y-3">
                      {linhas
                        .sort((a, b) => b.segundosAcumulados - a.segundosAcumulados)
                        .map((s) => (
                          <div key={s.autorId} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5 text-ink/80 truncate">
                              {s.rodandoDesde && (
                                <span className="relative flex h-1.5 w-1.5 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                                </span>
                              )}
                              {s.nome}
                            </span>
                            <span className="font-semibold text-ink shrink-0 ml-2">{formatarDuracao(s.segundosAcumulados)}</span>
                          </div>
                        ))}
                      <div className="flex items-center justify-between text-sm pt-3 border-t border-black/5">
                        <span className="font-bold text-ink">Total</span>
                        <span className="font-bold text-ink">{formatarDuracao(post.tempo_total_segundos)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {indiceMidiaAberta !== null && midias[indiceMidiaAberta] && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6"
          onClick={() => setIndiceMidiaAberta(null)}
        >
          <button
            onClick={() => setIndiceMidiaAberta(null)}
            title="Fechar"
            className="absolute top-5 right-5 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>

          {midias.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIndiceMidiaAberta((i) => (i! > 0 ? i! - 1 : midias.length - 1));
              }}
              title="Anterior"
              className="absolute left-4 sm:left-8 h-11 w-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors shrink-0"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {midias[indiceMidiaAberta].arquivo_tipo?.startsWith("video/") ? (
              <video src={midias[indiceMidiaAberta].url} className="max-w-full max-h-[75vh] rounded-xl shadow-2xl" controls autoPlay />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={midias[indiceMidiaAberta].url}
                alt={midias[indiceMidiaAberta].arquivo_nome ?? "arte"}
                className="max-w-full max-h-[75vh] rounded-xl object-contain shadow-2xl"
              />
            )}
            <div className="flex items-center gap-4 text-white/70 text-sm">
              <span>{midias[indiceMidiaAberta].arquivo_nome}</span>
              <span className="text-white/30">
                {indiceMidiaAberta + 1} / {midias.length}
              </span>
              <button
                onClick={() => baixarArquivo(midias[indiceMidiaAberta].url, midias[indiceMidiaAberta].arquivo_nome ?? "arquivo")}
                title="Baixar"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20 transition-colors"
              >
                <Download size={14} /> Baixar
              </button>
            </div>
          </div>

          {midias.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIndiceMidiaAberta((i) => (i! < midias.length - 1 ? i! + 1 : 0));
              }}
              title="Próxima"
              className="absolute right-4 sm:right-8 h-11 w-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors shrink-0"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>
      )}
    </main>
  );
}

function LinhaSubConteudoArrastavel({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1.5">
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 h-6 w-4 flex items-center justify-center text-ink/25 hover:text-ink/60 cursor-grab active:cursor-grabbing touch-none"
        title="Arrastar pra reordenar"
      >
        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
          <circle cx="2.5" cy="2.5" r="1.5" />
          <circle cx="7.5" cy="2.5" r="1.5" />
          <circle cx="2.5" cy="8" r="1.5" />
          <circle cx="7.5" cy="8" r="1.5" />
          <circle cx="2.5" cy="13.5" r="1.5" />
          <circle cx="7.5" cy="13.5" r="1.5" />
        </svg>
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function LinhaSubConteudoEditavel({
  sub,
  statusList,
  funcionariosComAcesso,
  responsaveis,
  onAbrir,
  onSalvarNome,
  onSalvarData,
  onSalvarStatus,
  onToggleResponsavel,
}: {
  sub: SubConteudo;
  statusList: StatusItem[];
  funcionariosComAcesso: Responsavel[];
  responsaveis: Responsavel[];
  onAbrir: () => void;
  onSalvarNome: (v: string) => void;
  onSalvarData: (v: string) => void;
  onSalvarStatus: (v: string) => void;
  onToggleResponsavel: (funcionarioId: string) => void;
}) {
  const [campoEditando, setCampoEditando] = useState<null | "nome" | "responsavel" | "data" | "status">(null);
  const [nomeTemp, setNomeTemp] = useState(sub.titulo ?? "");
  const statusSub = statusList.find((st) => st.id === sub.status_id);

  return (
    <div
      onClick={() => campoEditando === null && onAbrir()}
      className="group/row w-full grid grid-cols-[1fr_110px_90px_110px] items-center gap-2 rounded-xl bg-surface px-3 py-2.5 hover:bg-surface/70 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`h-2 w-2 rounded-full shrink-0 ${corDoStatus(statusSub?.cor ?? "cinza").dot}`} />
        {campoEditando === "nome" ? (
          <input
            autoFocus
            value={nomeTemp}
            onChange={(e) => setNomeTemp(e.target.value)}
            onBlur={() => {
              if (nomeTemp.trim()) onSalvarNome(nomeTemp.trim());
              setCampoEditando(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setCampoEditando(null);
            }}
            onClick={(e) => e.stopPropagation()}
            className="input py-1 text-sm flex-1"
          />
        ) : (
          <>
            <span className="text-sm text-ink truncate flex-1">{sub.titulo || "Sem título"}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCampoEditando("nome");
              }}
              className="opacity-0 group-hover/row:opacity-100 text-ink/30 hover:text-ink text-xs shrink-0"
              title="Editar nome"
            >
              ✏️
            </button>
          </>
        )}
      </div>

      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {campoEditando === "responsavel" ? (
          <div
            className="absolute z-30 top-0 left-0 w-56 rounded-2xl bg-white border border-black/10 shadow-lg p-2.5"
            onMouseLeave={() => setCampoEditando(null)}
          >
            <div className="grid grid-cols-5 gap-2">
              {funcionariosComAcesso.map((f) => {
                const marcado = responsaveis.some((r) => r.id === f.id);
                return (
                  <button key={f.id} onClick={() => onToggleResponsavel(f.id)} className="relative" title={f.nome}>
                    <Avatar nome={f.nome} fotoUrl={f.fotoUrl} tamanho={26} />
                    {marcado && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-forest text-white text-[8px] flex items-center justify-center ring-2 ring-white">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <button onClick={() => setCampoEditando("responsavel")} className="flex items-center gap-1">
            {responsaveis.length > 0 ? <AvatarStack pessoas={responsaveis} tamanho={20} /> : <span className="text-xs text-ink/30">—</span>}
            <span className="opacity-0 group-hover/row:opacity-100 text-ink/30 hover:text-ink text-xs">✏️</span>
          </button>
        )}
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        {campoEditando === "data" ? (
          <input
            autoFocus
            type="date"
            defaultValue={sub.data_publicacao}
            onBlur={(e) => {
              onSalvarData(e.target.value);
              setCampoEditando(null);
            }}
            className="input py-1 text-xs"
          />
        ) : (
          <button onClick={() => setCampoEditando("data")} className="flex items-center gap-1">
            <span className="text-xs text-ink/50">{formatarDataCurta(sub.data_publicacao)}</span>
            <span className="opacity-0 group-hover/row:opacity-100 text-ink/30 hover:text-ink text-xs">✏️</span>
          </button>
        )}
      </div>

      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {campoEditando === "status" ? (
          <div
            className="absolute z-30 top-0 left-0 w-48 rounded-2xl bg-white border border-black/10 shadow-lg p-1.5"
            onMouseLeave={() => setCampoEditando(null)}
          >
            {statusList.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  onSalvarStatus(s.id);
                  setCampoEditando(null);
                }}
                className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl text-sm font-medium hover:bg-surface"
              >
                <span className={`h-2 w-2 rounded-full ${corDoStatus(s.cor).dot}`} />
                {s.nome}
              </button>
            ))}
          </div>
        ) : (
          <button onClick={() => setCampoEditando("status")} className="flex items-center gap-1">
            <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 w-fit ${corDoStatus(statusSub?.cor ?? "cinza").cor}`}>
              {statusSub?.nome ?? "—"}
            </span>
            <span className="opacity-0 group-hover/row:opacity-100 text-ink/30 hover:text-ink text-xs">✏️</span>
          </button>
        )}
      </div>
    </div>
  );
}
