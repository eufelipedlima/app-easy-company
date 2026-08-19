"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { corDoStatus } from "@/lib/status-conteudo";
import { IconeProjeto } from "@/components/icones-tarefa";
import { normalizar } from "@/lib/normalizar";
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CalendarioConteudoConteudo, type CalendarioConteudoHandle } from "@/app/(dashboard)/conteudo/calendario/page";
import { Archive, LayoutGrid, CheckSquare, FileText, MessageCircle, FolderOpen, Link2 } from "lucide-react";

interface Responsavel {
  id: string;
  nome: string;
  fotoUrl: string | null;
  authUserId?: string | null;
}

interface AtividadeItem {
  id: string;
  autor_id: string | null;
  descricao: string;
  created_at: string;
  itemTitulo: string;
  link: string;
  tipo: "tarefa" | "conteudo";
}

interface TarefaResumo {
  id: string;
  titulo: string;
  status_id: string;
  prazo: string | null;
  descricao: string | null;
  eh_projeto: boolean;
  statusNome: string;
  statusCor: string;
}

interface PostResumo {
  id: string;
  titulo: string | null;
  data_publicacao: string;
  status_id: string;
  post_pai_id: string | null;
  observacoes_internas: string | null;
  statusNome: string;
  statusCor: string;
}

interface DocResumo {
  id: string;
  titulo: string;
  emoji: string | null;
  conteudo: string | null;
  criado_por: string | null;
  categoria_id: string | null;
  created_at: string;
  updated_at: string;
  qtdFilhos: number;
}

interface MensagemChat {
  id: string;
  autor_id: string;
  texto: string;
  created_at: string;
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
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}
function Avatar({ nome, fotoUrl, tamanho = 22 }: { nome: string; fotoUrl?: string | null; tamanho?: number }) {
  if (fotoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={fotoUrl} alt={nome} className="rounded-full object-cover shrink-0 ring-2 ring-white" style={{ height: tamanho, width: tamanho }} />;
  }
  return (
    <div
      className={`rounded-full ${corAvatar(nome)} text-white flex items-center justify-center font-bold shrink-0 ring-2 ring-white`}
      style={{ height: tamanho, width: tamanho, fontSize: Math.max(8, tamanho * 0.36) }}
    >
      {iniciais(nome)}
    </div>
  );
}
function AvatarStack({ pessoas, tamanho = 20 }: { pessoas: Responsavel[]; tamanho?: number }) {
  if (pessoas.length === 0) return <span className="text-xs text-ink/30">—</span>;
  const visiveis = pessoas.slice(0, 3);
  const resto = pessoas.length - visiveis.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {visiveis.map((p) => (
        <Avatar key={p.id} nome={p.nome} fotoUrl={p.fotoUrl} tamanho={tamanho} />
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
function formatarQuandoRelativo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function formatarData(iso: string | null) {
  if (!iso) return "Sem data";
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function formatarHoraMsg(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

type Aba = "geral" | "tarefas" | "conteudo" | "chat" | "docs";

export default function CentralClienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [nomeCliente, setNomeCliente] = useState("");
  const [pessoaIdCliente, setPessoaIdCliente] = useState<string | null>(null);
  const [fotoCliente, setFotoCliente] = useState<string | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const inputFotoRef = useRef<HTMLInputElement>(null);
  const calendarioRef = useRef<CalendarioConteudoHandle>(null);
  const [aba, setAba] = useState<Aba>("geral");
  const [souAdmin, setSouAdmin] = useState(false);
  const [confirmandoArquivar, setConfirmandoArquivar] = useState(false);
  const [loading, setLoading] = useState(true);

  const [tarefas, setTarefas] = useState<TarefaResumo[]>([]);
  const [progressoTarefas, setProgressoTarefas] = useState<Record<string, { total: number; completos: number }>>({});
  const [responsaveisPorTarefa, setResponsaveisPorTarefa] = useState<Record<string, Responsavel[]>>({});
  const [visualizacaoTarefas, setVisualizacaoTarefas] = useState<"lista" | "kanban">("kanban");
  const [filtroStatusAtivo, setFiltroStatusAtivo] = useState<string | null>(null);
  const [atividadeRecente, setAtividadeRecente] = useState<AtividadeItem[]>([]);
  const [posts, setPosts] = useState<PostResumo[]>([]);
  const [progressoPosts, setProgressoPosts] = useState<Record<string, { total: number; completos: number }>>({});
  const [responsaveisPorPost, setResponsaveisPorPost] = useState<Record<string, Responsavel[]>>({});
  const [visualizacaoConteudo, setVisualizacaoConteudo] = useState<"lista" | "kanban" | "calendario">("kanban");
  const [mostrarSubconteudos, setMostrarSubconteudos] = useState(false);
  const [docs, setDocs] = useState<DocResumo[]>([]);
  const [categoriasDocs, setCategoriasDocs] = useState<{ id: string; nome: string; cor: string }[]>([]);
  const [nomesPorAutor, setNomesPorAutor] = useState<Record<string, string>>({});
  const [statusList, setStatusList] = useState<{ id: string; nome: string; cor: string; ordem: number }[]>([]);

  const [canalChatId, setCanalChatId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [meuId, setMeuId] = useState<string | null>(null);
  const [meuNome, setMeuNome] = useState("Você");
  const chatFimRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [{ data: clienteData }, { data: tarefasData }, { data: postsData }, { data: docsData }, { data: canalData }, { data: funcData }, { data: statusData }] =
      await Promise.all([
        supabase.from("clientes").select("papeis ( pessoa_id, pessoas ( nome, foto_url ) )").eq("id", id).maybeSingle(),
        supabase
          .from("tarefas")
          .select("id, titulo, status_id, prazo, descricao, eh_projeto, status_conteudo ( nome, cor )")
          .eq("cliente_id", id)
          .is("tarefa_pai_id", null)
          .eq("arquivada", false)
          .is("excluido_em", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("posts_conteudo")
          .select("id, titulo, data_publicacao, status_id, post_pai_id, observacoes_internas, status_conteudo ( nome, cor )")
          .eq("cliente_id", id)
          .eq("arquivado", false)
          .is("excluido_em", null)
          .order("data_publicacao", { ascending: false })
          .limit(60),
        supabase
          .from("docs")
          .select("id, titulo, emoji, conteudo, criado_por, categoria_id, created_at, updated_at, doc_pai_id")
          .eq("cliente_id", id)
          .is("excluido_em", null)
          .order("updated_at", { ascending: false }),
        supabase.from("chat_canais").select("id").eq("tipo", "cliente").eq("cliente_id", id).maybeSingle(),
        supabase.from("funcionarios").select("id, auth_user_id, papeis ( pessoas ( nome, apelido, foto_url ) )").not("auth_user_id", "is", null),
        supabase.from("status_conteudo").select("id, nome, cor, ordem").order("ordem"),
      ]);
    setStatusList(statusData ?? []);

    const clienteInfo = clienteData as unknown as {
      papeis: { pessoa_id: string; pessoas: { nome: string; foto_url: string | null } | null } | null;
    } | null;
    const nomeC = clienteInfo?.papeis?.pessoas?.nome ?? "—";
    setPessoaIdCliente(clienteInfo?.papeis?.pessoa_id ?? null);
    setFotoCliente(clienteInfo?.papeis?.pessoas?.foto_url ?? null);
    setNomeCliente(nomeC);
    if (user) {
      setMeuId(user.id);
      const eu = ((funcData ?? []) as unknown as { auth_user_id: string; papeis: { pessoas: { nome: string; apelido: string | null } | null } | null }[]).find(
        (f) => f.auth_user_id === user.id
      );
      setMeuNome(eu?.papeis?.pessoas?.apelido || eu?.papeis?.pessoas?.nome || "Você");
    }

    const mapaNomes: Record<string, string> = {};
    const listaFunc = ((funcData ?? []) as unknown as {
      id: string;
      auth_user_id: string | null;
      papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null;
    }[]).map((f) => {
      const nome = f.papeis?.pessoas?.apelido || f.papeis?.pessoas?.nome || "Colega";
      if (f.auth_user_id) mapaNomes[f.auth_user_id] = nome;
      return { id: f.id, nome, fotoUrl: f.papeis?.pessoas?.foto_url ?? null, authUserId: f.auth_user_id };
    });
    setNomesPorAutor(mapaNomes);

    const listaTarefas = ((tarefasData ?? []) as unknown as {
      id: string;
      titulo: string;
      status_id: string;
      prazo: string | null;
      descricao: string | null;
      eh_projeto: boolean;
      status_conteudo: { nome: string; cor: string } | null;
    }[]).map((t) => ({
      id: t.id,
      titulo: t.titulo,
      status_id: t.status_id,
      prazo: t.prazo,
      descricao: t.descricao,
      eh_projeto: t.eh_projeto,
      statusNome: t.status_conteudo?.nome ?? "—",
      statusCor: t.status_conteudo?.cor ?? "cinza",
    }));
    setTarefas(listaTarefas);

    const listaPosts = ((postsData ?? []) as unknown as {
      id: string;
      titulo: string | null;
      data_publicacao: string;
      status_id: string;
      post_pai_id: string | null;
      observacoes_internas: string | null;
      status_conteudo: { nome: string; cor: string } | null;
    }[]).map((p) => ({
      id: p.id,
      titulo: p.titulo,
      data_publicacao: p.data_publicacao,
      status_id: p.status_id,
      post_pai_id: p.post_pai_id,
      observacoes_internas: p.observacoes_internas,
      statusNome: p.status_conteudo?.nome ?? "—",
      statusCor: p.status_conteudo?.cor ?? "cinza",
    }));
    setPosts(listaPosts);

    const progressoPostsMap: Record<string, { total: number; completos: number }> = {};
    for (const p of listaPosts) {
      if (!p.post_pai_id) continue;
      if (!progressoPostsMap[p.post_pai_id]) progressoPostsMap[p.post_pai_id] = { total: 0, completos: 0 };
      progressoPostsMap[p.post_pai_id].total++;
      if (normalizar(p.statusCor) === "verde") progressoPostsMap[p.post_pai_id].completos++;
    }
    setProgressoPosts(progressoPostsMap);

    const idsTarefasProjeto = listaTarefas.filter((t) => t.eh_projeto).map((t) => t.id);
    if (idsTarefasProjeto.length > 0) {
      const { data: subtarefasData } = await supabase
        .from("tarefas")
        .select("tarefa_pai_id, status_id, eh_pasta")
        .in("tarefa_pai_id", idsTarefasProjeto)
        .is("excluido_em", null);
      const progressoTarefasMap: Record<string, { total: number; completos: number }> = {};
      for (const s of (subtarefasData ?? []) as { tarefa_pai_id: string; status_id: string; eh_pasta: boolean }[]) {
        if (s.eh_pasta) continue;
        if (!progressoTarefasMap[s.tarefa_pai_id]) progressoTarefasMap[s.tarefa_pai_id] = { total: 0, completos: 0 };
        progressoTarefasMap[s.tarefa_pai_id].total++;
        const st = (statusData ?? []).find((st) => st.id === s.status_id);
        if (st && normalizar(st.cor) === "verde") progressoTarefasMap[s.tarefa_pai_id].completos++;
      }
      setProgressoTarefas(progressoTarefasMap);
    } else {
      setProgressoTarefas({});
    }

    const contFilhosDocs: Record<string, number> = {};
    for (const d of (docsData ?? []) as { doc_pai_id: string | null }[]) {
      if (d.doc_pai_id) contFilhosDocs[d.doc_pai_id] = (contFilhosDocs[d.doc_pai_id] ?? 0) + 1;
    }
    setDocs(
      ((docsData ?? []) as {
        id: string;
        titulo: string;
        emoji: string | null;
        conteudo: string | null;
        criado_por: string | null;
        categoria_id: string | null;
        created_at: string;
        updated_at: string;
        doc_pai_id: string | null;
      }[])
        .filter((d) => !d.doc_pai_id)
        .map((d) => ({ ...d, qtdFilhos: contFilhosDocs[d.id] ?? 0 }))
    );

    const ids = [...listaTarefas.map((t) => t.id), ...listaPosts.map((p) => p.id)];

    if (listaTarefas.length > 0 || listaPosts.length > 0) {
      const [{ data: histTarefas }, { data: histPosts }] = await Promise.all([
        listaTarefas.length > 0
          ? supabase
              .from("tarefas_historico")
              .select("id, autor_id, descricao, created_at, tarefa_id")
              .in("tarefa_id", listaTarefas.map((t) => t.id))
              .order("created_at", { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [] }),
        listaPosts.length > 0
          ? supabase
              .from("posts_conteudo_historico")
              .select("id, autor_id, descricao, created_at, post_id")
              .in("post_id", listaPosts.map((p) => p.id))
              .order("created_at", { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [] }),
      ]);
      const mapaTituloTarefa = new Map(listaTarefas.map((t) => [t.id, t.titulo]));
      const mapaTituloPost = new Map(listaPosts.map((p) => [p.id, p.titulo || "Sem título"]));
      const atividade: AtividadeItem[] = [
        ...((histTarefas ?? []) as { id: string; autor_id: string | null; descricao: string; created_at: string; tarefa_id: string }[]).map((h) => ({
          id: h.id,
          autor_id: h.autor_id,
          descricao: h.descricao,
          created_at: h.created_at,
          itemTitulo: mapaTituloTarefa.get(h.tarefa_id) ?? "Tarefa",
          link: `/tarefas/${h.tarefa_id}`,
          tipo: "tarefa" as const,
        })),
        ...((histPosts ?? []) as { id: string; autor_id: string | null; descricao: string; created_at: string; post_id: string }[]).map((h) => ({
          id: h.id,
          autor_id: h.autor_id,
          descricao: h.descricao,
          created_at: h.created_at,
          itemTitulo: mapaTituloPost.get(h.post_id) ?? "Conteúdo",
          link: `/conteudo/calendario/post/${h.post_id}`,
          tipo: "conteudo" as const,
        })),
      ]
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, 8);
      setAtividadeRecente(atividade);
    } else {
      setAtividadeRecente([]);
    }

    if (ids.length > 0) {
      const [{ data: respTarefas }, { data: respPosts }] = await Promise.all([
        supabase
          .from("tarefas_responsaveis")
          .select("tarefa_id, funcionarios ( id, papeis ( pessoas ( nome, apelido, foto_url ) ) )")
          .in("tarefa_id", listaTarefas.map((t) => t.id)),
        supabase
          .from("posts_conteudo_responsaveis")
          .select("post_id, funcionarios ( id, papeis ( pessoas ( nome, apelido, foto_url ) ) )")
          .in("post_id", listaPosts.map((p) => p.id)),
      ]);
      const mapaT: Record<string, Responsavel[]> = {};
      for (const r of (respTarefas ?? []) as unknown as {
        tarefa_id: string;
        funcionarios: { id: string; papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null } | null;
      }[]) {
        if (!r.funcionarios) continue;
        const pessoa = r.funcionarios.papeis?.pessoas;
        if (!mapaT[r.tarefa_id]) mapaT[r.tarefa_id] = [];
        mapaT[r.tarefa_id].push({ id: r.funcionarios.id, nome: pessoa?.apelido || pessoa?.nome || "Colega", fotoUrl: pessoa?.foto_url ?? null });
      }
      setResponsaveisPorTarefa(mapaT);

      const mapaP: Record<string, Responsavel[]> = {};
      for (const r of (respPosts ?? []) as unknown as {
        post_id: string;
        funcionarios: { id: string; papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null } | null;
      }[]) {
        if (!r.funcionarios) continue;
        const pessoa = r.funcionarios.papeis?.pessoas;
        if (!mapaP[r.post_id]) mapaP[r.post_id] = [];
        mapaP[r.post_id].push({ id: r.funcionarios.id, nome: pessoa?.apelido || pessoa?.nome || "Colega", fotoUrl: pessoa?.foto_url ?? null });
      }
      setResponsaveisPorPost(mapaP);
    }

    const canalId = (canalData as { id: string } | null)?.id ?? null;
    setCanalChatId(canalId);
    if (canalId) {
      const { data: msgs } = await supabase
        .from("chat_mensagens")
        .select("id, autor_id, texto, created_at")
        .eq("canal_id", canalId)
        .order("created_at", { ascending: true })
        .limit(50);
      setMensagens(msgs ?? []);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    async function carregarCategoriasDocs() {
      const supabase = createClient();
      const { data } = await supabase.from("doc_categorias").select("id, nome, cor").order("nome");
      setCategoriasDocs(data ?? []);
    }
    carregarCategoriasDocs();
  }, []);

  useEffect(() => {
    async function carregarPermissao() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: perfilData } = await supabase
        .from("funcionarios")
        .select("perfis_acesso ( nome )")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      const nomePerfil = (perfilData as unknown as { perfis_acesso: { nome: string } | null } | null)?.perfis_acesso?.nome;
      setSouAdmin(nomePerfil === "Administrador");
    }
    carregarPermissao();
  }, []);

  async function arquivarCentral() {
    const supabase = createClient();
    await supabase.from("clientes").update({ ativo_central_clientes: false }).eq("id", id);
    router.push("/central-clientes");
  }

  useEffect(() => {
    if (aba === "chat") chatFimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, aba]);

  useEffect(() => {
    if (!canalChatId) return;
    const supabase = createClient();
    const canalRealtime = supabase
      .channel(`central-cliente-chat-${canalChatId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_mensagens", filter: `canal_id=eq.${canalChatId}` }, (payload) => {
        setMensagens((atual) => [...atual, payload.new as MensagemChat]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canalRealtime);
    };
  }, [canalChatId]);

  async function enviarFotoCliente(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo || !pessoaIdCliente) return;
    setEnviandoFoto(true);
    const supabase = createClient();
    const extensao = arquivo.name.split(".").pop();
    const caminho = `cliente-${pessoaIdCliente}-${Date.now()}.${extensao}`;
    const { error } = await supabase.storage.from("perfis").upload(caminho, arquivo, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("perfis").getPublicUrl(caminho);
      await supabase.from("pessoas").update({ foto_url: data.publicUrl }).eq("id", pessoaIdCliente);
      setFotoCliente(data.publicUrl);
    }
    setEnviandoFoto(false);
  }

  async function moverTarefaStatus(tarefaId: string, novoStatusId: string) {
    setTarefas((atual) => atual.map((t) => (t.id === tarefaId ? { ...t, status_id: novoStatusId } : t)));
    const supabase = createClient();
    await supabase.from("tarefas").update({ status_id: novoStatusId }).eq("id", tarefaId);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const nomeStatus = statusList.find((s) => s.id === novoStatusId)?.nome ?? "outro status";
    if (user) await supabase.from("tarefas_historico").insert({ tarefa_id: tarefaId, autor_id: user.id, descricao: `mudou o status para "${nomeStatus}"` });
  }

  async function moverPostStatus(postId: string, novoStatusId: string) {
    setPosts((atual) => atual.map((p) => (p.id === postId ? { ...p, status_id: novoStatusId } : p)));
    const supabase = createClient();
    await supabase.from("posts_conteudo").update({ status_id: novoStatusId }).eq("id", postId);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const nomeStatus = statusList.find((s) => s.id === novoStatusId)?.nome ?? "outro status";
    if (user) await supabase.from("posts_conteudo_historico").insert({ post_id: postId, autor_id: user.id, descricao: `mudou o status para "${nomeStatus}"` });
  }

  async function criarCanalCliente() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: novoCanal } = await supabase
      .from("chat_canais")
      .insert({ tipo: "cliente", cliente_id: id, criado_por: user.id })
      .select("id")
      .single();
    if (novoCanal) {
      await supabase.from("chat_participantes").insert({ canal_id: novoCanal.id, auth_user_id: user.id });
      setCanalChatId(novoCanal.id);
    }
  }

  async function enviarMensagem() {
    if (!novaMensagem.trim() || !canalChatId || !meuId) return;
    const texto = novaMensagem.trim();
    setNovaMensagem("");
    const supabase = createClient();
    await supabase.from("chat_mensagens").insert({ canal_id: canalChatId, autor_id: meuId, texto });
  }

  async function novaTarefaRapida() {
    const tituloNovo = window.prompt("Nome da tarefa:");
    if (!tituloNovo || !tituloNovo.trim()) return;
    const supabase = createClient();
    const { data: statusList } = await supabase.from("status_conteudo").select("id").order("ordem").limit(1);
    const { data: nova } = await supabase
      .from("tarefas")
      .insert({ titulo: tituloNovo.trim(), cliente_id: id, status_id: statusList?.[0]?.id })
      .select("id")
      .single();
    if (nova) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await supabase.from("tarefas_historico").insert({ tarefa_id: nova.id, autor_id: user.id, descricao: "criou a tarefa" });
      router.push(`/tarefas/${nova.id}`);
    }
  }

  async function novoPostRapido() {
    const tituloNovo = window.prompt("Nome do conteúdo:");
    if (!tituloNovo || !tituloNovo.trim()) return;
    const supabase = createClient();
    const { data: statusList } = await supabase.from("status_conteudo").select("id").order("ordem").limit(1);
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: novo } = await supabase
      .from("posts_conteudo")
      .insert({ titulo: tituloNovo.trim(), cliente_id: id, data_publicacao: hoje, status_id: statusList?.[0]?.id })
      .select("id")
      .single();
    if (novo) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await supabase.from("posts_conteudo_historico").insert({ post_id: novo.id, autor_id: user.id, descricao: "criou o conteúdo" });
      router.push(`/conteudo/calendario/post/${novo.id}`);
    }
  }

  async function novoDocRapido() {
    const tituloNovo = window.prompt("Nome do documento:");
    if (!tituloNovo || !tituloNovo.trim()) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: novo } = await supabase
      .from("docs")
      .insert({ titulo: tituloNovo.trim(), cliente_id: id, criado_por: user?.id ?? null, atualizado_por: user?.id ?? null })
      .select("id")
      .single();
    if (novo) router.push(`/docs/${novo.id}`);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-ink/50">Carregando...</p>
      </main>
    );
  }

  const hojeISO = new Date().toISOString().slice(0, 10);
  const tarefasConcluidas = tarefas.filter((t) => normalizar(t.statusCor) === "verde");
  const tarefasAbertas = tarefas.filter((t) => normalizar(t.statusCor) !== "verde");
  const tarefasEmAtraso = tarefasAbertas.filter((t) => t.prazo && t.prazo < hojeISO);
  const tarefasHoje = tarefasAbertas.filter((t) => t.prazo === hojeISO);
  const postsConcluidos = posts.filter((p) => normalizar(p.statusCor) === "verde");
  const postsAbertos = posts.filter((p) => normalizar(p.statusCor) !== "verde");

  const postsVisiveis = (mostrarSubconteudos ? posts : posts.filter((p) => !p.post_pai_id)).filter(
    (p) => !filtroStatusAtivo || p.status_id === filtroStatusAtivo
  );

  const ABAS: { chave: Aba; label: string; contagem?: number; icone: React.ReactNode }[] = [
    { chave: "geral", label: "Visão geral", icone: <LayoutGrid size={14} /> },
    { chave: "tarefas", label: "Tarefas", contagem: tarefas.length, icone: <CheckSquare size={14} /> },
    { chave: "conteudo", label: "Conteúdo", contagem: posts.length, icone: <FileText size={14} /> },
    { chave: "chat", label: "Chat", icone: <MessageCircle size={14} /> },
    { chave: "docs", label: "Docs", contagem: docs.length, icone: <FolderOpen size={14} /> },
  ];

  return (
    <main className="w-full px-6 sm:px-8 lg:px-10 py-8">
      <button onClick={() => router.push("/central-clientes")} className="text-sm font-semibold text-ink/50 hover:text-ink mb-3">
        ← Central de Clientes
      </button>

      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <div className="relative group/avatar shrink-0">
            {fotoCliente ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoCliente} alt={nomeCliente} className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <div className={`h-11 w-11 rounded-full ${corAvatar(nomeCliente)} text-white flex items-center justify-center font-bold text-sm shrink-0`}>
                {nomeCliente.slice(0, 2).toUpperCase()}
              </div>
            )}
            <button
              onClick={() => inputFotoRef.current?.click()}
              disabled={enviandoFoto}
              className="absolute inset-0 rounded-full bg-black/50 text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center text-[9px] font-semibold"
              title="Trocar foto do cliente"
            >
              {enviandoFoto ? "..." : "Trocar"}
            </button>
            <input ref={inputFotoRef} type="file" accept="image/*" onChange={enviarFotoCliente} className="hidden" />
          </div>
          <h1 className="text-xl font-extrabold text-ink truncate">{nomeCliente}</h1>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1 shadow-inner overflow-x-auto">
            {ABAS.map((a) => (
              <button
                key={a.chave}
                onClick={() => setAba(a.chave)}
                className={`rounded-full px-3.5 py-2 text-sm font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  aba === a.chave ? "bg-ink text-white shadow-md" : "text-ink/50 hover:text-ink"
                }`}
              >
                {a.icone}
                {a.label}
                {typeof a.contagem === "number" && a.contagem > 0 && (
                  <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${aba === a.chave ? "bg-white/20" : "bg-black/10"}`}>{a.contagem}</span>
                )}
              </button>
            ))}
          </div>

          {souAdmin && (
            <div className="relative shrink-0">
              <button
                onClick={() => setConfirmandoArquivar((v) => !v)}
                title="Arquivar Central de Cliente"
                className="h-9 w-9 rounded-full border-2 border-red-200 text-red-500 flex items-center justify-center hover:bg-red-50 transition-colors"
              >
                <Archive size={16} />
              </button>
              {confirmandoArquivar && (
                <div className="absolute z-10 top-full right-0 mt-2 w-72 rounded-2xl bg-white border border-red-200 shadow-lg p-4">
                  <p className="text-xs text-ink/60 mb-3">
                    Isso tira {nomeCliente} da lista da Central de Clientes. Nada é excluído — tarefas, conteúdo e docs continuam
                    guardados, só ficam inacessíveis por aqui até reativar.
                  </p>
                  <button
                    onClick={arquivarCentral}
                    className="w-full rounded-full bg-red-600 text-white px-4 py-2 text-xs font-semibold hover:bg-red-700 transition-colors"
                  >
                    Confirmar arquivamento
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {aba === "conteudo" && (
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1">
            <button
              onClick={() => setVisualizacaoConteudo("kanban")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                visualizacaoConteudo === "kanban" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setVisualizacaoConteudo("calendario")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                visualizacaoConteudo === "calendario" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
              }`}
            >
              Calendário
            </button>
            <button
              onClick={() => setVisualizacaoConteudo("lista")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                visualizacaoConteudo === "lista" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
              }`}
            >
              Lista
            </button>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            {visualizacaoConteudo !== "calendario" && (
              <label className="flex items-center gap-1.5 text-xs text-ink/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mostrarSubconteudos}
                  onChange={(e) => setMostrarSubconteudos(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-forest"
                />
                Sub-conteúdos
              </label>
            )}
            {filtroStatusAtivo && visualizacaoConteudo !== "calendario" && (
              <button
                onClick={() => setFiltroStatusAtivo(null)}
                className="inline-flex items-center gap-1.5 rounded-full bg-mint text-forest px-3 py-1.5 text-xs font-bold hover:brightness-95 transition"
              >
                {statusList.find((s) => s.id === filtroStatusAtivo)?.nome} ✕
              </button>
            )}
            {visualizacaoConteudo === "calendario" && (
              <button
                onClick={() => calendarioRef.current?.abrirLinkPublico()}
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink/15 text-ink px-3.5 py-1.5 text-xs font-semibold hover:bg-surface transition-colors"
              >
                <Link2 size={13} /> Link público
              </button>
            )}
            <button
              onClick={novoPostRapido}
              className="rounded-full bg-ink text-white px-4 py-1.5 text-xs font-semibold hover:bg-forest transition-colors"
            >
              + Novo post
            </button>
          </div>
        </div>
      )}

      {aba === "geral" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-card border border-black/5 p-4">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wide text-ink/50">✔️ Tarefas por etapa</h2>
              <span className="text-[11px] text-ink/40">{tarefas.length} no total</span>
            </div>
            {tarefas.length > 0 && (
              <div className="flex h-2 rounded-full overflow-hidden mb-3 bg-black/5">
                {statusList.map((s) => {
                  const qtd = tarefas.filter((t) => t.status_id === s.id).length;
                  if (qtd === 0) return null;
                  return (
                    <div
                      key={s.id}
                      title={`${s.nome}: ${qtd}`}
                      className={`h-full transition-all ${corDoStatus(s.cor).dot}`}
                      style={{ width: `${(qtd / tarefas.length) * 100}%` }}
                    />
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {statusList.map((s) => {
                const qtd = tarefas.filter((t) => t.status_id === s.id).length;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setFiltroStatusAtivo(s.id);
                      setVisualizacaoTarefas("lista");
                      setAba("tarefas");
                    }}
                    className={`rounded-xl p-2.5 text-center transition-all duration-150 hover:scale-105 hover:shadow-sm active:scale-95 ${corDoStatus(s.cor).cor}`}
                  >
                    <p className="text-lg font-extrabold leading-none">{qtd}</p>
                    <p className="text-[10px] font-semibold mt-1 truncate">{s.nome}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-black/5 p-4">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wide text-ink/50">📅 Conteúdo por etapa</h2>
              <span className="text-[11px] text-ink/40">{posts.length} no total</span>
            </div>
            {posts.length > 0 && (
              <div className="flex h-2 rounded-full overflow-hidden mb-3 bg-black/5">
                {statusList.map((s) => {
                  const qtd = posts.filter((p) => p.status_id === s.id).length;
                  if (qtd === 0) return null;
                  return (
                    <div
                      key={s.id}
                      title={`${s.nome}: ${qtd}`}
                      className={`h-full transition-all ${corDoStatus(s.cor).dot}`}
                      style={{ width: `${(qtd / posts.length) * 100}%` }}
                    />
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {statusList.map((s) => {
                const qtd = posts.filter((p) => p.status_id === s.id).length;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setFiltroStatusAtivo(s.id);
                      setVisualizacaoConteudo("lista");
                      setAba("conteudo");
                    }}
                    className={`rounded-xl p-2.5 text-center transition-all duration-150 hover:scale-105 hover:shadow-sm active:scale-95 ${corDoStatus(s.cor).cor}`}
                  >
                    <p className="text-lg font-extrabold leading-none">{qtd}</p>
                    <p className="text-[10px] font-semibold mt-1 truncate">{s.nome}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-card border border-black/5 p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-ink/50 mb-3">🕐 Atividade recente</h2>
              {atividadeRecente.length === 0 ? (
                <p className="text-xs text-ink/40">Nada por aqui ainda.</p>
              ) : (
                <div className="space-y-2.5">
                  {atividadeRecente.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => router.push(a.link)}
                      className="w-full flex items-start gap-2 text-left hover:bg-surface rounded-xl px-1.5 py-1 -mx-1.5 transition-colors"
                    >
                      <span className="text-sm shrink-0 mt-0.5">{a.tipo === "tarefa" ? "✔️" : "📅"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="text-xs text-ink block truncate">
                          <span className="font-semibold">{(a.autor_id && nomesPorAutor[a.autor_id]) || "Alguém"}</span> {a.descricao}
                        </span>
                        <span className="text-[11px] text-ink/40 block truncate">{a.itemTitulo}</span>
                      </span>
                      <span className="text-[10px] text-ink/30 shrink-0">{formatarQuandoRelativo(a.created_at)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl bg-card border border-black/5 p-4 flex items-center gap-2">
                <span className="text-lg">📄</span>
                <p className="text-sm text-ink">
                  <span className="font-extrabold">{docs.length}</span> <span className="text-ink/50">documentos</span>
                </p>
              </div>

              {(tarefasEmAtraso.length > 0 || tarefasHoje.length > 0) && (
                <div className="rounded-2xl bg-card border border-black/5 p-4">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-ink/50 mb-2">⚠️ Atenção</h2>
                  <div className="space-y-1">
                    {tarefasEmAtraso.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => router.push(`/tarefas/${t.id}`)}
                        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl hover:bg-surface transition-colors text-left"
                      >
                        <span className="text-xs text-ink truncate">{t.titulo}</span>
                        <span className="text-[11px] text-red-600 font-bold shrink-0">Atrasada · {formatarData(t.prazo!)}</span>
                      </button>
                    ))}
                    {tarefasHoje.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => router.push(`/tarefas/${t.id}`)}
                        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl hover:bg-surface transition-colors text-left"
                      >
                        <span className="text-xs text-ink truncate">{t.titulo}</span>
                        <span className="text-[11px] text-forest font-bold shrink-0">Hoje</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {aba === "tarefas" && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1">
                <button
                  onClick={() => setVisualizacaoTarefas("lista")}
                  className={`rounded-full px-4 py-1.5 text-sm font-bold transition-all ${
                    visualizacaoTarefas === "lista" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
                  }`}
                >
                  Lista
                </button>
                <button
                  onClick={() => setVisualizacaoTarefas("kanban")}
                  className={`rounded-full px-4 py-1.5 text-sm font-bold transition-all ${
                    visualizacaoTarefas === "kanban" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
                  }`}
                >
                  Kanban
                </button>
              </div>
              {filtroStatusAtivo && (
                <button
                  onClick={() => setFiltroStatusAtivo(null)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-mint text-forest px-3 py-1.5 text-xs font-bold hover:brightness-95 transition"
                >
                  {statusList.find((s) => s.id === filtroStatusAtivo)?.nome} ✕
                </button>
              )}
            </div>
            <button onClick={novaTarefaRapida} className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors">
              + Nova tarefa
            </button>
          </div>
          {(() => {
            const tarefasFiltradas = filtroStatusAtivo ? tarefas.filter((t) => t.status_id === filtroStatusAtivo) : tarefas;
            return visualizacaoTarefas === "kanban" ? (
            <MiniKanban
              statusList={statusList}
              itens={tarefasFiltradas.map((t) => ({
                id: t.id,
                titulo: t.titulo,
                status_id: t.status_id,
                subtitulo: t.prazo ? formatarData(t.prazo) : "",
                responsaveis: responsaveisPorTarefa[t.id] ?? [],
                temDescricao: !!t.descricao,
                progresso: progressoTarefas[t.id],
                prefixo: t.eh_projeto ? "📋" : undefined,
              }))}
              onMover={moverTarefaStatus}
              onAbrir={(itemId) => router.push(`/tarefas/${itemId}`)}
            />
          ) : tarefasFiltradas.length === 0 ? (
            <p className="text-sm text-ink/50">Nenhuma tarefa {filtroStatusAtivo ? "nesse status" : "ainda"}.</p>
          ) : (
            <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
              <div className="grid grid-cols-[1fr_90px_100px_110px_100px] gap-2 px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-ink/40 bg-surface/60">
                <span>Nome</span>
                <span>☰</span>
                <span>Vencimento</span>
                <span>Responsáveis</span>
                <span>Status</span>
              </div>
              {tarefasFiltradas.map((t) => {
                const prog = progressoTarefas[t.id];
                const pct = prog && prog.total > 0 ? Math.round((prog.completos / prog.total) * 100) : null;
                return (
                  <button
                    key={t.id}
                    onClick={() => router.push(`/tarefas/${t.id}`)}
                    className="w-full grid grid-cols-[1fr_90px_100px_110px_100px] items-center gap-2 px-5 py-3 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors text-left"
                  >
                    <span className="min-w-0">
                      <span className="text-sm text-ink truncate flex items-center gap-1.5">
                        {t.eh_projeto && <IconeProjeto tamanho={13} />}
                        <span className="truncate">{t.titulo}</span>
                      </span>
                      {pct !== null && (
                        <span className="flex items-center gap-1.5 mt-1">
                          <span className="h-1 flex-1 max-w-[120px] rounded-full bg-black/5 overflow-hidden">
                            <span className={`block h-full rounded-full ${pct === 100 ? "bg-forest" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                          </span>
                          <span className="text-[10px] text-ink/40 shrink-0">
                            {prog!.completos}/{prog!.total}
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="text-ink/30">{t.descricao ? "☰" : ""}</span>
                    <span className="text-xs text-ink/40">{t.prazo ? formatarData(t.prazo) : "—"}</span>
                    <AvatarStack pessoas={responsaveisPorTarefa[t.id] ?? []} />
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 w-fit ${corDoStatus(t.statusCor).cor}`}>{t.statusNome}</span>
                  </button>
                );
              })}
            </div>
            );
          })()}
        </div>
      )}

      {aba === "conteudo" && (
        <div>
          {visualizacaoConteudo === "calendario" ? (
            <CalendarioConteudoConteudo
              ref={calendarioRef}
              viewInicial="calendario"
              clienteFixoId={id}
              compacto
              visualizacaoExterna={visualizacaoConteudo}
              onMudarVisualizacao={setVisualizacaoConteudo}
            />
          ) : visualizacaoConteudo === "kanban" ? (
            <MiniKanban
              statusList={statusList}
              itens={postsVisiveis.map((p) => ({
                id: p.id,
                titulo: p.titulo || "Sem título",
                status_id: p.status_id,
                subtitulo: formatarData(p.data_publicacao),
                responsaveis: responsaveisPorPost[p.id] ?? [],
                temDescricao: !!p.observacoes_internas,
                progresso: progressoPosts[p.id],
                prefixo: p.post_pai_id ? "↳" : undefined,
              }))}
              onMover={moverPostStatus}
              onAbrir={(itemId) => router.push(`/conteudo/calendario/post/${itemId}`)}
            />
          ) : postsVisiveis.length === 0 ? (
            <p className="text-sm text-ink/50">Nenhum conteúdo ainda.</p>
          ) : (
            <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
              <div className="grid grid-cols-[1fr_90px_100px_110px_100px] gap-2 px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-ink/40 bg-surface/60">
                <span>Nome</span>
                <span>☰</span>
                <span>Data</span>
                <span>Responsáveis</span>
                <span>Status</span>
              </div>
              {postsVisiveis.map((p) => {
                const prog = progressoPosts[p.id];
                const pct = prog && prog.total > 0 ? Math.round((prog.completos / prog.total) * 100) : null;
                return (
                  <button
                    key={p.id}
                    onClick={() => router.push(`/conteudo/calendario/post/${p.id}`)}
                    className="w-full grid grid-cols-[1fr_90px_100px_110px_100px] items-center gap-2 px-5 py-3 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors text-left"
                  >
                    <span className="min-w-0">
                      <span className="text-sm text-ink truncate flex items-center gap-1.5">
                        {p.post_pai_id && <span className="text-forest text-xs">↳</span>}
                        <span className="truncate">{p.titulo || "Sem título"}</span>
                      </span>
                      {pct !== null && (
                        <span className="flex items-center gap-1.5 mt-1">
                          <span className="h-1 flex-1 max-w-[120px] rounded-full bg-black/5 overflow-hidden">
                            <span className={`block h-full rounded-full ${pct === 100 ? "bg-forest" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                          </span>
                          <span className="text-[10px] text-ink/40 shrink-0">
                            {prog!.completos}/{prog!.total}
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="text-ink/30">{p.observacoes_internas ? "☰" : ""}</span>
                    <span className="text-xs text-ink/40">{formatarData(p.data_publicacao)}</span>
                    <AvatarStack pessoas={responsaveisPorPost[p.id] ?? []} />
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 w-fit ${corDoStatus(p.statusCor).cor}`}>{p.statusNome}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {aba === "chat" && (
        <div className="rounded-3xl bg-card border border-black/5 overflow-hidden flex flex-col" style={{ height: "calc(100vh - 260px)" }}>
          {!canalChatId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <p className="text-sm text-ink/50">Esse cliente ainda não tem um canal de chat.</p>
              <button onClick={criarCanalCliente} className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors">
                + Criar canal do cliente
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {mensagens.length === 0 ? (
                  <p className="text-sm text-ink/40">Nenhuma mensagem ainda. Manda a primeira!</p>
                ) : (
                  mensagens.map((m) => {
                    const nome = m.autor_id === meuId ? meuNome : nomesPorAutor[m.autor_id] ?? "Alguém";
                    return (
                      <div key={m.id} className="flex items-start gap-2.5">
                        <Avatar nome={nome} tamanho={28} />
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-bold text-ink">{nome}</span>
                            <span className="text-[11px] text-ink/40">{formatarHoraMsg(m.created_at)}</span>
                          </div>
                          <p className="text-sm text-ink whitespace-pre-wrap break-words">{m.texto}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatFimRef} />
              </div>
              <div className="p-3 border-t border-black/5 shrink-0 flex items-center gap-2">
                <input
                  value={novaMensagem}
                  onChange={(e) => setNovaMensagem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      enviarMensagem();
                    }
                  }}
                  placeholder="Escreva uma mensagem..."
                  className="input flex-1 text-sm"
                />
                <button
                  onClick={enviarMensagem}
                  disabled={!novaMensagem.trim()}
                  className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
                >
                  Enviar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {aba === "docs" && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={novoDocRapido} className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors">
              + Novo doc
            </button>
          </div>
          {docs.length === 0 ? (
            <p className="text-sm text-ink/50">Nenhum documento ainda.</p>
          ) : (
            <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
              <div className="grid grid-cols-[1fr_120px_100px_100px_80px] gap-2 px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-ink/40 bg-surface/60">
                <span>Nome</span>
                <span>Categoria</span>
                <span>Criado em</span>
                <span>Atualizado em</span>
                <span>Sub-docs</span>
              </div>
              {docs.map((d) => {
                const categoria = categoriasDocs.find((c) => c.id === d.categoria_id);
                const resumo = d.conteudo
                  ? d.conteudo
                      .replace(/<[^>]+>/g, " ")
                      .replace(/&nbsp;/g, " ")
                      .replace(/\s+/g, " ")
                      .trim()
                      .slice(0, 70)
                  : "";
                return (
                  <button
                    key={d.id}
                    onClick={() => router.push(`/docs/${d.id}`)}
                    className="w-full grid grid-cols-[1fr_120px_100px_100px_80px] items-center gap-2 px-5 py-3 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="h-8 w-8 rounded-lg bg-surface flex items-center justify-center text-base shrink-0">{d.emoji || "📄"}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-ink truncate">{d.titulo}</span>
                        {resumo && <span className="block text-xs text-ink/40 truncate">{resumo}</span>}
                      </span>
                    </span>
                    <span>
                      {categoria ? (
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold w-fit ${corDoStatus(categoria.cor).cor}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${corDoStatus(categoria.cor).dot}`} />
                          {categoria.nome}
                        </span>
                      ) : (
                        <span className="text-xs text-ink/30">—</span>
                      )}
                    </span>
                    <span className="text-xs text-ink/40">{formatarDataHora(d.created_at)}</span>
                    <span className="text-xs text-ink/40">{formatarDataHora(d.updated_at)}</span>
                    <span className="text-xs text-ink/40">{d.qtdFilhos > 0 ? d.qtdFilhos : "—"}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

interface ItemKanban {
  id: string;
  titulo: string;
  status_id: string;
  subtitulo: string;
  responsaveis: Responsavel[];
  temDescricao: boolean;
  progresso?: { total: number; completos: number };
  prefixo?: string;
}

function MiniKanban({
  statusList,
  itens,
  onMover,
  onAbrir,
}: {
  statusList: { id: string; nome: string; cor: string }[];
  itens: ItemKanban[];
  onMover: (itemId: string, novoStatusId: string) => void;
  onAbrir: (itemId: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.data.current?.statusAtual !== over.id) {
      onMover(active.id as string, over.id as string);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {statusList.map((coluna) => (
          <MiniKanbanColuna
            key={coluna.id}
            coluna={coluna}
            itens={itens.filter((i) => i.status_id === coluna.id)}
            onAbrir={onAbrir}
          />
        ))}
      </div>
    </DndContext>
  );
}

function MiniKanbanColuna({
  coluna,
  itens,
  onAbrir,
}: {
  coluna: { id: string; nome: string; cor: string };
  itens: ItemKanban[];
  onAbrir: (itemId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  const cor = corDoStatus(coluna.cor);
  return (
    <div
      ref={setNodeRef}
      className={`w-64 shrink-0 rounded-3xl border-2 p-3 min-h-[calc(100vh-280px)] transition-all duration-150 ${cor.colBg} ${
        isOver ? `${cor.colBorder} scale-[1.02] shadow-lg` : "border-transparent"
      }`}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cor.dot}`} />
        <p className="text-sm font-bold text-ink truncate">{coluna.nome}</p>
        <span className={`ml-auto text-xs font-bold rounded-full px-2 py-0.5 shrink-0 ${cor.cor}`}>{itens.length}</span>
      </div>
      <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto pr-1">
        {itens.map((item) => (
          <MiniKanbanCard key={item.id} item={item} statusAtual={coluna.id} onAbrir={onAbrir} />
        ))}
      </div>
    </div>
  );
}

function MiniKanbanCard({ item, statusAtual, onAbrir }: { item: ItemKanban; statusAtual: string; onAbrir: (itemId: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id, data: { statusAtual } });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && onAbrir(item.id)}
      className={`touch-none rounded-2xl bg-white p-3 border border-black/5 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-opacity ${
        isDragging ? "opacity-30" : "opacity-100"
      }`}
    >
      <p className="text-sm font-semibold text-ink truncate">
        {item.prefixo && <span className="text-forest">{item.prefixo} </span>}
        {item.titulo}
      </p>
      {item.progresso &&
        item.progresso.total > 0 &&
        (() => {
          const pct = Math.round((item.progresso!.completos / item.progresso!.total) * 100);
          return (
            <div className="mt-1.5">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-semibold text-ink/40">
                  {item.progresso!.completos}/{item.progresso!.total}
                </span>
                <span className="text-[10px] font-bold text-amber-600">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-forest" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })()}
      <div className="flex items-center justify-between mt-2">
        <span className="flex items-center gap-1.5 text-ink/40">
          {item.temDescricao && <span className="text-xs">☰</span>}
          <span className="text-[11px]">{item.subtitulo}</span>
        </span>
        <AvatarStack pessoas={item.responsaveis} tamanho={18} />
      </div>
    </div>
  );
}
