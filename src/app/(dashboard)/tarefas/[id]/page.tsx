"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";
import { corDoStatus } from "@/lib/status-conteudo";
import { BuscaCliente } from "../page";

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

interface Subtarefa {
  id: string;
  titulo: string;
  concluida: boolean;
  ordem: number;
}

interface Comentario {
  id: string;
  autor_id: string;
  texto: string;
  created_at: string;
}

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  cliente_id: string | null;
  responsavel_id: string | null;
  status_id: string;
  prioridade: "baixa" | "media" | "alta" | null;
  data_inicio: string | null;
  prazo: string | null;
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
function Avatar({ nome, tamanho = 32 }: { nome: string; tamanho?: number }) {
  return (
    <div
      className={`rounded-full ${corAvatar(nome)} text-white flex items-center justify-center text-xs font-bold shrink-0`}
      style={{ height: tamanho, width: tamanho }}
    >
      {iniciais(nome)}
    </div>
  );
}

function formatarQuando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function renderizarTexto(texto: string, todosOsNomes: string[]) {
  if (todosOsNomes.length === 0) return texto;
  const nomesEscapados = [...todosOsNomes].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regexMencao = new RegExp(`@(${nomesEscapados.join("|")})`, "g");
  const partes = texto.split(regexMencao);
  return partes.map((p, i) =>
    todosOsNomes.includes(p) ? (
      <span key={i} className="text-forest font-semibold bg-mint rounded px-1">
        @{p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export default function TarefaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [tarefa, setTarefa] = useState<Tarefa | null>(null);
  const [statusList, setStatusList] = useState<StatusItem[]>([]);
  const [clientes, setClientes] = useState<Opcao[]>([]);
  const [funcionarios, setFuncionarios] = useState<Opcao[]>([]);
  const [colegas, setColegas] = useState<Opcao[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [meuNome, setMeuNome] = useState("Você");
  const [subtarefas, setSubtarefas] = useState<Subtarefa[]>([]);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusAberto, setStatusAberto] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<Opcao | null>(null);
  const [responsavelId, setResponsavelId] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [prazo, setPrazo] = useState("");

  const [novaSubtarefa, setNovaSubtarefa] = useState("");
  const [novoComentario, setNovoComentario] = useState("");
  const [mencaoBusca, setMencaoBusca] = useState<string | null>(null);
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const comentarioRef = useRef<HTMLTextAreaElement>(null);

  const carregarTudo = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [{ data: t }, { data: statusData }, { data: clientesData }, { data: funcData }] = await Promise.all([
      supabase.from("tarefas").select("*").eq("id", id).maybeSingle(),
      supabase.from("status_conteudo").select("id, nome, cor, ordem").order("ordem"),
      supabase.from("clientes").select("id, papeis ( pessoas ( nome ) )"),
      supabase.from("funcionarios").select("id, auth_user_id, papeis ( pessoas ( nome, apelido ) )"),
    ]);

    setStatusList(statusData ?? []);
    const listaClientes = ((clientesData ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[])
      .map((c) => ({ id: c.id, nome: c.papeis?.pessoas?.nome ?? "—" }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setClientes(listaClientes);

    const listaFunc = ((funcData ?? []) as unknown as {
      id: string;
      auth_user_id: string | null;
      papeis: { pessoas: { nome: string; apelido: string | null } | null } | null;
    }[]).map((f) => ({ id: f.id, nome: f.papeis?.pessoas?.apelido || f.papeis?.pessoas?.nome || "Colega", authUserId: f.auth_user_id }));
    setFuncionarios(listaFunc.map((f) => ({ id: f.id, nome: f.nome })));

    if (user) {
      setMeuId(user.id);
      const eu = listaFunc.find((f) => f.authUserId === user.id);
      setMeuNome(eu?.nome ?? "Você");
      setColegas(listaFunc.filter((f) => f.authUserId && f.authUserId !== user.id).map((f) => ({ id: f.authUserId!, nome: f.nome })));
    }

    if (t) {
      setTarefa(t);
      setTitulo(t.titulo);
      setDescricao(t.descricao ?? "");
      setClienteSelecionado(t.cliente_id ? listaClientes.find((c) => c.id === t.cliente_id) ?? null : null);
      setResponsavelId(t.responsavel_id ?? "");
      setPrioridade(t.prioridade ?? "");
      setDataInicio(t.data_inicio ?? "");
      setPrazo(t.prazo ?? "");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  const carregarSubtarefas = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("tarefas_subtarefas").select("id, titulo, concluida, ordem").eq("tarefa_id", id).order("ordem");
    setSubtarefas(data ?? []);
  }, [id]);

  const carregarComentarios = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("tarefas_comentarios").select("id, autor_id, texto, created_at").eq("tarefa_id", id).order("created_at");
    setComentarios(data ?? []);
  }, [id]);

  useEffect(() => {
    carregarSubtarefas();
    carregarComentarios();
  }, [carregarSubtarefas, carregarComentarios]);

  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel(`tarefa-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tarefas_comentarios", filter: `tarefa_id=eq.${id}` }, () =>
        carregarComentarios()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [id, carregarComentarios]);

  async function salvarCampo(campo: Record<string, string | null>) {
    const supabase = createClient();
    await supabase.from("tarefas").update(campo).eq("id", id);
  }

  function nomeDoAutor(authUserId: string) {
    return authUserId === meuId ? meuNome : colegas.find((c) => c.id === authUserId)?.nome ?? "Alguém";
  }

  async function adicionarSubtarefa() {
    if (!novaSubtarefa.trim()) return;
    const supabase = createClient();
    const maxOrdem = Math.max(0, ...subtarefas.map((s) => s.ordem));
    await supabase.from("tarefas_subtarefas").insert({ tarefa_id: id, titulo: novaSubtarefa.trim(), ordem: maxOrdem + 1 });
    setNovaSubtarefa("");
    carregarSubtarefas();
  }

  async function alternarSubtarefa(s: Subtarefa) {
    setSubtarefas((atual) => atual.map((x) => (x.id === s.id ? { ...x, concluida: !x.concluida } : x)));
    const supabase = createClient();
    await supabase.from("tarefas_subtarefas").update({ concluida: !s.concluida }).eq("id", s.id);
  }

  async function removerSubtarefa(subId: string) {
    const supabase = createClient();
    await supabase.from("tarefas_subtarefas").delete().eq("id", subId);
    carregarSubtarefas();
  }

  async function enviarComentario() {
    if (!novoComentario.trim() || !meuId) return;
    setEnviandoComentario(true);
    const supabase = createClient();
    const texto = novoComentario.trim();
    const { error } = await supabase.from("tarefas_comentarios").insert({ tarefa_id: id, autor_id: meuId, texto });
    if (!error) {
      setNovoComentario("");
      const mencionados = colegas.filter((c) => texto.includes(`@${c.nome}`));
      if (mencionados.length > 0) {
        await supabase.from("notificacoes").insert(
          mencionados.map((c) => ({
            destinatario_id: c.id,
            tipo: "mencao_tarefa",
            titulo: `${meuNome} te mencionou numa tarefa`,
            descricao: tarefa?.titulo ?? texto.slice(0, 120),
            link: `/tarefas/${id}`,
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

  async function excluirTarefa() {
    if (!window.confirm("Excluir essa tarefa de vez?")) return;
    const supabase = createClient();
    await supabase.from("tarefas").delete().eq("id", id);
    router.push("/tarefas");
  }

  const colegasParaMencao = colegas.filter((c) => mencaoBusca !== null && normalizar(c.nome).includes(normalizar(mencaoBusca)));
  const todosOsNomes = [meuNome, ...colegas.map((c) => c.nome)];
  const statusAtual = statusList.find((s) => s.id === tarefa?.status_id);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-ink/50">Carregando...</p>
      </main>
    );
  }

  if (!tarefa) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-ink/50">Tarefa não encontrada.</p>
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col">
      <div className="px-8 py-4 border-b border-black/5 flex items-center justify-between shrink-0">
        <button onClick={() => router.push("/tarefas")} className="text-sm font-semibold text-ink/50 hover:text-ink">
          ← Tarefas
        </button>
        <button onClick={excluirTarefa} className="text-sm font-semibold text-red-500 hover:text-red-700">
          Excluir tarefa
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto px-8 py-6 max-w-3xl">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={() => salvarCampo({ titulo: titulo.trim() || tarefa.titulo })}
            className="text-2xl font-extrabold text-ink w-full mb-4 outline-none focus:bg-surface rounded-lg px-1 -mx-1"
          />

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6 rounded-2xl bg-card p-4">
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
                          salvarCampo({ status_id: s.id });
                          setTarefa((t) => (t ? { ...t, status_id: s.id } : t));
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
                  setClienteSelecionado(c);
                  salvarCampo({ cliente_id: c?.id ?? null });
                }}
              />
            </div>

            <div>
              <span className="block text-xs text-ink/50 mb-1">Responsável</span>
              <select
                value={responsavelId}
                onChange={(e) => {
                  setResponsavelId(e.target.value);
                  salvarCampo({ responsavel_id: e.target.value || null });
                }}
                className="input"
              >
                <option value="">Sem responsável</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs text-ink/50 mb-1">Prioridade</span>
              <select
                value={prioridade}
                onChange={(e) => {
                  setPrioridade(e.target.value);
                  salvarCampo({ prioridade: e.target.value || null });
                }}
                className="input"
              >
                <option value="">Nenhuma</option>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>

            <div>
              <span className="block text-xs text-ink/50 mb-1">Início</span>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  salvarCampo({ data_inicio: e.target.value || null });
                }}
                className="input"
              />
            </div>

            <div>
              <span className="block text-xs text-ink/50 mb-1">Prazo</span>
              <input
                type="date"
                value={prazo}
                onChange={(e) => {
                  setPrazo(e.target.value);
                  salvarCampo({ prazo: e.target.value || null });
                }}
                className="input"
              />
            </div>
          </div>

          <div className="mb-6">
            <span className="block text-sm font-bold text-ink mb-2">Descrição</span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              onBlur={() => salvarCampo({ descricao: descricao || null })}
              className="input"
              rows={4}
              placeholder="Detalhes da tarefa..."
            />
          </div>

          <div>
            <span className="block text-sm font-bold text-ink mb-2">Subtarefas</span>
            <div className="space-y-1.5 mb-2">
              {subtarefas.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-xl bg-card px-3 py-2">
                  <input type="checkbox" checked={s.concluida} onChange={() => alternarSubtarefa(s)} className="h-4 w-4 rounded accent-forest" />
                  <span className={`flex-1 text-sm ${s.concluida ? "line-through text-ink/40" : "text-ink"}`}>{s.titulo}</span>
                  <button onClick={() => removerSubtarefa(s.id)} className="text-ink/30 hover:text-red-600 text-xs">
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={novaSubtarefa}
                onChange={(e) => setNovaSubtarefa(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    adicionarSubtarefa();
                  }
                }}
                className="input text-sm"
                placeholder="Adicionar subtarefa..."
              />
              <button onClick={adicionarSubtarefa} className="shrink-0 text-sm font-semibold text-forest hover:text-ink">
                Adicionar
              </button>
            </div>
          </div>
        </div>

        <div className="w-96 shrink-0 border-l border-black/5 flex flex-col bg-card/50">
          <div className="px-5 py-4 border-b border-black/5 shrink-0">
            <p className="text-sm font-bold text-ink">Comentários</p>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {comentarios.length === 0 ? (
              <p className="text-sm text-ink/40">Nenhum comentário ainda.</p>
            ) : (
              comentarios.map((c) => (
                <div key={c.id} className="flex items-start gap-2.5">
                  <Avatar nome={nomeDoAutor(c.autor_id)} tamanho={30} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-ink">{nomeDoAutor(c.autor_id)}</span>
                      <span className="text-[11px] text-ink/40">{formatarQuando(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-ink whitespace-pre-wrap break-words">{renderizarTexto(c.texto, todosOsNomes)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-4 border-t border-black/5 shrink-0 relative">
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
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && mencaoBusca === null) {
                  e.preventDefault();
                  enviarComentario();
                }
              }}
              rows={2}
              placeholder="Escreva um comentário... (@ pra mencionar)"
              className="input resize-none w-full text-sm"
            />
            {mencaoBusca !== null && colegasParaMencao.length > 0 && (
              <div className="absolute z-20 bottom-20 left-4 right-4 rounded-2xl bg-white border border-black/10 shadow-lg py-1 max-h-40 overflow-y-auto">
                {colegasParaMencao.map((c) => (
                  <button key={c.id} onClick={() => selecionarMencao(c.nome)} className="w-full text-left px-4 py-2 text-sm hover:bg-surface">
                    {c.nome}
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
        </div>
      </div>
    </main>
  );
}
