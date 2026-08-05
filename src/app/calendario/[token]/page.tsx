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
  titulo: string | null;
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
  conexao: "Conexão",
  institucional: "Institucional",
  bastidores: "Bastidores",
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
        return;
      }
      setNomeCliente(data.nomeCliente);
      setFotoCliente(data.fotoCliente ?? null);
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
    <main className="min-h-screen bg-surface px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {fotoCliente ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoCliente} alt={nomeCliente} className="h-12 w-12 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-ink text-white flex items-center justify-center font-bold shrink-0">
                {nomeCliente.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-xl font-extrabold text-ink">{loading ? "Carregando..." : nomeCliente}</h1>
              <p className="text-xs text-ink/40">Equipe de marketing · Easy Company</p>
            </div>
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

        <div className="mb-5">
          <h2 className="text-2xl font-extrabold text-ink">📋 Aprovação de Conteúdo</h2>
          <p className="text-sm text-ink/50 mt-0.5">
            Aqui você acompanha, aprova e pede ajustes nos conteúdos programados pra sua empresa.
            {postsPendentes.length > 0 && (
              <span className="font-semibold text-forest">
                {" "}
                {postsPendentes.length} {postsPendentes.length === 1 ? "conteúdo aguardando" : "conteúdos aguardando"} sua aprovação.
              </span>
            )}
          </p>
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
      const idxAtual = listaPendentes.findIndex((p) => p.id === post.id);
      const proximo = listaPendentes[idxAtual + 1] ?? listaPendentes.filter((p) => p.id !== post.id)[idxAtual - 1] ?? null;
      onComentado();
      if (proximo) {
        onNavegar(proximo);
      } else {
        setEnviado(acao === "aprovar" ? "Conteúdo aprovado! 🎉 Você já viu tudo por aqui." : "Ajuste solicitado! A equipe foi avisada.");
      }
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
        {listaPendentes.length > 1 && (
          <div className="flex items-center justify-between px-6 pt-4 text-xs text-ink/40">
            <span>
              {listaPendentes.some((p) => p.id === post.id)
                ? `Conteúdo ${listaPendentes.findIndex((p) => p.id === post.id) + 1} de ${listaPendentes.length} pendentes`
                : "Conteúdo já avaliado"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const idx = listaPendentes.findIndex((p) => p.id === post.id);
                  if (idx > 0) onNavegar(listaPendentes[idx - 1]);
                }}
                disabled={listaPendentes.findIndex((p) => p.id === post.id) <= 0}
                className="h-7 w-7 rounded-full hover:bg-surface flex items-center justify-center disabled:opacity-20"
              >
                ←
              </button>
              <button
                onClick={() => {
                  const idx = listaPendentes.findIndex((p) => p.id === post.id);
                  if (idx >= 0 && idx < listaPendentes.length - 1) onNavegar(listaPendentes[idx + 1]);
                }}
                disabled={(() => {
                  const idx = listaPendentes.findIndex((p) => p.id === post.id);
                  return idx < 0 || idx >= listaPendentes.length - 1;
                })()}
                className="h-7 w-7 rounded-full hover:bg-surface flex items-center justify-center disabled:opacity-20"
              >
                →
              </button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="bg-black/5 md:rounded-l-3xl flex items-center justify-center p-4">
            {midias.length > 0 ? (
              <div className="w-full">
                <div className="relative rounded-2xl overflow-hidden bg-black/10">
                  {midiaAtual.arquivo_tipo?.startsWith("video") ? (
                    <div className="w-full h-[280px] flex flex-col items-center justify-center gap-3 bg-ink/5">
                      <span className="text-4xl">🎬</span>
                      <a
                        href={midiaAtual.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
                      >
                        ▶ Abrir vídeo
                      </a>
                    </div>
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
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-ink/40">
                {formatarData(post.data_publicacao)}
                {post.hora_publicacao && ` às ${post.hora_publicacao.slice(0, 5)}`}
              </p>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${corDoStatus(post.status_conteudo?.cor ?? "cinza").cor}`}>
                {post.status_conteudo?.nome ?? "—"}
              </span>
            </div>

            {post.titulo && <h3 className="text-lg font-extrabold text-ink mb-1">{post.titulo}</h3>}

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
                    Deixe aqui suas alterações — de ideia, arte, texto, edição, o que for
                  </span>
                  <textarea
                    autoFocus
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    className="input"
                    rows={3}
                    placeholder="Ex: pode trocar a foto de capa? Ou mudar o texto da legenda?"
                  />
                </label>
              )}

              {erro && <p className="text-sm text-red-600">{erro}</p>}
              {enviado && <p className="text-sm text-forest font-semibold">{enviado}</p>}

              <div className="flex items-center gap-3">
                {!mostrarCampoAlteracao && (
                  <button
                    onClick={() => enviar("aprovar")}
                    disabled={enviando !== null}
                    className="rounded-full bg-forest text-white px-5 py-2.5 text-sm font-semibold hover:bg-ink transition-colors disabled:opacity-50"
                  >
                    {enviando === "aprovar" ? "Enviando..." : "✓ Aprovar conteúdo"}
                  </button>
                )}
                {mostrarCampoAlteracao ? (
                  <>
                    <button
                      onClick={() => enviar("solicitar_alteracao")}
                      disabled={enviando !== null || !texto.trim()}
                      className="rounded-full bg-forest text-white px-5 py-2.5 text-sm font-semibold hover:bg-ink transition-colors disabled:opacity-50"
                    >
                      {enviando === "solicitar_alteracao" ? "Enviando..." : "Enviar alteração"}
                    </button>
                    <button
                      onClick={() => {
                        setMostrarCampoAlteracao(false);
                        setTexto("");
                        setErro(null);
                      }}
                      disabled={enviando !== null}
                      className="rounded-full border-2 border-ink/15 text-ink px-5 py-2.5 text-sm font-semibold hover:bg-surface transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setMostrarCampoAlteracao(true)}
                    disabled={enviando !== null}
                    className="rounded-full border-2 border-ink/15 text-ink px-5 py-2.5 text-sm font-semibold hover:bg-surface transition-colors disabled:opacity-50"
                  >
                    Solicitar alteração
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
