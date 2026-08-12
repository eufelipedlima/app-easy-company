"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";
import { RichTextEditor } from "@/components/rich-text-editor";
import { ConteudoFormatado } from "@/components/conteudo-formatado";
import {
  GraduationCap,
  Search,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Link as LinkIcon,
  X,
  Lock,
} from "lucide-react";

interface Cargo {
  id: string;
  nome: string;
}
interface VideoItem {
  id: string;
  temaId: string;
  titulo: string | null;
  url: string;
  ordem: number;
}
interface Tema {
  id: string;
  paginaId: string;
  titulo: string;
  emoji: string | null;
  conteudo: string | null;
  ordem: number;
}
interface Pagina {
  id: string;
  categoriaId: string;
  titulo: string;
  emoji: string | null;
  conteudo: string | null;
  ordem: number;
}
interface Categoria {
  id: string;
  nome: string;
  emoji: string | null;
  ordem: number;
  cargosPermitidos: string[] | null;
}

function embedDeVideo(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      const partes = u.pathname.split("/").filter(Boolean);
      const idx = partes.findIndex((p) => p === "embed" || p === "shorts");
      if (idx !== -1 && partes[idx + 1]) return `https://www.youtube.com/embed/${partes[idx + 1]}`;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}

const EMOJIS_SUGERIDOS = ["📄", "⚡", "🌍", "⚙️", "🤝", "📋", "📸", "🎨", "🎬", "🎯", "📈", "🖥️", "✂️", "🗓️", "🚀", "💡", "📚", "🔧", "✅", "🏆"];

export default function AcademyPage() {
  const [souAdmin, setSouAdmin] = useState(false);
  const [meuCargoId, setMeuCargoId] = useState<string | null>(null);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [temas, setTemas] = useState<Tema[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoriasColapsadas, setCategoriasColapsadas] = useState<Set<string>>(new Set());
  const [paginaAtivaId, setPaginaAtivaId] = useState<string | null>(null);
  const [temaAbertoId, setTemaAbertoId] = useState<string | null>(null);
  const [temaEditandoId, setTemaEditandoId] = useState<string | null>(null);

  const [novaCategoriaAberta, setNovaCategoriaAberta] = useState(false);
  const [editandoCategoria, setEditandoCategoria] = useState<Categoria | null>(null);
  const [novaPaginaCategoriaId, setNovaPaginaCategoriaId] = useState<string | null>(null);
  const [editandoTituloPagina, setEditandoTituloPagina] = useState(false);
  const [novoTemaAberto, setNovoTemaAberto] = useState(false);
  const [renomeandoTema, setRenomeandoTema] = useState<Tema | null>(null);
  const [novoVideoTemaId, setNovoVideoTemaId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: funcionarioData } = await supabase
        .from("funcionarios")
        .select("cargo_id, perfis_acesso ( nome )")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      const info = funcionarioData as unknown as { cargo_id: string | null; perfis_acesso: { nome: string } | null } | null;
      setMeuCargoId(info?.cargo_id ?? null);
      setSouAdmin(info?.perfis_acesso?.nome === "Administrador");
    }

    const [{ data: cargosData }, { data: categoriasData }, { data: paginasData }] = await Promise.all([
      supabase.from("cargos").select("id, nome").order("nome"),
      supabase.from("academy_categorias").select("id, nome, emoji, ordem, cargos_permitidos").order("ordem"),
      supabase.from("academy_paginas").select("id, categoria_id, titulo, emoji, conteudo, ordem").order("ordem"),
    ]);
    setCargos(cargosData ?? []);
    setCategorias(
      (categoriasData ?? []).map((c) => ({ id: c.id, nome: c.nome, emoji: c.emoji, ordem: c.ordem, cargosPermitidos: c.cargos_permitidos }))
    );
    const listaPaginas = (paginasData ?? []).map((p) => ({
      id: p.id,
      categoriaId: p.categoria_id,
      titulo: p.titulo,
      emoji: p.emoji,
      conteudo: p.conteudo,
      ordem: p.ordem,
    }));
    setPaginas(listaPaginas);

    if (listaPaginas.length > 0) {
      const { data: temasData } = await supabase
        .from("academy_temas")
        .select("id, pagina_id, titulo, emoji, conteudo, ordem")
        .in(
          "pagina_id",
          listaPaginas.map((p) => p.id)
        )
        .order("ordem");
      const listaTemas = (temasData ?? []).map((t) => ({
        id: t.id,
        paginaId: t.pagina_id,
        titulo: t.titulo,
        emoji: t.emoji,
        conteudo: t.conteudo,
        ordem: t.ordem,
      }));
      setTemas(listaTemas);

      if (listaTemas.length > 0) {
        const { data: videosData } = await supabase
          .from("academy_temas_videos")
          .select("id, tema_id, titulo, url, ordem")
          .in(
            "tema_id",
            listaTemas.map((t) => t.id)
          )
          .order("ordem");
        setVideos((videosData ?? []).map((v) => ({ id: v.id, temaId: v.tema_id, titulo: v.titulo, url: v.url, ordem: v.ordem })));
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const categoriasVisiveis = useMemo(
    () =>
      categorias.filter(
        (c) => souAdmin || !c.cargosPermitidos || c.cargosPermitidos.length === 0 || (meuCargoId && c.cargosPermitidos.includes(meuCargoId))
      ),
    [categorias, souAdmin, meuCargoId]
  );

  const paginasPorCategoria = useMemo(() => {
    const mapa = new Map<string, Pagina[]>();
    for (const p of paginas) mapa.set(p.categoriaId, [...(mapa.get(p.categoriaId) ?? []), p]);
    return mapa;
  }, [paginas]);

  const paginaAtual = paginas.find((p) => p.id === paginaAtivaId) ?? null;
  const categoriaAtual = paginaAtual ? categorias.find((c) => c.id === paginaAtual.categoriaId) : null;
  const temasDaPagina = temas.filter((t) => t.paginaId === paginaAtivaId).sort((a, b) => a.ordem - b.ordem);

  function alternarColapso(id: string) {
    setCategoriasColapsadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function selecionarPagina(id: string) {
    setPaginaAtivaId(id);
    setEditandoTituloPagina(false);
    setTemaAbertoId(null);
    setTemaEditandoId(null);
  }

  async function excluirPagina(id: string) {
    if (!window.confirm("Excluir essa página? Isso apaga todos os temas e vídeos dela também, sem volta.")) return;
    const supabase = createClient();
    await supabase.from("academy_paginas").delete().eq("id", id);
    setPaginas((atual) => atual.filter((p) => p.id !== id));
    setPaginaAtivaId(null);
  }

  async function excluirCategoria(id: string) {
    if (!window.confirm("Excluir essa categoria? Todas as páginas dentro dela também somem, sem volta.")) return;
    const supabase = createClient();
    await supabase.from("academy_categorias").delete().eq("id", id);
    setCategorias((atual) => atual.filter((c) => c.id !== id));
    setPaginas((atual) => atual.filter((p) => p.categoriaId !== id));
    setEditandoCategoria(null);
  }

  async function excluirTema(id: string) {
    if (!window.confirm("Excluir esse tema/aula, com o texto e os vídeos dele?")) return;
    const supabase = createClient();
    await supabase.from("academy_temas").delete().eq("id", id);
    setTemas((atual) => atual.filter((t) => t.id !== id));
    if (temaAbertoId === id) setTemaAbertoId(null);
  }

  async function removerVideo(id: string) {
    const supabase = createClient();
    await supabase.from("academy_temas_videos").delete().eq("id", id);
    setVideos((atual) => atual.filter((v) => v.id !== id));
  }

  async function salvarConteudoTema(temaId: string, html: string) {
    setTemas((atual) => atual.map((t) => (t.id === temaId ? { ...t, conteudo: html } : t)));
    const supabase = createClient();
    await supabase.from("academy_temas").update({ conteudo: html }).eq("id", temaId);
  }

  return (
    <main className="h-screen flex bg-white">
      <aside className="w-72 shrink-0 border-r border-black/5 bg-surface/40 flex flex-col h-full">
        <div className="p-4 border-b border-black/5 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap size={20} className="text-forest" />
            <h1 className="text-base font-extrabold text-ink">Academy</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/30" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar..."
                className="w-full rounded-lg bg-white border border-black/10 pl-8 pr-2 py-1.5 text-sm outline-none focus:border-forest/40 transition-colors"
              />
            </div>
            {souAdmin && (
              <button
                onClick={() => setNovaCategoriaAberta(true)}
                title="Nova categoria"
                className="h-8 w-8 shrink-0 rounded-lg bg-ink text-white flex items-center justify-center hover:bg-forest transition-colors"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-fina-clara py-3">
          {loading ? (
            <p className="px-4 text-xs text-ink/40">Carregando...</p>
          ) : categoriasVisiveis.length === 0 ? (
            <p className="px-4 text-xs text-ink/40">{souAdmin ? "Crie a primeira categoria pra começar." : "Nada disponível pro seu cargo ainda."}</p>
          ) : (
            categoriasVisiveis.map((cat) => {
              const paginasCat = (paginasPorCategoria.get(cat.id) ?? []).filter((p) => !busca || normalizar(p.titulo).includes(normalizar(busca)));
              if (busca && paginasCat.length === 0) return null;
              const colapsada = categoriasColapsadas.has(cat.id);
              return (
                <div key={cat.id} className="mb-4 px-3">
                  <div className="group/cat flex items-center justify-between px-1 mb-1">
                    <button
                      onClick={() => alternarColapso(cat.id)}
                      className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-ink/40 hover:text-ink/70 transition-colors min-w-0"
                    >
                      <ChevronRight size={11} className={`shrink-0 transition-transform ${colapsada ? "" : "rotate-90"}`} />
                      {cat.emoji && <span>{cat.emoji}</span>}
                      <span className="truncate">{cat.nome}</span>
                      {cat.cargosPermitidos && cat.cargosPermitidos.length > 0 && <Lock size={10} className="text-ink/30 shrink-0" />}
                    </button>
                    {souAdmin && (
                      <div className="opacity-0 group-hover/cat:opacity-100 transition-opacity flex items-center gap-1.5 shrink-0">
                        <button onClick={() => setNovaPaginaCategoriaId(cat.id)} title="Nova página" className="text-ink/30 hover:text-forest">
                          <Plus size={13} />
                        </button>
                        <button onClick={() => setEditandoCategoria(cat)} title="Editar categoria" className="text-ink/30 hover:text-ink">
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  {!colapsada && (
                    <div className="space-y-0.5">
                      {paginasCat.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => selecionarPagina(p.id)}
                          className={`w-full text-left rounded-lg px-2.5 py-1.5 text-sm flex items-center gap-2 transition-colors ${
                            paginaAtivaId === p.id ? "bg-forest text-white font-semibold" : "text-ink/70 hover:bg-white"
                          }`}
                        >
                          <span className="shrink-0">{p.emoji || "📄"}</span>
                          <span className="truncate">{p.titulo}</span>
                        </button>
                      ))}
                      {paginasCat.length === 0 && <p className="px-2.5 text-xs text-ink/30 italic">Sem páginas ainda</p>}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 overflow-y-auto scrollbar-fina-clara bg-surface/20">
        {!paginaAtual ? (
          <div className="h-full flex flex-col items-center justify-center text-ink/30 gap-2">
            <GraduationCap size={40} strokeWidth={1.2} />
            <p className="text-sm">Escolha uma página no menu ao lado</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-10 py-12">
            <p className="text-xs font-bold uppercase tracking-wide text-ink/35 mb-2">Academy {categoriaAtual && `/ ${categoriaAtual.nome}`}</p>

            {editandoTituloPagina ? (
              <FormTituloPagina
                pagina={paginaAtual}
                onCancelar={() => setEditandoTituloPagina(false)}
                onSalvo={(titulo, emoji) => {
                  setPaginas((atual) => atual.map((p) => (p.id === paginaAtual.id ? { ...p, titulo, emoji } : p)));
                  setEditandoTituloPagina(false);
                }}
              />
            ) : (
              <div className="flex items-start justify-between gap-3 mb-2">
                <h1 className="text-3xl font-extrabold text-ink flex items-center gap-3 min-w-0">
                  <span className="shrink-0">{paginaAtual.emoji || "📄"}</span>
                  <span className="truncate">{paginaAtual.titulo}</span>
                </h1>
                {souAdmin && (
                  <div className="flex items-center gap-3 shrink-0 pt-2">
                    <button onClick={() => setEditandoTituloPagina(true)} className="text-ink/30 hover:text-ink transition-colors" title="Renomear">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => excluirPagina(paginaAtual.id)} className="text-ink/30 hover:text-red-600 transition-colors" title="Excluir página">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}

            <p className="text-sm text-ink/50 mb-8">
              {temasDaPagina.length} {temasDaPagina.length === 1 ? "tema" : "temas"}
            </p>

            <div className="space-y-3">
              {temasDaPagina.map((tema, i) => {
                const videosDoTema = videos.filter((v) => v.temaId === tema.id).sort((a, b) => a.ordem - b.ordem);
                const aberto = temaAbertoId === tema.id;
                return (
                  <div key={tema.id} className="rounded-2xl border border-black/5 bg-white overflow-hidden hover:shadow-sm transition-shadow">
                    <button
                      onClick={() => setTemaAbertoId(aberto ? null : tema.id)}
                      className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="h-8 w-8 shrink-0 rounded-full bg-mint text-forest flex items-center justify-center text-xs font-extrabold">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="font-bold text-ink truncate">{tema.titulo}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-ink/40">
                          {videosDoTema.length > 0 ? `${videosDoTema.length} vídeo${videosDoTema.length > 1 ? "s" : ""}` : "Sem vídeo"}
                        </span>
                        <ChevronDown size={16} className={`text-ink/30 transition-transform ${aberto ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    {aberto && (
                      <div className="px-5 pb-5 pt-1 border-t border-black/5">
                        {souAdmin && (
                          <div className="flex items-center gap-4 py-3">
                            <button
                              onClick={() => setRenomeandoTema(tema)}
                              className="text-xs font-semibold text-ink/50 hover:text-ink flex items-center gap-1"
                            >
                              <Pencil size={12} /> Renomear
                            </button>
                            <button
                              onClick={() => setNovoVideoTemaId(tema.id)}
                              className="text-xs font-semibold text-forest hover:underline flex items-center gap-1"
                            >
                              <Plus size={12} /> Adicionar vídeo
                            </button>
                            <button
                              onClick={() => setTemaEditandoId(temaEditandoId === tema.id ? null : tema.id)}
                              className="text-xs font-semibold text-ink/50 hover:text-ink"
                            >
                              {temaEditandoId === tema.id ? "Ver como ficou" : "Editar texto"}
                            </button>
                            <button onClick={() => excluirTema(tema.id)} className="text-xs font-semibold text-red-500 hover:underline flex items-center gap-1 ml-auto">
                              <Trash2 size={12} /> Excluir
                            </button>
                          </div>
                        )}

                        {videosDoTema.length > 0 && (
                          <div className={`grid gap-4 mb-5 ${videosDoTema.length > 1 ? "sm:grid-cols-2" : "grid-cols-1"}`}>
                            {videosDoTema.map((v) => {
                              const embed = embedDeVideo(v.url);
                              return (
                                <div key={v.id} className="group/vid relative rounded-xl border border-black/5 overflow-hidden bg-surface/30">
                                  {embed ? (
                                    <div className="aspect-video bg-black">
                                      <iframe
                                        src={embed}
                                        className="w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                      />
                                    </div>
                                  ) : (
                                    <a
                                      href={v.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 p-4 text-sm text-blue-600 hover:underline break-all"
                                    >
                                      <LinkIcon size={14} className="shrink-0" /> {v.url}
                                    </a>
                                  )}
                                  {v.titulo && <p className="px-3 py-2 text-sm font-semibold text-ink truncate">{v.titulo}</p>}
                                  {souAdmin && (
                                    <button
                                      onClick={() => removerVideo(v.id)}
                                      className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/vid:opacity-100 transition-opacity"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {souAdmin && temaEditandoId === tema.id ? (
                          <RichTextEditor
                            valorHtml={tema.conteudo ?? ""}
                            onChange={(html) => setTemas((atual) => atual.map((t) => (t.id === tema.id ? { ...t, conteudo: html } : t)))}
                            onSalvar={() => salvarConteudoTema(tema.id, tema.conteudo ?? "")}
                            semCaixa
                            placeholder="Escreva o conteúdo desse tema..."
                          />
                        ) : (
                          <ConteudoFormatado html={tema.conteudo || "<p class='text-ink/35'>Sem texto por aqui ainda.</p>"} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {souAdmin && (
                <button
                  onClick={() => setNovoTemaAberto(true)}
                  className="w-full rounded-2xl border-2 border-dashed border-black/10 py-4 text-sm font-semibold text-ink/40 hover:text-forest hover:border-forest/30 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={15} /> Novo tema
                </button>
              )}

              {!souAdmin && temasDaPagina.length === 0 && <p className="text-sm text-ink/40">Nenhum conteúdo aqui ainda.</p>}
            </div>
          </div>
        )}
      </div>

      {novaCategoriaAberta && (
        <ModalCategoria
          cargos={cargos}
          onClose={() => setNovaCategoriaAberta(false)}
          onSalvo={(nova) => {
            setCategorias((atual) => [...atual, nova]);
            setNovaCategoriaAberta(false);
          }}
        />
      )}

      {editandoCategoria && (
        <ModalCategoria
          categoria={editandoCategoria}
          cargos={cargos}
          onClose={() => setEditandoCategoria(null)}
          onSalvo={(atualizada) => {
            setCategorias((atual) => atual.map((c) => (c.id === atualizada.id ? atualizada : c)));
            setEditandoCategoria(null);
          }}
          onExcluir={() => excluirCategoria(editandoCategoria.id)}
        />
      )}

      {novaPaginaCategoriaId && (
        <ModalNovaPagina
          categoriaId={novaPaginaCategoriaId}
          ordemInicial={(paginasPorCategoria.get(novaPaginaCategoriaId) ?? []).length}
          onClose={() => setNovaPaginaCategoriaId(null)}
          onCriada={(nova) => {
            setPaginas((atual) => [...atual, nova]);
            setPaginaAtivaId(nova.id);
            setNovaPaginaCategoriaId(null);
          }}
        />
      )}

      {novoTemaAberto && paginaAtual && (
        <ModalNovoTema
          paginaId={paginaAtual.id}
          ordemInicial={temasDaPagina.length}
          onClose={() => setNovoTemaAberto(false)}
          onCriado={(novo) => {
            setTemas((atual) => [...atual, novo]);
            setTemaAbertoId(novo.id);
            setNovoTemaAberto(false);
          }}
        />
      )}

      {renomeandoTema && (
        <ModalRenomearTema
          tema={renomeandoTema}
          onClose={() => setRenomeandoTema(null)}
          onSalvo={(titulo) => {
            setTemas((atual) => atual.map((t) => (t.id === renomeandoTema.id ? { ...t, titulo } : t)));
            setRenomeandoTema(null);
          }}
        />
      )}

      {novoVideoTemaId && (
        <ModalNovoVideo
          temaId={novoVideoTemaId}
          ordemInicial={videos.filter((v) => v.temaId === novoVideoTemaId).length}
          onClose={() => setNovoVideoTemaId(null)}
          onCriado={(novo) => {
            setVideos((atual) => [...atual, novo]);
            setNovoVideoTemaId(null);
          }}
        />
      )}
    </main>
  );
}

function FormTituloPagina({
  pagina,
  onCancelar,
  onSalvo,
}: {
  pagina: Pagina;
  onCancelar: () => void;
  onSalvo: (titulo: string, emoji: string | null) => void;
}) {
  const [titulo, setTitulo] = useState(pagina.titulo);
  const [emoji, setEmoji] = useState(pagina.emoji ?? "📄");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!titulo.trim()) return;
    setSalvando(true);
    const supabase = createClient();
    await supabase.from("academy_paginas").update({ titulo: titulo.trim(), emoji }).eq("id", pagina.id);
    setSalvando(false);
    onSalvo(titulo.trim(), emoji);
  }

  return (
    <div className="mb-6 rounded-2xl border border-black/10 p-4 bg-surface/30">
      <div className="flex items-center gap-2 mb-3">
        <select value={emoji} onChange={(e) => setEmoji(e.target.value)} className="input !w-20 text-lg text-center">
          {EMOJIS_SUGERIDOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input flex-1 text-lg font-bold" autoFocus />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={salvar}
          disabled={salvando}
          className="rounded-full bg-ink text-white px-4 py-1.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
        >
          Salvar
        </button>
        <button onClick={onCancelar} className="text-sm font-semibold text-ink/60 hover:text-ink">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function ModalCategoria({
  categoria,
  cargos,
  onClose,
  onSalvo,
  onExcluir,
}: {
  categoria?: Categoria;
  cargos: Cargo[];
  onClose: () => void;
  onSalvo: (c: Categoria) => void;
  onExcluir?: () => void;
}) {
  const [nome, setNome] = useState(categoria?.nome ?? "");
  const [emoji, setEmoji] = useState(categoria?.emoji ?? "📁");
  const [todosVeem, setTodosVeem] = useState(!categoria || !categoria.cargosPermitidos || categoria.cargosPermitidos.length === 0);
  const [cargosSelecionados, setCargosSelecionados] = useState<string[]>(categoria?.cargosPermitidos ?? []);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternarCargo(id: string) {
    setCargosSelecionados((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }

  async function salvar() {
    if (!nome.trim()) {
      setErro("Dê um nome pra categoria.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const supabase = createClient();
    const payload = { nome: nome.trim(), emoji, cargos_permitidos: todosVeem ? null : cargosSelecionados };
    if (categoria) {
      const { error } = await supabase.from("academy_categorias").update(payload).eq("id", categoria.id);
      setSalvando(false);
      if (error) {
        setErro(error.message);
        return;
      }
      onSalvo({ id: categoria.id, ordem: categoria.ordem, ...payload, cargosPermitidos: payload.cargos_permitidos });
    } else {
      const { data, error } = await supabase
        .from("academy_categorias")
        .insert({ ...payload, ordem: 999 })
        .select("id, ordem")
        .single();
      setSalvando(false);
      if (error || !data) {
        setErro(error?.message ?? "Erro ao criar categoria.");
        return;
      }
      onSalvo({ id: data.id, ordem: data.ordem, ...payload, cargosPermitidos: payload.cargos_permitidos });
    }
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-4">{categoria ? "Editar categoria" : "Nova categoria"}</h2>

        <div className="flex items-center gap-2 mb-4">
          <select value={emoji} onChange={(e) => setEmoji(e.target.value)} className="input !w-20 text-lg text-center">
            {EMOJIS_SUGERIDOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Treinamentos" className="input flex-1" autoFocus />
        </div>

        <div className="mb-4">
          <p className="text-sm font-semibold text-ink/70 mb-2">Quem pode ver essa categoria?</p>
          <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
            <input type="checkbox" checked={todosVeem} onChange={(e) => setTodosVeem(e.target.checked)} />
            Todo mundo
          </label>
          {!todosVeem && (
            <div className="rounded-xl border border-black/10 p-2 max-h-40 overflow-y-auto space-y-1">
              {cargos.length === 0 && <p className="text-xs text-ink/40 px-2 py-1">Nenhum cargo cadastrado ainda.</p>}
              {cargos.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded-lg hover:bg-surface cursor-pointer">
                  <input type="checkbox" checked={cargosSelecionados.includes(c.id)} onChange={() => alternarCargo(c.id)} />
                  {c.nome}
                </label>
              ))}
            </div>
          )}
        </div>

        {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <button
              onClick={salvar}
              disabled={salvando}
              className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={onClose} className="text-sm font-semibold text-ink/60 hover:text-ink">
              Cancelar
            </button>
          </div>
          {categoria && onExcluir && (
            <button onClick={onExcluir} className="text-sm font-semibold text-red-600 hover:underline">
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ModalNovaPagina({
  categoriaId,
  ordemInicial,
  onClose,
  onCriada,
}: {
  categoriaId: string;
  ordemInicial: number;
  onClose: () => void;
  onCriada: (p: Pagina) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [emoji, setEmoji] = useState("📄");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!titulo.trim()) {
      setErro("Dê um nome pra página.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("academy_paginas")
      .insert({ categoria_id: categoriaId, titulo: titulo.trim(), emoji, ordem: ordemInicial })
      .select("id")
      .single();
    setSalvando(false);
    if (error || !data) {
      setErro(error?.message ?? "Erro ao criar página.");
      return;
    }
    onCriada({ id: data.id, categoriaId, titulo: titulo.trim(), emoji, conteudo: "", ordem: ordemInicial });
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-4">Nova página</h2>
        <div className="flex items-center gap-2 mb-4">
          <select value={emoji} onChange={(e) => setEmoji(e.target.value)} className="input !w-20 text-lg text-center">
            {EMOJIS_SUGERIDOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Criação de Conteúdo"
            className="input flex-1"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && salvar()}
          />
        </div>
        {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}
        <div className="flex items-center gap-3">
          <button
            onClick={salvar}
            disabled={salvando}
            className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
          >
            {salvando ? "Criando..." : "Criar página"}
          </button>
          <button onClick={onClose} className="text-sm font-semibold text-ink/60 hover:text-ink">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalNovoTema({
  paginaId,
  ordemInicial,
  onClose,
  onCriado,
}: {
  paginaId: string;
  ordemInicial: number;
  onClose: () => void;
  onCriado: (t: Tema) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!titulo.trim()) {
      setErro("Dê um nome pro tema.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("academy_temas")
      .insert({ pagina_id: paginaId, titulo: titulo.trim(), ordem: ordemInicial })
      .select("id")
      .single();
    setSalvando(false);
    if (error || !data) {
      setErro(error?.message ?? "Erro ao criar tema.");
      return;
    }
    onCriado({ id: data.id, paginaId, titulo: titulo.trim(), emoji: null, conteudo: "", ordem: ordemInicial });
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-4">Novo tema</h2>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex: Etapa 1 — Briefing"
          className="input mb-4"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && salvar()}
        />
        {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}
        <div className="flex items-center gap-3">
          <button
            onClick={salvar}
            disabled={salvando}
            className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
          >
            {salvando ? "Criando..." : "Criar tema"}
          </button>
          <button onClick={onClose} className="text-sm font-semibold text-ink/60 hover:text-ink">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalRenomearTema({ tema, onClose, onSalvo }: { tema: Tema; onClose: () => void; onSalvo: (titulo: string) => void }) {
  const [titulo, setTitulo] = useState(tema.titulo);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!titulo.trim()) return;
    setSalvando(true);
    const supabase = createClient();
    await supabase.from("academy_temas").update({ titulo: titulo.trim() }).eq("id", tema.id);
    setSalvando(false);
    onSalvo(titulo.trim());
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-4">Renomear tema</h2>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="input mb-4"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && salvar()}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={salvar}
            disabled={salvando}
            className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
          <button onClick={onClose} className="text-sm font-semibold text-ink/60 hover:text-ink">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalNovoVideo({
  temaId,
  ordemInicial,
  onClose,
  onCriado,
}: {
  temaId: string;
  ordemInicial: number;
  onClose: () => void;
  onCriado: (v: VideoItem) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!url.trim()) {
      setErro("Cola o link do vídeo.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("academy_temas_videos")
      .insert({ tema_id: temaId, titulo: titulo.trim() || null, url: url.trim(), ordem: ordemInicial })
      .select("id")
      .single();
    setSalvando(false);
    if (error || !data) {
      setErro(error?.message ?? "Erro ao adicionar vídeo.");
      return;
    }
    onCriado({ id: data.id, temaId, titulo: titulo.trim() || null, url: url.trim(), ordem: ordemInicial });
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-4">Adicionar vídeo</h2>
        <label className="block mb-3">
          <span className="block text-sm font-medium text-ink/70 mb-1">Link (YouTube, Vimeo, ou qualquer outro)</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="input" autoFocus />
        </label>
        <label className="block mb-4">
          <span className="block text-sm font-medium text-ink/70 mb-1">Título (opcional)</span>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Aula 1 — Introdução" className="input" />
        </label>
        {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}
        <div className="flex items-center gap-3">
          <button
            onClick={salvar}
            disabled={salvando}
            className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
          >
            {salvando ? "Adicionando..." : "Adicionar"}
          </button>
          <button onClick={onClose} className="text-sm font-semibold text-ink/60 hover:text-ink">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
