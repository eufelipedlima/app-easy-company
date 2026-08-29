"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
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
  titulo: string | null;
  data_publicacao: string;
  hora_publicacao: string | null;
  updated_at: string;
  legenda: string | null;
  objetivo: "atracao" | "educacao" | "conversao" | null;
  formato: "estatico" | "carrossel" | "stories" | "video" | null;
  link_video: string | null;
  status_conteudo: { nome: string; cor: string } | null;
  posts_conteudo_midias: Midia[];
  posts_conteudo_comentarios: Comentario[];
}



const OBJETIVO_LABEL: Record<string, string> = {
  atracao: "Atração",
  educacao: "Educação",
  conversao: "Conversão",
  conexao: "Conexão",
  institucional: "Institucional",
  bastidores: "Bastidores",
};

const FORMATO_LABEL: Record<string, string> = {
  estatico: "Estático",
  carrossel: "Carrossel",
  stories: "Stories",
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
  const [fotoCliente, setFotoCliente] = useState<string | null>(null);
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
        return [];
      }
      setNomeCliente(data.nomeCliente);
      setFotoCliente(data.fotoCliente ?? null);
      setPosts(data.posts);
      setUltimaAtualizacao(new Date());
      setLoading(false);
      setAtualizando(false);
      return data.posts as Post[];
    } catch {
      setErro("Não foi possível carregar o calendário.");
    }
    setLoading(false);
    setAtualizando(false);
    return [];
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

  const postsPendentes = posts.filter(
    (p) => !/agend/i.test(p.status_conteudo?.nome ?? "") && !/altera/i.test(p.status_conteudo?.nome ?? "")
  );

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
    <main className="min-h-screen bg-surface px-4 sm:px-6 py-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            {fotoCliente ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoCliente} alt={nomeCliente} className="h-11 w-11 sm:h-12 sm:w-12 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-ink text-white flex items-center justify-center font-bold shrink-0">
                {nomeCliente.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold text-ink truncate">{loading ? "Carregando..." : nomeCliente}</h1>
              <p className="text-xs text-ink/40">Equipe de marketing · Easy Company</p>
            </div>
          </div>
          <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 sm:gap-1 shrink-0">
            <p className="text-[11px] text-ink/40">
              {ultimaAtualizacao
                ? `Atualizado ${ultimaAtualizacao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                : ""}
            </p>
            <button
              onClick={carregar}
              disabled={atualizando}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink/15 text-ink px-3 py-1.5 text-xs font-semibold hover:bg-white active:bg-white transition-colors disabled:opacity-50 shrink-0"
            >
              {atualizando ? "Atualizando..." : "↻ Atualizar"}
            </button>
          </div>
        </div>

        <div className="mb-5">
          <h2 className="text-xl sm:text-2xl font-extrabold text-ink">Aprovação de Conteúdo</h2>
          <p className="text-sm text-ink/50 mt-0.5">
            Aqui você acompanha, aprova e pede ajustes nos conteúdos programados pra sua empresa.
            {loading ? (
              <span className="block sm:inline text-ink/40 mt-1 sm:mt-0"> Carregando seus conteúdos...</span>
            ) : (
              postsPendentes.length > 0 && (
                <span className="block sm:inline font-semibold text-forest mt-1 sm:mt-0">
                  {" "}
                  {postsPendentes.length} {postsPendentes.length === 1 ? "conteúdo aguardando" : "conteúdos aguardando"} sua aprovação.
                </span>
              )
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 mb-6">
          <button
            onClick={() => {
              const d = new Date(ano, mes - 1, 1);
              setMes(d.getMonth());
              setAno(d.getFullYear());
            }}
            className="rounded-full h-9 w-9 flex items-center justify-center hover:bg-white active:bg-white text-ink/50 shrink-0"
          >
            ←
          </button>
          <button
            onClick={() => {
              setMes(hoje.getMonth());
              setAno(hoje.getFullYear());
            }}
            className="rounded-full border-2 border-ink/15 px-3 sm:px-4 py-1.5 text-sm font-semibold hover:bg-white active:bg-white shrink-0"
          >
            Hoje
          </button>
          <button
            onClick={() => {
              const d = new Date(ano, mes + 1, 1);
              setMes(d.getMonth());
              setAno(d.getFullYear());
            }}
            className="rounded-full h-9 w-9 flex items-center justify-center hover:bg-white active:bg-white text-ink/50 shrink-0"
          >
            →
          </button>
          <h2 className="text-base sm:text-lg font-bold text-ink ml-1 sm:ml-2 truncate">
            {MESES[mes]} {ano}
          </h2>
        </div>

        {/* Grade mensal — só em telas maiores. Numa tela de celular, 7 colunas ficam pequenas
            demais pra serem clicáveis/legíveis, então usamos uma lista abaixo. */}
        {loading ? (
          <div className="hidden sm:block rounded-3xl bg-card border border-black/5 overflow-hidden animate-pulse">
            <div className="grid grid-cols-7 bg-ink/10">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="px-3 py-2.5" />
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="min-h-[100px] border-b border-r border-black/5 p-2">
                  <div className="h-4 w-4 rounded-full bg-black/5" />
                  {(i === 9 || i === 16 || i === 22) && <div className="h-8 rounded-lg bg-black/5 mt-2" />}
                </div>
              ))}
            </div>
          </div>
        ) : (
        <div className="hidden sm:block rounded-3xl bg-card border border-black/5 overflow-hidden">
          <div className="grid grid-cols-7 bg-ink text-xs font-bold text-white/90 uppercase tracking-wide">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="px-3 py-2.5 text-center">
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
                        className={`w-full text-left rounded-lg px-1.5 py-1 leading-tight ${corDoStatus(p.status_conteudo?.cor ?? "cinza").cor}`}
                      >
                        <p className="text-[11px] font-semibold truncate">{p.titulo || p.hora_publicacao?.slice(0, 5) || "Post"}</p>
                        {(p.formato || p.hora_publicacao) && (
                          <p className="text-[10px] opacity-70 truncate">
                            {[p.formato ? FORMATO_LABEL[p.formato] : null, p.hora_publicacao?.slice(0, 5)].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Lista/agenda — só em celular. Mostra os dias do mês que têm algo
            marcado, um embaixo do outro, com os posts em cards grandes e
            fáceis de tocar. */}
        {loading ? (
          <div className="sm:hidden space-y-4 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div className="h-4 w-24 rounded bg-black/5 mb-2 ml-1" />
                <div className="h-16 rounded-2xl bg-card border border-black/5" />
              </div>
            ))}
          </div>
        ) : (
        <div className="sm:hidden space-y-3">
          {dias.filter((d) => d.getMonth() === mes && (postsPorDia.get(toISODate(d))?.length ?? 0) > 0).length === 0 ? (
            <div className="rounded-2xl bg-card border border-black/5 p-6 text-center">
              <p className="text-sm text-ink/40">Nenhum conteúdo programado em {MESES[mes].toLowerCase()}.</p>
            </div>
          ) : (
            dias
              .filter((d) => d.getMonth() === mes)
              .map((dia) => {
                const iso = toISODate(dia);
                const postsDoDia = postsPorDia.get(iso) ?? [];
                if (postsDoDia.length === 0) return null;
                return (
                  <div key={iso}>
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                      <span
                        className={`text-xs font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                          iso === hojeISO ? "bg-ink text-white" : "bg-surface text-ink/50"
                        }`}
                      >
                        {dia.getDate()}
                      </span>
                      <span className="text-xs font-semibold text-ink/50 uppercase tracking-wide">
                        {DIAS_SEMANA[dia.getDay()]}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {postsDoDia.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setPostAberto(p)}
                          className={`w-full text-left rounded-2xl px-4 py-3 active:scale-[0.98] transition-transform ${corDoStatus(p.status_conteudo?.cor ?? "cinza").cor}`}
                        >
                          <p className="text-sm font-bold truncate">{p.titulo || p.hora_publicacao?.slice(0, 5) || "Post"}</p>
                          {(p.formato || p.hora_publicacao) && (
                            <p className="text-xs opacity-70 mt-0.5">
                              {[p.formato ? FORMATO_LABEL[p.formato] : null, p.hora_publicacao?.slice(0, 5)].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
          )}
        </div>
        )}
      </div>

      {postAberto && (
        <PostPublicoModal
          key={postAberto.id}
          post={postAberto}
          token={token}
          listaPendentes={postsPendentes}
          onNavegar={(p) => setPostAberto(p)}
          onClose={() => setPostAberto(null)}
          onComentado={carregar}
        />
      )}
    </main>
  );
}

function PostPublicoModal({
  post,
  token,
  listaPendentes,
  onNavegar,
  onClose,
  onComentado,
}: {
  post: Post;
  token: string;
  listaPendentes: Post[];
  onNavegar: (p: Post) => void;
  onClose: () => void;
  onComentado: () => Promise<Post[]>;
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
    if (res.ok) {
      setTexto("");
      setMostrarCampoAlteracao(false);
      const postsFrescos = await onComentado();
      const pendentesFrescos = postsFrescos.filter(
        (p) => !/agend/i.test(p.status_conteudo?.nome ?? "") && !/altera/i.test(p.status_conteudo?.nome ?? "")
      );
      const postAtualAtualizado = postsFrescos.find((p) => p.id === post.id) ?? post;
      const idxNaListaOriginal = listaPendentes.findIndex((p) => p.id === post.id);
      const proximoOriginal = listaPendentes[idxNaListaOriginal + 1] ?? listaPendentes[idxNaListaOriginal - 1] ?? null;
      const proximoFresco = proximoOriginal ? pendentesFrescos.find((p) => p.id === proximoOriginal.id) ?? proximoOriginal : null;
      setEnviando(null);
      if (proximoFresco) {
        onNavegar(proximoFresco);
      } else {
        onNavegar(postAtualAtualizado);
        setEnviado(acao === "aprovar" ? "Conteúdo aprovado! 🎉 Você já viu tudo por aqui." : "Ajuste solicitado! A equipe foi avisada.");
      }
    } else {
      setEnviando(null);
      setErro(data.error ?? "Não foi possível enviar.");
    }
  }

  const [comentarioAberto, setComentarioAberto] = useState(false);
  const comentariosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (comentarioAberto) {
      // Pequeno atraso pra esperar a seção de comentários renderizar antes de
      // rolar até ela — evita "pular" pra um lugar que ainda não existe.
      const t = setTimeout(() => comentariosRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
      return () => clearTimeout(t);
    }
  }, [comentarioAberto]);
  const comentarios = post.posts_conteudo_comentarios ?? [];
  const idxAtual = listaPendentes.findIndex((p) => p.id === post.id);
  const totalNav = listaPendentes.length;
  const jaAprovado = /agend/i.test(post.status_conteudo?.nome ?? "");
  const jaConcluido = /conclu/i.test(post.status_conteudo?.nome ?? "");

  function irPara(offset: number) {
    const alvo = idxAtual + offset;
    if (alvo >= 0 && alvo < listaPendentes.length) onNavegar(listaPendentes[alvo]);
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/60 flex items-center justify-center sm:p-4" onClick={onClose}>
      <div
        className="w-full h-[100dvh] sm:h-[88vh] sm:max-w-6xl rounded-none sm:rounded-2xl bg-white text-ink shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 sm:py-3.5 border-b border-black/5 shrink-0">
          <p className="text-xs font-bold uppercase tracking-widest text-ink/40 shrink-0">Aprovação de conteúdo</p>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-surface active:bg-surface flex items-center justify-center text-ink/40 shrink-0">
            ✕
          </button>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row overflow-y-auto sm:overflow-hidden">
          <div className="shrink-0 sm:flex-1 bg-surface flex items-center justify-center relative p-4 sm:p-6 min-w-0">
            {post.formato === "video" ? (
              <div className="w-full max-w-md">
                <div className="relative rounded-2xl overflow-hidden bg-black/5 w-full aspect-square flex flex-col items-center justify-center gap-3">
                  <span className="text-4xl">🎬</span>
                  {post.link_video ? (
                    <a
                      href={post.link_video}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
                    >
                      ▶ Abrir vídeo
                    </a>
                  ) : (
                    <p className="text-sm text-ink/40">Link do vídeo ainda não cadastrado</p>
                  )}
                </div>
              </div>
            ) : midias.length > 0 ? (
              <div className="w-full max-w-md">
                <div className="relative rounded-2xl overflow-hidden bg-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={midiaAtual.url} alt="Mídia do post" className="w-full max-h-[45vh] sm:max-h-[65vh] object-contain mx-auto" />
                  {midias.length > 1 && (
                    <>
                      <button
                        onClick={() => setMidiaIndex((i) => Math.max(i - 1, 0))}
                        disabled={midiaIndex === 0}
                        className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-9 sm:w-9 rounded-full bg-white/90 shadow flex items-center justify-center disabled:opacity-30 text-ink"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => setMidiaIndex((i) => Math.min(i + 1, midias.length - 1))}
                        disabled={midiaIndex === midias.length - 1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-9 sm:w-9 rounded-full bg-white/90 shadow flex items-center justify-center disabled:opacity-30 text-ink"
                      >
                        →
                      </button>
                    </>
                  )}
                </div>
                {midias.length > 1 && (
                  <div className="flex items-center justify-center gap-1.5 mt-3">
                    {midias.map((m, i) => (
                      <span key={m.id} className={`h-1.5 rounded-full transition-all ${i === midiaIndex ? "w-5 bg-ink" : "w-1.5 bg-ink/20"}`} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink/40 py-16">Sem mídia anexada</p>
            )}
          </div>

          <div className={`shrink-0 sm:w-[320px] border-t sm:border-t-0 sm:border-l border-black/5 sm:overflow-y-auto p-4 sm:p-5 ${comentarioAberto ? "" : "sm:flex-1 sm:max-w-none"}`}>
            {post.titulo && <h3 className="text-lg sm:text-xl font-extrabold text-ink mb-2 leading-snug">{post.titulo}</h3>}

            <div className="flex flex-wrap items-center gap-1.5 mb-4">
              <span className="rounded-full bg-surface text-ink/60 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">Post</span>
              {post.formato && (
                <span className="rounded-full bg-surface text-ink/60 px-2.5 py-1 text-[11px] font-semibold">{FORMATO_LABEL[post.formato]}</span>
              )}
              <span className="rounded-full bg-surface text-ink/60 px-2.5 py-1 text-[11px] font-semibold">
                {formatarData(post.data_publicacao)}
                {post.hora_publicacao && ` · ${post.hora_publicacao.slice(0, 5)}`}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${corDoStatus(post.status_conteudo?.cor ?? "cinza").cor}`}>
                {post.status_conteudo?.nome ?? "—"}
              </span>
            </div>

            {jaAprovado && (
              <div className="rounded-xl bg-mint text-forest text-xs font-semibold px-3 py-2 mb-4">
                ✓ Conteúdo aprovado em {formatarData(post.updated_at.slice(0, 10))} às{" "}
                {new Date(post.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}

            {post.objetivo && <p className="text-xs text-ink/40 mb-3">Objetivo: {OBJETIVO_LABEL[post.objetivo]}</p>}

            {post.legenda && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink/40 mb-1.5">Legenda</p>
                <p className="text-sm text-ink/80 whitespace-pre-wrap leading-relaxed">{post.legenda}</p>
              </div>
            )}
          </div>

          {comentarioAberto && (
            <div ref={comentariosRef} className="shrink-0 sm:w-[300px] border-t sm:border-t-0 sm:border-l border-black/5 flex flex-col">
              <div className="px-4 py-3 border-b border-black/5 shrink-0 flex items-center justify-between">
                <p className="text-sm font-bold text-ink">💬 Comentários</p>
                <button
                  onClick={() => {
                    setComentarioAberto(false);
                    setMostrarCampoAlteracao(false);
                  }}
                  className="text-ink/30 hover:text-ink text-xs h-6 w-6 flex items-center justify-center shrink-0"
                >
                  ✕
                </button>
              </div>
              <div className="sm:flex-1 sm:overflow-y-auto p-4 space-y-3">
                {comentarios.length === 0 ? (
                  <p className="text-xs text-ink/30 text-center mt-6">Nenhuma mensagem ainda.</p>
                ) : (
                  comentarios.map((c) => (
                    <div key={c.id} className="text-sm">
                      <span className={`font-semibold ${c.autor === "cliente" ? "text-amber-700" : "text-forest"}`}>
                        {c.autor === "cliente" ? "Você" : "Equipe Easy Company"}
                      </span>
                      <p className="text-ink/70 mt-0.5">{c.texto}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="p-3 border-t border-black/5 shrink-0">
                {erro && <p className="text-xs text-red-600 mb-2">{erro}</p>}
                {enviado && <p className="text-xs text-forest font-semibold mb-2">{enviado}</p>}
                {jaConcluido ? (
                  <div className="rounded-xl bg-amber-50 text-amber-700 text-xs font-medium px-3 py-3 text-center">
                    ⚠ Esse conteúdo já foi finalizado e não aceita mais ajustes. Fala com a gente pelo WhatsApp se precisar de algo.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="block text-xs font-medium text-ink/60">
                      Escreva o que precisa ajustar — ideia, arte, texto, edição, o que for
                    </span>
                    <textarea
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      rows={3}
                      placeholder="Ex: pode trocar a foto de capa? Ou mudar o texto da legenda?"
                      className="input resize-none text-base sm:text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => enviar("solicitar_alteracao")}
                        disabled={enviando !== null || !texto.trim()}
                        className="rounded-full bg-forest text-white px-4 py-2.5 sm:py-2 text-xs font-semibold hover:brightness-110 active:brightness-110 transition disabled:opacity-50"
                      >
                        {enviando === "solicitar_alteracao" ? "Enviando..." : "Enviar alteração"}
                      </button>
                      <button
                        onClick={() => {
                          setMostrarCampoAlteracao(false);
                          setComentarioAberto(false);
                          setTexto("");
                          setErro(null);
                        }}
                        className="text-xs font-semibold text-ink/50 hover:text-ink py-2.5 sm:py-0"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {!jaConcluido && (
          <div className="px-4 sm:px-5 py-3 border-t border-black/5 shrink-0 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
            {jaAprovado ? (
              <div className="flex items-center justify-center gap-2 rounded-full bg-mint text-forest text-sm font-bold py-3">
                ✓ Você já aprovou esse conteúdo
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => enviar("aprovar")}
                  disabled={enviando !== null}
                  className="flex-1 rounded-full bg-forest text-white py-3.5 text-base font-bold hover:brightness-110 active:brightness-110 transition disabled:opacity-50 shadow-md"
                >
                  ✓ Aprovar
                </button>
                <button
                  onClick={() => {
                    setMostrarCampoAlteracao(true);
                    setComentarioAberto(true);
                  }}
                  disabled={enviando !== null}
                  className="flex-1 rounded-full border-2 border-ink/20 text-ink py-3.5 text-base font-bold hover:bg-surface active:bg-surface transition disabled:opacity-50"
                >
                  ✏ Solicitar ajuste
                </button>
              </div>
            )}
          </div>
        )}
        {jaConcluido && !comentarioAberto && (
          <div className="px-4 sm:px-5 py-3 border-t border-black/5 shrink-0 bg-white">
            <button
              onClick={() => setComentarioAberto(true)}
              className="w-full rounded-full border-2 border-ink/20 text-ink py-3 text-sm font-bold hover:bg-surface active:bg-surface transition"
            >
              💬 Ver comentários
            </button>
          </div>
        )}

        {totalNav > 0 && (
          <div className="flex items-center justify-between px-4 sm:px-5 py-2 border-t border-black/5 shrink-0 text-xs bg-white">
            <button
              onClick={() => irPara(-1)}
              disabled={idxAtual <= 0}
              className="text-ink/50 hover:text-ink disabled:opacity-20 font-semibold py-1.5"
            >
              ← Anterior
            </button>
            <span className="text-ink/40 text-xs">
              {idxAtual >= 0 ? String(idxAtual + 1).padStart(2, "0") : "—"} / {String(totalNav).padStart(2, "0")}
            </span>
            <button
              onClick={() => irPara(1)}
              disabled={idxAtual < 0 || idxAtual >= totalNav - 1}
              className="text-ink/50 hover:text-ink disabled:opacity-20 font-semibold py-1.5"
            >
              Próximo →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
