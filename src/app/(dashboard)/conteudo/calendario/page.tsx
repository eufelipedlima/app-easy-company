"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";

interface Post {
  id: string;
  cliente_id: string;
  rede_social_id: string | null;
  data_publicacao: string;
  legenda: string | null;
  objetivo: "atracao" | "educacao" | "conversao" | null;
  status: StatusPost;
  observacoes_internas: string | null;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
  clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
  redes_sociais: { nome: string } | null;
}

interface Comentario {
  id: string;
  autor: "equipe" | "cliente";
  texto: string;
  created_at: string;
}

interface ClienteOpcao {
  id: string;
  nome: string;
}

interface Opcao {
  id: string;
  nome: string;
}

type StatusPost =
  | "para_aprovar_interno"
  | "aprovado_interno"
  | "alteracoes_interno"
  | "aprovado_cliente"
  | "alteracoes_cliente";

const STATUS_CONFIG: Record<StatusPost, { label: string; cor: string; dot: string }> = {
  para_aprovar_interno: { label: "Para aprovar internamente", cor: "bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  aprovado_interno: { label: "Aprovado internamente", cor: "bg-purple-50 text-purple-700", dot: "bg-purple-500" },
  alteracoes_interno: { label: "Alterações (internas)", cor: "bg-red-50 text-red-700", dot: "bg-red-500" },
  aprovado_cliente: { label: "Aprovado pelo cliente", cor: "bg-mint text-forest", dot: "bg-forest" },
  alteracoes_cliente: { label: "Alterações (cliente)", cor: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
};

const OBJETIVO_CONFIG: Record<string, { label: string; cor: string }> = {
  atracao: { label: "Atração", cor: "bg-sky-400" },
  educacao: { label: "Educação", cor: "bg-amber-400" },
  conversao: { label: "Conversão", cor: "bg-forest" },
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nomeCliente(p: Post) {
  return p.clientes?.papeis?.pessoas?.nome ?? "—";
}

export default function CalendarioConteudoPage() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [clienteFiltroId, setClienteFiltroId] = useState("");
  const [clientes, setClientes] = useState<ClienteOpcao[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Post | null>(null);
  const [novoEmData, setNovoEmData] = useState<string | null>(null);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const carregarClientes = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("clientes")
      .select("id, papeis ( pessoas ( nome ) )");
    const lista = ((data ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[])
      .map((c) => ({
        id: c.id,
        nome: c.papeis?.pessoas?.nome ?? "—",
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setClientes(lista);
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
        `id, cliente_id, rede_social_id, data_publicacao, legenda, objetivo, status, observacoes_internas,
         arquivo_path, arquivo_nome, arquivo_tipo,
         clientes ( papeis ( pessoas ( nome ) ) ),
         redes_sociais ( nome )`
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

  useEffect(() => {
    carregarClientes();
  }, [carregarClientes]);

  useEffect(() => {
    carregarPosts();
  }, [carregarPosts]);

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
        <p className="text-sm text-ink/60">Planejamento e aprovação de postagens dos clientes.</p>
      </div>

      {erroCarregamento && (
        <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">
          <p className="font-semibold">Erro ao carregar os posts:</p>
          <p className="font-mono text-xs mt-1">{erroCarregamento}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
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
            onClick={() => setNovoEmData(hojeISO)}
            className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors"
          >
            + Novo post
          </button>
        </div>
      </div>

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
                className={`min-h-[110px] border-b border-r border-black/5 p-2 ${
                  doMes ? "bg-white" : "bg-surface/40"
                }`}
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
                    <button
                      onClick={() => setNovoEmData(iso)}
                      className="text-ink/20 hover:text-forest text-sm leading-none"
                    >
                      +
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {postsDoDia.slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setEditando(p)}
                      className={`w-full text-left rounded-lg px-1.5 py-1 text-[11px] font-medium truncate ${STATUS_CONFIG[p.status].cor}`}
                    >
                      {!clienteFiltroId && <span className="font-semibold">{nomeCliente(p)}</span>}
                      {!clienteFiltroId && p.redes_sociais?.nome && " · "}
                      {p.redes_sociais?.nome}
                    </button>
                  ))}
                  {postsDoDia.length > 3 && (
                    <p className="text-[10px] text-ink/40 px-1.5">+{postsDoDia.length - 3} mais</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-4">
        {(Object.keys(STATUS_CONFIG) as StatusPost[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-xs text-ink/60">
            <span className={`h-2.5 w-2.5 rounded-full ${STATUS_CONFIG[s].dot}`} />
            {STATUS_CONFIG[s].label}
          </span>
        ))}
      </div>

      {(editando || novoEmData) && (
        <PostModal
          post={editando}
          dataInicial={novoEmData}
          clienteFixoId={clienteFiltroId || null}
          onClose={() => {
            setEditando(null);
            setNovoEmData(null);
          }}
          onSaved={() => {
            setEditando(null);
            setNovoEmData(null);
            carregarPosts();
          }}
        />
      )}
    </main>
  );
}

function PostModal({
  post,
  dataInicial,
  clienteFixoId,
  onClose,
  onSaved,
}: {
  post: Post | null;
  dataInicial: string | null;
  clienteFixoId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editando = !!post;
  const [clientes, setClientes] = useState<ClienteOpcao[]>([]);
  const [clienteId, setClienteId] = useState(post?.cliente_id ?? clienteFixoId ?? "");
  const [redesSociais, setRedesSociais] = useState<Opcao[]>([]);
  const [redeSocialId, setRedeSocialId] = useState(post?.rede_social_id ?? "");
  const [dataPublicacao, setDataPublicacao] = useState(post?.data_publicacao ?? dataInicial ?? "");
  const [legenda, setLegenda] = useState(post?.legenda ?? "");
  const [objetivo, setObjetivo] = useState<string>(post?.objetivo ?? "");
  const [status, setStatus] = useState<StatusPost>(post?.status ?? "para_aprovar_interno");
  const [observacoes, setObservacoes] = useState(post?.observacoes_internas ?? "");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregarOpcoes() {
      const supabase = createClient();
      const [{ data: c }, { data: r }] = await Promise.all([
        supabase.from("clientes").select("id, papeis ( pessoas ( nome ) )"),
        supabase.from("redes_sociais").select("id, nome").order("nome"),
      ]);
      const listaClientes = ((c ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[])
        .map((x) => ({
          id: x.id,
          nome: x.papeis?.pessoas?.nome ?? "—",
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      setClientes(listaClientes);
      setRedesSociais(r ?? []);
    }
    carregarOpcoes();

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId || !dataPublicacao) {
      setErro("Selecione o cliente e a data de publicação.");
      return;
    }
    setSaving(true);
    setErro(null);
    try {
      const supabase = createClient();
      const payload = {
        cliente_id: clienteId,
        rede_social_id: redeSocialId || null,
        data_publicacao: dataPublicacao,
        legenda: legenda || null,
        objetivo: objetivo || null,
        status,
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

      if (arquivo && postId) {
        const path = `${postId}/${arquivo.name}`;
        const { error: uploadError } = await supabase.storage
          .from("conteudo-midia")
          .upload(path, arquivo, { upsert: true });
        if (uploadError) throw uploadError;
        await supabase
          .from("posts_conteudo")
          .update({ arquivo_path: path, arquivo_nome: arquivo.name, arquivo_tipo: arquivo.type })
          .eq("id", postId);
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
        className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-ink mb-5">{editando ? "Editar post" : "Novo post"}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-ink/70 mb-1">Rede social</span>
              <select value={redeSocialId} onChange={(e) => setRedeSocialId(e.target.value)} className="input">
                <option value="">Selecione...</option>
                {redesSociais.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
            </label>
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
          </div>

          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Legenda</span>
            <textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} className="input" rows={4} />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Mídia (imagem ou vídeo)</span>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="input"
            />
            {post?.arquivo_nome && !arquivo && (
              <span className="block text-xs text-ink/40 mt-1">Atual: {post.arquivo_nome}</span>
            )}
          </label>

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

          <div>
            <span className="block text-sm font-medium text-ink/70 mb-1">Status</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_CONFIG) as StatusPost[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold border-2 transition-colors ${
                    status === s ? `${STATUS_CONFIG[s].cor} border-transparent` : "border-black/10 text-ink/50"
                  }`}
                >
                  {STATUS_CONFIG[s].label}
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
