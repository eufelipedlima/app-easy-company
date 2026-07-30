"use client";

import { useEffect, useState, useCallback, use } from "react";
import { corDoStatus } from "@/lib/status-conteudo";

interface Comentario {
  id: string;
  autor: "equipe" | "cliente";
  texto: string;
  created_at: string;
}

interface Midia {
  id: string;
  arquivo_tipo: string | null;
  ordem: number;
  url: string;
}

interface Post {
  id: string;
  data_publicacao: string;
  hora_publicacao: string | null;
  legenda: string | null;
  objetivo: "atracao" | "educacao" | "conversao" | null;
  formato: "estatico" | "carrossel" | "video" | null;
  status_conteudo: { nome: string; cor: string } | null;
  posts_conteudo_midias: Midia[];
  posts_conteudo_comentarios: Comentario[];
}



const OBJETIVO_LABEL: Record<string, string> = {
  atracao: "Atração",
  educacao: "Educação",
  conversao: "Conversão",
};

const FORMATO_LABEL: Record<string, string> = {
  estatico: "Estático",
  carrossel: "Carrossel",
  video: "Vídeo",
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
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    setAtualizando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/calendario-publico/${token}?mes=${mes}&ano=${ano}`);
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não foi possível carregar o calendário.");
        setLoading(false);
        setAtualizando(false);
        return;
      }
      setNomeCliente(data.nomeCliente);
      setPosts(data.posts);
      setUltimaAtualizacao(new Date());
    } catch {
      setErro("Não foi possível carregar o calendário.");
    }
    setLoading(false);
    setAtualizando(false);
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
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink/40">Easy Company</p>
            <h1 className="text-2xl font-extrabold text-ink">{loading ? "Carregando..." : `Calendário de ${nomeCliente}`}</h1>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-ink/40 mb-1">
              {ultimaAtualizacao
                ? `Última atualização: ${ultimaAtualizacao.toLocaleDateString("pt-BR")} às ${ultimaAtualizacao.toLocaleTimeString(
                    "pt-BR",
                    { hour: "2-digit", minute: "2-digit" }
                  )}`
                : ""}
            </p>
            <button
              onClick={carregar}
              disabled={atualizando}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink/15 text-ink px-3 py-1.5 text-xs font-semibold hover:bg-white transition-colors disabled:opacity-50"
            >
              {atualizando ? "Atualizando..." : "🔄 Atualizar"}
            </button>
          </div>
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
                        className={`w-full text-left rounded-lg px-1.5 py-1 text-[11px] font-medium truncate ${corDoStatus(p.status_conteudo?.cor ?? "cinza").cor}`}
                      >
                        {p.hora_publicacao?.slice(0, 5) ?? "Post"}
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
  const [enviando, setEnviando] = useState<"aprovar" | "solicitar_alteracao" | null>(null);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [midiaIndex, setMidiaIndex] = useState(0);
  const [mostrarCampoAlteracao, setMostrarCampoAlteracao] = useState(false);

  const midias = [...post.posts_conteudo_midias].sort((a, b) => a.ordem - b.ordem);
  const midiaAtual = midias[midiaIndex];

  async function enviar(acao: "aprovar" | "solicitar_alteracao") {
    if (acao === "solicitar_alteracao" && !texto.trim()) {
      setMostrarCampoAlteracao(true);
      setErro("Descreva o que precisa ser ajustado.");
      return;
    }
    setEnviando(acao);
    setErro(null);
    const res = await fetch(`/api/calendario-publico/${token}/comentarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: post.id, texto, acao }),
    });
    const data = await res.json();
    setEnviando(null);
    if (res.ok) {
      setTexto("");
      setMostrarCampoAlteracao(false);
      setEnviado(acao === "aprovar" ? "Conteúdo aprovado! 🎉" : "Ajuste solicitado! A equipe foi avisada.");
      onComentado();
    } else {
      setErro(data.error ?? "Não foi possível enviar.");
    }
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-3xl bg-card shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="bg-black/5 md:rounded-l-3xl flex items-center justify-center p-4">
            {midias.length > 0 ? (
              <div className="w-full">
                <div className="relative rounded-2xl overflow-hidden bg-black/10">
                  {midiaAtual.arquivo_tipo?.startsWith("video") ? (
                    <video src={midiaAtual.url} controls className="w-full max-h-[420px] mx-auto" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={midiaAtual.url} alt="Mídia do post" className="w-full max-h-[420px] object-contain mx-auto" />
                  )}
                  {midias.length > 1 && (
                    <>
                      <button
                        onClick={() => setMidiaIndex((i) => Math.max(i - 1, 0))}
                        disabled={midiaIndex === 0}
                        className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 flex items-center justify-center disabled:opacity-30"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => setMidiaIndex((i) => Math.min(i + 1, midias.length - 1))}
                        disabled={midiaIndex === midias.length - 1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 flex items-center justify-center disabled:opacity-30"
                      >
                        →
                      </button>
                    </>
                  )}
                </div>
                {midias.length > 1 && (
                  <p className="text-center text-xs text-ink/40 mt-1">
                    {midiaIndex + 1} de {midias.length}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink/40 py-16">Sem mídia anexada</p>
            )}
          </div>

          <div className="p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-ink/40">
                {formatarData(post.data_publicacao)}
                {post.hora_publicacao && ` às ${post.hora_publicacao.slice(0, 5)}`}
              </p>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${corDoStatus(post.status_conteudo?.cor ?? "cinza").cor}`}>
                {post.status_conteudo?.nome ?? "—"}
              </span>
            </div>

            {(post.formato || post.objetivo) && (
              <p className="text-xs text-ink/40 mb-2">
                {post.formato && FORMATO_LABEL[post.formato]}
                {post.formato && post.objetivo && " · "}
                {post.objetivo && `Objetivo: ${OBJETIVO_LABEL[post.objetivo]}`}
              </p>
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

            <div className="mt-auto space-y-3 pt-2">
              {mostrarCampoAlteracao && (
                <label className="block">
                  <span className="block text-sm font-medium text-ink/70 mb-1">
                    Deixe aqui suas alterações, observações ou algo do tipo
                  </span>
                  <textarea
                    autoFocus
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    className="input"
                    rows={3}
                    placeholder="Ex: pode trocar a foto de capa?"
                  />
                </label>
              )}

              {erro && <p className="text-sm text-red-600">{erro}</p>}
              {enviado && <p className="text-sm text-forest font-semibold">{enviado}</p>}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => enviar("aprovar")}
                  disabled={enviando !== null}
                  className="rounded-full bg-forest text-white px-5 py-2.5 text-sm font-semibold hover:bg-ink transition-colors disabled:opacity-50"
                >
                  {enviando === "aprovar" ? "Enviando..." : "✓ Aprovar conteúdo"}
                </button>
                <button
                  onClick={() => (mostrarCampoAlteracao ? enviar("solicitar_alteracao") : setMostrarCampoAlteracao(true))}
                  disabled={enviando !== null}
                  className="rounded-full border-2 border-ink/15 text-ink px-5 py-2.5 text-sm font-semibold hover:bg-surface transition-colors disabled:opacity-50"
                >
                  {enviando === "solicitar_alteracao" ? "Enviando..." : "Solicitar alteração"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
