"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { corDoStatus } from "@/lib/status-conteudo";
import { normalizar } from "@/lib/normalizar";

interface Responsavel {
  id: string;
  nome: string;
  fotoUrl: string | null;
  authUserId?: string | null;
}

interface TarefaResumo {
  id: string;
  titulo: string;
  status_id: string;
  prazo: string | null;
  descricao: string | null;
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
  created_at: string;
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
function formatarData(iso: string) {
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
  const [aba, setAba] = useState<Aba>("geral");
  const [loading, setLoading] = useState(true);

  const [tarefas, setTarefas] = useState<TarefaResumo[]>([]);
  const [responsaveisPorTarefa, setResponsaveisPorTarefa] = useState<Record<string, Responsavel[]>>({});
  const [posts, setPosts] = useState<PostResumo[]>([]);
  const [responsaveisPorPost, setResponsaveisPorPost] = useState<Record<string, Responsavel[]>>({});
  const [mostrarSubconteudos, setMostrarSubconteudos] = useState(false);
  const [docs, setDocs] = useState<DocResumo[]>([]);
  const [nomesPorAutor, setNomesPorAutor] = useState<Record<string, string>>({});

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

    const [{ data: clienteData }, { data: tarefasData }, { data: postsData }, { data: docsData }, { data: canalData }, { data: funcData }] =
      await Promise.all([
        supabase.from("clientes").select("papeis ( pessoas ( nome ) )").eq("id", id).maybeSingle(),
        supabase
          .from("tarefas")
          .select("id, titulo, status_id, prazo, descricao, status_conteudo ( nome, cor )")
          .eq("cliente_id", id)
          .is("tarefa_pai_id", null)
          .eq("arquivada", false)
          .order("created_at", { ascending: false }),
        supabase
          .from("posts_conteudo")
          .select("id, titulo, data_publicacao, status_id, post_pai_id, observacoes_internas, status_conteudo ( nome, cor )")
          .eq("cliente_id", id)
          .eq("arquivado", false)
          .order("data_publicacao", { ascending: false })
          .limit(60),
        supabase.from("docs").select("id, titulo, emoji, conteudo, criado_por, created_at, doc_pai_id").eq("cliente_id", id).order("created_at", { ascending: false }),
        supabase.from("chat_canais").select("id").eq("tipo", "cliente").eq("cliente_id", id).maybeSingle(),
        supabase.from("funcionarios").select("id, auth_user_id, papeis ( pessoas ( nome, apelido, foto_url ) )").not("auth_user_id", "is", null),
      ]);

    const nomeC = (clienteData as unknown as { papeis: { pessoas: { nome: string } | null } | null } | null)?.papeis?.pessoas?.nome ?? "—";
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
      status_conteudo: { nome: string; cor: string } | null;
    }[]).map((t) => ({
      id: t.id,
      titulo: t.titulo,
      status_id: t.status_id,
      prazo: t.prazo,
      descricao: t.descricao,
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

    const contFilhosDocs: Record<string, number> = {};
    for (const d of (docsData ?? []) as { doc_pai_id: string | null }[]) {
      if (d.doc_pai_id) contFilhosDocs[d.doc_pai_id] = (contFilhosDocs[d.doc_pai_id] ?? 0) + 1;
    }
    setDocs(
      ((docsData ?? []) as { id: string; titulo: string; emoji: string | null; conteudo: string | null; criado_por: string | null; created_at: string; doc_pai_id: string | null }[])
        .filter((d) => !d.doc_pai_id)
        .map((d) => ({ ...d, qtdFilhos: contFilhosDocs[d.id] ?? 0 }))
    );

    const ids = [...listaTarefas.map((t) => t.id), ...listaPosts.map((p) => p.id)];
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
    if (nova) router.push(`/tarefas/${nova.id}`);
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
    if (novo) router.push(`/conteudo/calendario/post/${novo.id}`);
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

  const postsVisiveis = mostrarSubconteudos ? posts : posts.filter((p) => !p.post_pai_id);

  const ABAS: { chave: Aba; label: string; contagem?: number }[] = [
    { chave: "geral", label: "Visão geral" },
    { chave: "tarefas", label: "Tarefas", contagem: tarefas.length },
    { chave: "conteudo", label: "Conteúdo", contagem: posts.length },
    { chave: "chat", label: "Chat" },
    { chave: "docs", label: "Docs", contagem: docs.length },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <button onClick={() => router.push("/central-clientes")} className="text-sm font-semibold text-ink/50 hover:text-ink mb-4">
        ← Central de Clientes
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className={`h-14 w-14 rounded-full ${corAvatar(nomeCliente)} text-white flex items-center justify-center font-bold text-lg shrink-0`}>
          {nomeCliente.slice(0, 2).toUpperCase()}
        </div>
        <h1 className="text-2xl font-extrabold text-ink">{nomeCliente}</h1>
      </div>

      <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1.5 shadow-inner mb-6">
        {ABAS.map((a) => (
          <button
            key={a.chave}
            onClick={() => setAba(a.chave)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-all flex items-center gap-1.5 ${
              aba === a.chave ? "bg-ink text-white shadow-md" : "text-ink/50 hover:text-ink"
            }`}
          >
            {a.label}
            {typeof a.contagem === "number" && a.contagem > 0 && (
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${aba === a.chave ? "bg-white/20" : "bg-black/10"}`}>{a.contagem}</span>
            )}
          </button>
        ))}
      </div>

      {aba === "geral" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              ["Tarefas abertas", tarefasAbertas.length],
              ["Tarefas concluídas", tarefasConcluidas.length],
              ["Conteúdos abertos", postsAbertos.length],
              ["Conteúdos concluídos", postsConcluidos.length],
              ["Documentos", docs.length],
            ].map(([label, valor]) => (
              <div key={label as string} className="rounded-2xl bg-card border border-black/5 p-4">
                <p className="text-2xl font-extrabold text-ink">{valor}</p>
                <p className="text-xs text-ink/50">{label}</p>
              </div>
            ))}
          </div>

          {(tarefasEmAtraso.length > 0 || tarefasHoje.length > 0) && (
            <div className="rounded-3xl bg-card border border-black/5 p-5">
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink/50 mb-3">Atenção</h2>
              <div className="space-y-1">
                {tarefasEmAtraso.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => router.push(`/tarefas/${t.id}`)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-xl hover:bg-surface transition-colors text-left"
                  >
                    <span className="text-sm text-ink truncate">{t.titulo}</span>
                    <span className="text-xs text-red-600 font-bold shrink-0">Atrasada · {formatarData(t.prazo!)}</span>
                  </button>
                ))}
                {tarefasHoje.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => router.push(`/tarefas/${t.id}`)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-xl hover:bg-surface transition-colors text-left"
                  >
                    <span className="text-sm text-ink truncate">{t.titulo}</span>
                    <span className="text-xs text-forest font-bold shrink-0">Hoje</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {aba === "tarefas" && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={novaTarefaRapida} className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors">
              + Nova tarefa
            </button>
          </div>
          {tarefas.length === 0 ? (
            <p className="text-sm text-ink/50">Nenhuma tarefa ainda.</p>
          ) : (
            <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
              <div className="grid grid-cols-[1fr_90px_100px_110px_100px] gap-2 px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-ink/40 bg-surface/60">
                <span>Nome</span>
                <span>☰</span>
                <span>Prazo</span>
                <span>Responsáveis</span>
                <span>Status</span>
              </div>
              {tarefas.map((t) => (
                <button
                  key={t.id}
                  onClick={() => router.push(`/tarefas/${t.id}`)}
                  className="w-full grid grid-cols-[1fr_90px_100px_110px_100px] items-center gap-2 px-5 py-3 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors text-left"
                >
                  <span className="text-sm text-ink truncate">{t.titulo}</span>
                  <span className="text-ink/30">{t.descricao ? "☰" : ""}</span>
                  <span className="text-xs text-ink/40">{t.prazo ? formatarData(t.prazo) : "—"}</span>
                  <AvatarStack pessoas={responsaveisPorTarefa[t.id] ?? []} />
                  <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 w-fit ${corDoStatus(t.statusCor).cor}`}>{t.statusNome}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {aba === "conteudo" && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="flex items-center gap-2 text-sm text-ink/60 cursor-pointer">
              <input
                type="checkbox"
                checked={mostrarSubconteudos}
                onChange={(e) => setMostrarSubconteudos(e.target.checked)}
                className="h-4 w-4 rounded accent-forest"
              />
              Mostrar sub-conteúdos
            </label>
            <button onClick={novoPostRapido} className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors">
              + Novo post
            </button>
          </div>
          {postsVisiveis.length === 0 ? (
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
              {postsVisiveis.map((p) => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/conteudo/calendario/post/${p.id}`)}
                  className="w-full grid grid-cols-[1fr_90px_100px_110px_100px] items-center gap-2 px-5 py-3 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors text-left"
                >
                  <span className="text-sm text-ink truncate flex items-center gap-1.5">
                    {p.post_pai_id && <span className="text-forest text-xs">↳</span>}
                    {p.titulo || "Sem título"}
                  </span>
                  <span className="text-ink/30">{p.observacoes_internas ? "☰" : ""}</span>
                  <span className="text-xs text-ink/40">{formatarData(p.data_publicacao)}</span>
                  <AvatarStack pessoas={responsaveisPorPost[p.id] ?? []} />
                  <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 w-fit ${corDoStatus(p.statusCor).cor}`}>{p.statusNome}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {aba === "chat" && (
        <div className="rounded-3xl bg-card border border-black/5 overflow-hidden flex flex-col" style={{ height: "65vh" }}>
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
              <div className="grid grid-cols-[1fr_90px_100px_110px_90px] gap-2 px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-ink/40 bg-surface/60">
                <span>Nome</span>
                <span>☰</span>
                <span>Criado em</span>
                <span>Criado por</span>
                <span>Sub-docs</span>
              </div>
              {docs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => router.push(`/docs/${d.id}`)}
                  className="w-full grid grid-cols-[1fr_90px_100px_110px_90px] items-center gap-2 px-5 py-3 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors text-left"
                >
                  <span className="text-sm text-ink truncate flex items-center gap-1.5">
                    <span>{d.emoji || "📄"}</span> {d.titulo}
                  </span>
                  <span className="text-ink/30">{d.conteudo && d.conteudo.replace(/<[^>]*>/g, "").trim() ? "☰" : ""}</span>
                  <span className="text-xs text-ink/40">{formatarDataHora(d.created_at)}</span>
                  <span className="text-xs text-ink/50 truncate">{(d.criado_por && nomesPorAutor[d.criado_por]) || "—"}</span>
                  <span className="text-xs text-ink/40">{d.qtdFilhos > 0 ? d.qtdFilhos : "—"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
