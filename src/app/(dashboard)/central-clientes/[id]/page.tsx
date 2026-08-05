"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { corDoStatus } from "@/lib/status-conteudo";

interface ClienteInfo {
  id: string;
  nome: string;
  documento: string | null;
  email: string | null;
  whatsapp: string | null;
  segmento: string | null;
  origem: string | null;
}

interface TarefaResumo {
  id: string;
  titulo: string;
  status_id: string;
  prazo: string | null;
  statusNome: string;
  statusCor: string;
}

interface PostResumo {
  id: string;
  titulo: string | null;
  data_publicacao: string;
  status_id: string;
  statusNome: string;
  statusCor: string;
}

interface DocResumo {
  id: string;
  titulo: string;
  emoji: string | null;
  updated_at: string;
}

interface MensagemResumo {
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
function formatarData(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function formatarDataDoc(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

type Aba = "geral" | "tarefas" | "conteudo" | "chat" | "docs";

export default function CentralClienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [cliente, setCliente] = useState<ClienteInfo | null>(null);
  const [aba, setAba] = useState<Aba>("geral");
  const [loading, setLoading] = useState(true);

  const [tarefas, setTarefas] = useState<TarefaResumo[]>([]);
  const [posts, setPosts] = useState<PostResumo[]>([]);
  const [docs, setDocs] = useState<DocResumo[]>([]);
  const [canalChatId, setCanalChatId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemResumo[]>([]);
  const [nomesPorAutor, setNomesPorAutor] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: clienteData } = await supabase
      .from("clientes")
      .select("id, papeis ( pessoas ( nome, documento, email, whatsapp, segmentos ( nome ), origens ( nome ) ) )")
      .eq("id", id)
      .maybeSingle();

    const c = clienteData as unknown as {
      id: string;
      papeis: {
        pessoas: {
          nome: string;
          documento: string | null;
          email: string | null;
          whatsapp: string | null;
          segmentos: { nome: string } | null;
          origens: { nome: string } | null;
        } | null;
      } | null;
    } | null;

    if (c) {
      setCliente({
        id: c.id,
        nome: c.papeis?.pessoas?.nome ?? "—",
        documento: c.papeis?.pessoas?.documento ?? null,
        email: c.papeis?.pessoas?.email ?? null,
        whatsapp: c.papeis?.pessoas?.whatsapp ?? null,
        segmento: c.papeis?.pessoas?.segmentos?.nome ?? null,
        origem: c.papeis?.pessoas?.origens?.nome ?? null,
      });
    }

    const [{ data: tarefasData }, { data: postsData }, { data: docsData }, { data: canalData }] = await Promise.all([
      supabase
        .from("tarefas")
        .select("id, titulo, status_id, prazo, status_conteudo ( nome, cor )")
        .eq("cliente_id", id)
        .is("tarefa_pai_id", null)
        .eq("arquivada", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("posts_conteudo")
        .select("id, titulo, data_publicacao, status_id, status_conteudo ( nome, cor )")
        .eq("cliente_id", id)
        .is("post_pai_id", null)
        .eq("arquivado", false)
        .order("data_publicacao", { ascending: false })
        .limit(20),
      supabase.from("docs").select("id, titulo, emoji, updated_at").eq("cliente_id", id).is("doc_pai_id", null).order("updated_at", { ascending: false }),
      supabase.from("chat_canais").select("id").eq("tipo", "cliente").eq("cliente_id", id).maybeSingle(),
    ]);

    setTarefas(
      ((tarefasData ?? []) as unknown as { id: string; titulo: string; status_id: string; prazo: string | null; status_conteudo: { nome: string; cor: string } | null }[]).map(
        (t) => ({ id: t.id, titulo: t.titulo, status_id: t.status_id, prazo: t.prazo, statusNome: t.status_conteudo?.nome ?? "—", statusCor: t.status_conteudo?.cor ?? "cinza" })
      )
    );
    setPosts(
      ((postsData ?? []) as unknown as { id: string; titulo: string | null; data_publicacao: string; status_id: string; status_conteudo: { nome: string; cor: string } | null }[]).map(
        (p) => ({ id: p.id, titulo: p.titulo, data_publicacao: p.data_publicacao, status_id: p.status_id, statusNome: p.status_conteudo?.nome ?? "—", statusCor: p.status_conteudo?.cor ?? "cinza" })
      )
    );
    setDocs(docsData ?? []);

    const canalId = (canalData as { id: string } | null)?.id ?? null;
    setCanalChatId(canalId);
    if (canalId) {
      const { data: msgs } = await supabase
        .from("chat_mensagens")
        .select("id, autor_id, texto, created_at")
        .eq("canal_id", canalId)
        .order("created_at", { ascending: false })
        .limit(8);
      setMensagens((msgs ?? []).reverse());

      const { data: func } = await supabase.from("funcionarios").select("auth_user_id, papeis ( pessoas ( nome, apelido ) )").not("auth_user_id", "is", null);
      const mapa: Record<string, string> = {};
      for (const f of (func ?? []) as unknown as { auth_user_id: string; papeis: { pessoas: { nome: string; apelido: string | null } | null } | null }[]) {
        mapa[f.auth_user_id] = f.papeis?.pessoas?.apelido || f.papeis?.pessoas?.nome || "Alguém";
      }
      setNomesPorAutor(mapa);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

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

  if (!cliente) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-ink/50">Cliente não encontrado.</p>
      </main>
    );
  }

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
        <div className={`h-14 w-14 rounded-full ${corAvatar(cliente.nome)} text-white flex items-center justify-center font-bold text-lg shrink-0`}>
          {cliente.nome.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{cliente.nome}</h1>
          {cliente.segmento && <p className="text-sm text-ink/50">{cliente.segmento}</p>}
        </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-3xl bg-card border border-black/5 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink/50 mb-3">Dados do cliente</h2>
            <div className="space-y-2 text-sm">
              {cliente.documento && (
                <p>
                  <span className="text-ink/40">Documento:</span> <span className="text-ink font-medium">{cliente.documento}</span>
                </p>
              )}
              {cliente.email && (
                <p>
                  <span className="text-ink/40">E-mail:</span> <span className="text-ink font-medium">{cliente.email}</span>
                </p>
              )}
              {cliente.whatsapp && (
                <p>
                  <span className="text-ink/40">WhatsApp:</span> <span className="text-ink font-medium">{cliente.whatsapp}</span>
                </p>
              )}
              {cliente.origem && (
                <p>
                  <span className="text-ink/40">Origem:</span> <span className="text-ink font-medium">{cliente.origem}</span>
                </p>
              )}
            </div>
          </div>
          <div className="rounded-3xl bg-card border border-black/5 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink/50 mb-3">Resumo</h2>
            <div className="space-y-2 text-sm">
              <button onClick={() => setAba("tarefas")} className="flex items-center justify-between w-full hover:text-forest transition-colors">
                <span>Tarefas em aberto</span>
                <span className="font-bold">{tarefas.length}</span>
              </button>
              <button onClick={() => setAba("conteudo")} className="flex items-center justify-between w-full hover:text-forest transition-colors">
                <span>Conteúdos</span>
                <span className="font-bold">{posts.length}</span>
              </button>
              <button onClick={() => setAba("docs")} className="flex items-center justify-between w-full hover:text-forest transition-colors">
                <span>Documentos</span>
                <span className="font-bold">{docs.length}</span>
              </button>
            </div>
          </div>
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
              {tarefas.map((t) => (
                <button
                  key={t.id}
                  onClick={() => router.push(`/tarefas/${t.id}`)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3.5 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors text-left"
                >
                  <span className="text-sm text-ink truncate">{t.titulo}</span>
                  <span className="flex items-center gap-3 shrink-0">
                    {t.prazo && <span className="text-xs text-ink/40">{formatarData(t.prazo)}</span>}
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${corDoStatus(t.statusCor).cor}`}>{t.statusNome}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {aba === "conteudo" && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={novoPostRapido} className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors">
              + Novo post
            </button>
          </div>
          {posts.length === 0 ? (
            <p className="text-sm text-ink/50">Nenhum conteúdo ainda.</p>
          ) : (
            <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
              {posts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/conteudo/calendario/post/${p.id}`)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3.5 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors text-left"
                >
                  <span className="text-sm text-ink truncate">{p.titulo || "Sem título"}</span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-ink/40">{formatarData(p.data_publicacao)}</span>
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${corDoStatus(p.statusCor).cor}`}>{p.statusNome}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {aba === "chat" && (
        <div>
          {!canalChatId ? (
            <div className="rounded-3xl bg-card border border-black/5 p-8 text-center">
              <p className="text-sm text-ink/50 mb-4">Esse cliente ainda não tem um canal de chat.</p>
              <button onClick={criarCanalCliente} className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors">
                + Criar canal do cliente
              </button>
            </div>
          ) : (
            <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
              <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
                <p className="text-sm font-bold text-ink">Últimas mensagens</p>
                <button
                  onClick={() => router.push(`/chat?canal=${canalChatId}`)}
                  className="text-xs font-semibold text-forest hover:text-ink"
                >
                  Abrir no Chat →
                </button>
              </div>
              <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
                {mensagens.length === 0 ? (
                  <p className="text-sm text-ink/40">Nenhuma mensagem ainda.</p>
                ) : (
                  mensagens.map((m) => (
                    <div key={m.id} className="text-sm">
                      <span className="font-semibold text-ink">{nomesPorAutor[m.autor_id] ?? "Alguém"}:</span>{" "}
                      <span className="text-ink/70">{m.texto}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
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
              {docs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => router.push(`/docs/${d.id}`)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3.5 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors text-left"
                >
                  <span className="flex items-center gap-2 text-sm text-ink truncate">
                    <span>{d.emoji || "📄"}</span> {d.titulo}
                  </span>
                  <span className="text-xs text-ink/40 shrink-0">{formatarDataDoc(d.updated_at)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
