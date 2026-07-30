"use client";

import { useEffect, useState, useCallback, use } from "react";

interface Comentario {
  id: string;
  autor: "equipe" | "cliente";
  texto: string;
  created_at: string;
}

interface Post {
  id: string;
  data_publicacao: string;
  legenda: string | null;
  objetivo: "atracao" | "educacao" | "conversao" | null;
  status: string;
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
  midia_url: string | null;
  redes_sociais: { nome: string } | null;
  posts_conteudo_comentarios: Comentario[];
}

const STATUS_CONFIG: Record<string, { label: string; cor: string; dot: string }> = {
  para_aprovar_interno: { label: "Em preparação", cor: "bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  aprovado_interno: { label: "Em preparação", cor: "bg-purple-50 text-purple-700", dot: "bg-purple-500" },
  alteracoes_interno: { label: "Em preparação", cor: "bg-purple-50 text-purple-700", dot: "bg-purple-500" },
  aprovado_cliente: { label: "Aprovado", cor: "bg-mint text-forest", dot: "bg-forest" },
  alteracoes_cliente: { label: "Ajuste solicitado", cor: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
};

const OBJETIVO_LABEL: Record<string, string> = {
  atracao: "Atração",
  educacao: "Educação",
  conversao: "Conversão",
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatarData(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

export default function CalendarioPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [nomeCliente, setNomeCliente] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [postAberto, setPostAberto] = useState<Post | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/calendario-publico/${token}?mes=${mes}&ano=${ano}`);
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não foi possível carregar o calendário.");
        setLoading(false);
        return;
      }
      setNomeCliente(data.nomeCliente);
      setPosts(data.posts);
    } catch {
      setErro("Não foi possível carregar o calendário.");
    }
    setLoading(false);
  }, [token, mes, ano]);

  useEffect(() => {
    carregar();
  }, [carregar]);

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

  if (erro) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-surface px-6">
        <div className="text-center">
          <p className="text-lg font-bold text-ink mb-2">Não encontramos esse calendário</p>
          <p className="text-sm text-ink/60">{erro}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wide text-ink/40">Easy Company</p>
          <h1 className="text-2xl font-extrabold text-ink">{loading ? "Carregando..." : `Calendário de ${nomeCliente}`}</h1>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => {
              const d = new Date(ano, mes - 1, 1);
              setMes(d.getMonth());
              setAno(d.getFullYear());
            }}
            className="rounded-full h-9 w-9 flex items-center justify-center hover:bg-white text-ink/50"
          >
            ←
          </button>
          <button
            onClick={() => {
              setMes(hoje.getMonth());
              setAno(hoje.getFullYear());
            }}
            className="rounded-full border-2 border-ink/15 px-4 py-1.5 text-sm font-semibold hover:bg-white"
          >
            Hoje
          </button>
          <button
            onClick={() => {
              const d = new Date(ano, mes + 1, 1);
              setMes(d.getMonth());
              setAno(d.getFullYear());
            }}
            className="rounded-full h-9 w-9 flex items-center justify-center hover:bg-white text-ink/50"
          >
            →
          </button>
          <h2 className="text-lg font-bold text-ink ml-2">
            {MESES[mes]} {ano}
          </h2>
        </div>

        <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
          <div className="grid grid-cols-7 bg-white text-xs font-semibold text-ink/50 uppercase tracking-wide">
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
                  className={`min-h-[100px] border-b border-r border-black/5 p-2 ${doMes ? "bg-white" : "bg-surface/40"}`}
                >
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
                  <div className="space-y-1 mt-1">
                    {postsDoDia.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPostAberto(p)}
                        className={`w-full text-left rounded-lg px-1.5 py-1 text-[11px] font-medium truncate ${STATUS_CONFIG[p.status].cor}`}
                      >
                        {p.redes_sociais?.nome ?? "Post"}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {postAberto && (
        <PostPublicoModal post={postAberto} token={token} onClose={() => setPostAberto(null)} onComentado={carregar} />
      )}
    </main>
  );
}

function PostPublicoModal({
  post,
  token,
  onClose,
  onComentado,
}: {
  post: Post;
  token: string;
  onClose: () => void;
  onComentado: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviarComentario() {
    if (!texto.trim()) return;
    setEnviando(true);
    const res = await fetch(`/api/calendario-publico/${token}/comentarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: post.id, texto }),
    });
    setEnviando(false);
    if (res.ok) {
      setTexto("");
      setEnviado(true);
      onComentado();
    }
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-ink/40">{formatarData(post.data_publicacao)}</p>
            <h2 className="text-lg font-bold text-ink">{post.redes_sociais?.nome ?? "Post"}</h2>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CONFIG[post.status].cor}`}>
            {STATUS_CONFIG[post.status].label}
          </span>
        </div>

        {post.midia_url && (
          <div className="mb-4 rounded-2xl overflow-hidden bg-black/5">
            {post.arquivo_tipo?.startsWith("video") ? (
              <video src={post.midia_url} controls className="w-full max-h-96" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.midia_url} alt="Mídia do post" className="w-full max-h-96 object-contain" />
            )}
          </div>
        )}

        {post.objetivo && (
          <p className="text-xs text-ink/40 mb-2">Objetivo: {OBJETIVO_LABEL[post.objetivo]}</p>
        )}

        {post.legenda && (
          <div className="rounded-2xl bg-surface p-4 mb-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-1">Legenda</p>
            <p className="text-sm text-ink whitespace-pre-wrap">{post.legenda}</p>
          </div>
        )}

        {post.posts_conteudo_comentarios?.length > 0 && (
          <div className="space-y-2 mb-4">
            {post.posts_conteudo_comentarios.map((c) => (
              <div key={c.id} className="text-sm rounded-xl bg-surface p-3">
                <span className={`font-semibold ${c.autor === "cliente" ? "text-amber-700" : "text-forest"}`}>
                  {c.autor === "cliente" ? "Você" : "Equipe Easy Company"}:
                </span>{" "}
                {c.texto}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <span className="block text-sm font-medium text-ink/70">Pedir um ajuste ou deixar um comentário</span>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="input"
            rows={3}
            placeholder="Ex: pode trocar a foto de capa?"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={enviarComentario}
              disabled={enviando || !texto.trim()}
              className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
            >
              {enviando ? "Enviando..." : "Enviar"}
            </button>
            {enviado && <span className="text-xs text-forest font-semibold">Enviado! A equipe foi avisada.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
