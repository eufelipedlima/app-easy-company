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
  ChevronLeft,
  Link as LinkIcon,
  X,
  Lock,
  ArrowLeft,
  CheckCircle2,
  Circle,
  PlayCircle,
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
const CHAVE_ULTIMO = "academy-ultimo-tema";

function AvatarMini({ nome, fotoUrl, tamanho = 30 }: { nome: string; fotoUrl?: string | null; tamanho?: number }) {
  if (fotoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={fotoUrl} alt={nome} style={{ height: tamanho, width: tamanho }} className="rounded-full object-cover shrink-0" />;
  }
  const iniciais = nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <div
      style={{ height: tamanho, width: tamanho, fontSize: tamanho * 0.38 }}
      className="rounded-full bg-mint text-forest font-extrabold flex items-center justify-center shrink-0"
    >
      {iniciais}
    </div>
  );
}

export default function AcademyPage() {
  const [souAdmin, setSouAdmin] = useState(false);
  const [meuFuncionarioId, setMeuFuncionarioId] = useState<string | null>(null);
  const [meuCargoId, setMeuCargoId] = useState<string | null>(null);
  const [meuCargoNome, setMeuCargoNome] = useState<string | null>(null);
  const [meuNome, setMeuNome] = useState("Você");
  const [meuFotoUrl, setMeuFotoUrl] = useState<string | null>(null);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [temas, setTemas] = useState<Tema[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [progresso, setProgresso] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoriasColapsadas, setCategoriasColapsadas] = useState<Set<string>>(new Set());
  const [paginaAtivaId, setPaginaAtivaId] = useState<string | null>(null);
  const [temaAtivoId, setTemaAtivoId] = useState<string | null>(null);
  const [temaEditandoConteudo, setTemaEditandoConteudo] = useState(false);
  const [ultimoAcesso, setUltimoAcesso] = useState<{ paginaId: string; temaId: string } | null>(null);

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
        .select("id, cargo_id, cargos ( nome ), perfis_acesso ( nome ), papeis ( pessoas ( nome, apelido, foto_url ) )")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      const info = funcionarioData as unknown as {
        id: string;
        cargo_id: string | null;
        cargos: { nome: string } | null;
        perfis_acesso: { nome: string } | null;
        papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null;
      } | null;
      if (info) {
        setMeuFuncionarioId(info.id);
        setMeuCargoId(info.cargo_id);
        setMeuCargoNome(info.cargos?.nome ?? null);
        setSouAdmin(info.perfis_acesso?.nome === "Administrador");
        setMeuNome(info.papeis?.pessoas?.apelido || info.papeis?.pessoas?.nome || "Você");
        setMeuFotoUrl(info.papeis?.pessoas?.foto_url ?? null);
      }
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
        const idsTemas = listaTemas.map((t) => t.id);
        const [{ data: videosData }, progressoRes] = await Promise.all([
          supabase.from("academy_temas_videos").select("id, tema_id, titulo, url, ordem").in("tema_id", idsTemas).order("ordem"),
          user
            ? supabase
                .from("funcionarios")
                .select("id")
                .eq("auth_user_id", user.id)
                .maybeSingle()
                .then(async ({ data: func }) => {
                  if (!func) return { data: [] as { tema_id: string }[] };
                  const r = await supabase.from("academy_progresso").select("tema_id").eq("funcionario_id", func.id).in("tema_id", idsTemas);
                  return r;
                })
            : Promise.resolve({ data: [] as { tema_id: string }[] }),
        ]);
        setVideos((videosData ?? []).map((v) => ({ id: v.id, temaId: v.tema_id, titulo: v.titulo, url: v.url, ordem: v.ordem })));
        setProgresso(new Set((progressoRes.data ?? []).map((p) => p.tema_id)));
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    const salvo = localStorage.getItem(CHAVE_ULTIMO);
    if (salvo) {
      try {
        setUltimoAcesso(JSON.parse(salvo));
      } catch {
        // ignora valor inválido salvo antes
      }
    }
  }, []);

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

  const temasPorPagina = useMemo(() => {
    const mapa = new Map<string, Tema[]>();
    for (const t of temas) mapa.set(t.paginaId, [...(mapa.get(t.paginaId) ?? []), t]);
    for (const lista of mapa.values()) lista.sort((a, b) => a.ordem - b.ordem);
    return mapa;
  }, [temas]);

  function progressoDaPagina(paginaId: string) {
    const lista = temasPorPagina.get(paginaId) ?? [];
    if (lista.length === 0) return { concluidos: 0, total: 0, pct: 0 };
    const concluidos = lista.filter((t) => progresso.has(t.id)).length;
    return { concluidos, total: lista.length, pct: Math.round((concluidos / lista.length) * 100) };
  }

  function progressoDaCategoria(categoriaId: string) {
    const paginasCat = paginasPorCategoria.get(categoriaId) ?? [];
    let concluidos = 0;
    let total = 0;
    for (const p of paginasCat) {
      const r = progressoDaPagina(p.id);
      concluidos += r.concluidos;
      total += r.total;
    }
    return { paginas: paginasCat.length, pct: total > 0 ? Math.round((concluidos / total) * 100) : 0 };
  }

  const progressoGeral = useMemo(() => {
    const idsVisiveis = new Set(categoriasVisiveis.map((c) => c.id));
    const paginasVisiveis = paginas.filter((p) => idsVisiveis.has(p.categoriaId));
    let total = 0;
    let concluidos = 0;
    for (const p of paginasVisiveis) {
      const lista = temasPorPagina.get(p.id) ?? [];
      total += lista.length;
      concluidos += lista.filter((t) => progresso.has(t.id)).length;
    }
    return { total, concluidos, pct: total > 0 ? Math.round((concluidos / total) * 100) : 0 };
  }, [categoriasVisiveis, paginas, temasPorPagina, progresso]);

  const paginaAtual = paginas.find((p) => p.id === paginaAtivaId) ?? null;
  const categoriaAtual = paginaAtual ? categorias.find((c) => c.id === paginaAtual.categoriaId) : null;
  const temasDaPagina = temasPorPagina.get(paginaAtivaId ?? "") ?? [];
  const temaAtivo = temasDaPagina.find((t) => t.id === temaAtivoId) ?? null;
  const indiceTemaAtivo = temaAtivo ? temasDaPagina.findIndex((t) => t.id === temaAtivo.id) : -1;
  const videosDoTemaAtivo = temaAtivo ? videos.filter((v) => v.temaId === temaAtivo.id).sort((a, b) => a.ordem - b.ordem) : [];

  function alternarColapso(id: string) {
    setCategoriasColapsadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function abrirTema(paginaId: string, temaId: string) {
    setPaginaAtivaId(paginaId);
    setTemaAtivoId(temaId);
    setTemaEditandoConteudo(false);
    setEditandoTituloPagina(false);
    localStorage.setItem(CHAVE_ULTIMO, JSON.stringify({ paginaId, temaId }));
    setUltimoAcesso({ paginaId, temaId });
  }

  function selecionarPagina(id: string) {
    const lista = temasPorPagina.get(id) ?? [];
    const primeiroNaoFeito = lista.find((t) => !progresso.has(t.id));
    const alvo = primeiroNaoFeito ?? lista[0];
    if (alvo) abrirTema(id, alvo.id);
    else {
      setPaginaAtivaId(id);
      setTemaAtivoId(null);
    }
    setEditandoTituloPagina(false);
  }

  function voltarPraHome() {
    setPaginaAtivaId(null);
    setTemaAtivoId(null);
  }

  async function alternarConcluido(temaId: string) {
    if (!meuFuncionarioId) return;
    const supabase = createClient();
    if (progresso.has(temaId)) {
      await supabase.from("academy_progresso").delete().eq("funcionario_id", meuFuncionarioId).eq("tema_id", temaId);
      setProgresso((atual) => {
        const novo = new Set(atual);
        novo.delete(temaId);
        return novo;
      });
    } else {
      await supabase.from("academy_progresso").insert({ funcionario_id: meuFuncionarioId, tema_id: temaId });
      setProgresso((atual) => new Set(atual).add(temaId));
    }
  }

  async function excluirPagina(id: string) {
    if (!window.confirm("Excluir esse treinamento? Isso apaga todos os temas e vídeos dele também, sem volta.")) return;
    const supabase = createClient();
    await supabase.from("academy_paginas").delete().eq("id", id);
    setPaginas((atual) => atual.filter((p) => p.id !== id));
    voltarPraHome();
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
    if (temaAtivoId === id) setTemaAtivoId(null);
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

  const paginaDoUltimo = ultimoAcesso ? paginas.find((p) => p.id === ultimoAcesso.paginaId) : null;
  const temaDoUltimo = ultimoAcesso ? temas.find((t) => t.id === ultimoAcesso.temaId) : null;

  return (
    <main className="h-screen flex bg-white">
      {/* Sidebar escura, no mesmo tom do resto do sistema */}
      <aside className="w-72 shrink-0 bg-ink text-white flex flex-col h-full">
        <div className="p-4 border-b border-white/10 shrink-0">
          <button onClick={voltarPraHome} className="flex items-center gap-2 mb-3">
            <GraduationCap size={20} className="text-mint" />
            <span className="text-base font-extrabold">Academy</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/35 z-10" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar treinamentos..."
                style={{ paddingLeft: "2rem" }}
                className="input-escuro"
              />
            </div>
            {souAdmin && (
              <button
                onClick={() => setNovaCategoriaAberta(true)}
                title="Nova categoria"
                className="h-8 w-8 shrink-0 rounded-lg bg-mint text-forest flex items-center justify-center hover:brightness-95 transition-all"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-fina py-3">
          {loading ? (
            <p className="px-4 text-xs text-white/30">Carregando...</p>
          ) : categoriasVisiveis.length === 0 ? (
            <p className="px-4 text-xs text-white/30">{souAdmin ? "Crie a primeira categoria pra começar." : "Nada disponível pro seu cargo ainda."}</p>
          ) : (
            categoriasVisiveis.map((cat) => {
              const paginasCat = (paginasPorCategoria.get(cat.id) ?? []).filter((p) => !busca || normalizar(p.titulo).includes(normalizar(busca)));
              if (busca && paginasCat.length === 0) return null;
              const colapsada = categoriasColapsadas.has(cat.id);
              return (
                <div key={cat.id} className="mb-1 px-3">
                  <div className="group/cat flex items-center justify-between px-1 mb-1 rounded-lg hover:bg-white/5">
                    <button
                      onClick={() => alternarColapso(cat.id)}
                      className="flex items-center gap-1.5 py-2 text-[11px] font-bold uppercase tracking-wide text-white/45 hover:text-white/80 transition-colors min-w-0 flex-1"
                    >
                      <ChevronRight size={11} className={`shrink-0 transition-transform ${colapsada ? "" : "rotate-90"}`} />
                      {cat.emoji && <span className="text-sm">{cat.emoji}</span>}
                      <span className="truncate">{cat.nome}</span>
                      {cat.cargosPermitidos && cat.cargosPermitidos.length > 0 && <Lock size={10} className="text-white/25 shrink-0" />}
                    </button>
                    {souAdmin && (
                      <div className="opacity-0 group-hover/cat:opacity-100 transition-opacity flex items-center gap-1.5 shrink-0 pr-1">
                        <button onClick={() => setNovaPaginaCategoriaId(cat.id)} title="Nova página" className="text-white/40 hover:text-mint">
                          <Plus size={13} />
                        </button>
                        <button onClick={() => setEditandoCategoria(cat)} title="Editar categoria" className="text-white/40 hover:text-white">
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  {!colapsada && (
                    <div className="space-y-0.5 pb-2">
                      {paginasCat.map((p) => {
                        const prog = progressoDaPagina(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => selecionarPagina(p.id)}
                            className={`w-full text-left rounded-lg pl-6 pr-2.5 py-1.5 text-sm flex items-center gap-2 transition-colors ${
                              paginaAtivaId === p.id ? "bg-forest text-white font-semibold" : "text-white/60 hover:bg-white/5 hover:text-white/90"
                            }`}
                          >
                            <span className="shrink-0">{p.emoji || "📄"}</span>
                            <span className="truncate flex-1">{p.titulo}</span>
                            {prog.total > 0 && prog.pct === 100 && <CheckCircle2 size={13} className="text-mint shrink-0" />}
                          </button>
                        );
                      })}
                      {paginasCat.length === 0 && <p className="pl-6 text-xs text-white/25 italic">Sem páginas ainda</p>}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>

        <div className="p-4 border-t border-white/10 shrink-0">
          <p className="text-[11px] text-white/40 mb-1">Seu progresso geral</p>
          <p className="text-lg font-extrabold text-mint mb-1.5">
            {progressoGeral.pct}% <span className="text-xs font-normal text-white/40">concluído</span>
          </p>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-3">
            <div className="h-full bg-mint rounded-full transition-all duration-500" style={{ width: `${progressoGeral.pct}%` }} />
          </div>
          <div className="flex items-center gap-2">
            <AvatarMini nome={meuNome} fotoUrl={meuFotoUrl} tamanho={30} />
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{meuNome}</p>
              <p className="text-[10px] text-white/40 truncate">{souAdmin ? "Administrador" : meuCargoNome || ""}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Conteúdo */}
      {!paginaAtual ? (
        <div className="flex-1 min-w-0 overflow-y-auto scrollbar-fina-clara bg-surface/20">
          <div className="max-w-5xl mx-auto px-10 py-12">
            <p className="text-sm text-ink/50 mb-1">👋 Olá, {meuNome}</p>
            <h1 className="text-3xl font-extrabold text-ink mb-2">Continue seu aprendizado</h1>
            <p className="text-sm text-ink/50 mb-8">Acesse treinamentos, guias e processos pra evoluir cada dia mais.</p>

            <div className="grid grid-cols-2 gap-4 mb-8 max-w-md">
              <div className="rounded-2xl border border-black/5 bg-white p-4">
                <p className="text-2xl font-extrabold text-ink">{progressoGeral.concluidos}</p>
                <p className="text-xs text-ink/50">Aulas concluídas</p>
              </div>
              <div className="rounded-2xl border border-black/5 bg-white p-4">
                <p className="text-2xl font-extrabold text-ink">{paginas.filter((p) => progressoDaPagina(p.id).pct === 100 && progressoDaPagina(p.id).total > 0).length}</p>
                <p className="text-xs text-ink/50">Treinamentos concluídos</p>
              </div>
            </div>

            {paginaDoUltimo && temaDoUltimo && (
              <div className="mb-10">
                <p className="text-sm font-bold text-ink mb-3">Continuar assistindo</p>
                <button
                  onClick={() => abrirTema(paginaDoUltimo.id, temaDoUltimo.id)}
                  className="w-full flex items-center gap-5 rounded-2xl bg-ink text-white p-5 hover:brightness-110 transition-all text-left"
                >
                  <div className="h-14 w-14 rounded-full bg-mint/20 flex items-center justify-center shrink-0">
                    <PlayCircle size={28} className="text-mint" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{temaDoUltimo.titulo}</p>
                    <p className="text-sm text-white/50 truncate">{paginaDoUltimo.titulo}</p>
                  </div>
                  <div className="w-32 shrink-0 hidden sm:block">
                    <div className="h-1.5 rounded-full bg-white/15 overflow-hidden mb-1">
                      <div className="h-full bg-mint rounded-full" style={{ width: `${progressoDaPagina(paginaDoUltimo.id).pct}%` }} />
                    </div>
                    <p className="text-[11px] text-white/40">{progressoDaPagina(paginaDoUltimo.id).pct}% concluído</p>
                  </div>
                </button>
              </div>
            )}

            <p className="text-sm font-bold text-ink mb-3">Categorias em destaque</p>
            {categoriasVisiveis.length === 0 ? (
              <p className="text-sm text-ink/40">{souAdmin ? "Crie a primeira categoria no menu ao lado." : "Nada disponível ainda."}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoriasVisiveis.map((cat) => {
                  const info = progressoDaCategoria(cat.id);
                  const primeiraPagina = (paginasPorCategoria.get(cat.id) ?? [])[0];
                  return (
                    <button
                      key={cat.id}
                      onClick={() => primeiraPagina && selecionarPagina(primeiraPagina.id)}
                      disabled={!primeiraPagina}
                      className="text-left rounded-2xl border border-black/5 bg-white p-4 hover:shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                    >
                      <div className="h-10 w-10 rounded-xl bg-mint flex items-center justify-center text-lg mb-3">{cat.emoji || "📁"}</div>
                      <p className="font-bold text-ink mb-0.5">{cat.nome}</p>
                      <p className="text-xs text-ink/40 mb-3">
                        {info.paginas} {info.paginas === 1 ? "página" : "páginas"}
                      </p>
                      <div className="h-1.5 rounded-full bg-surface overflow-hidden mb-1">
                        <div className="h-full bg-forest rounded-full" style={{ width: `${info.pct}%` }} />
                      </div>
                      <p className="text-[11px] text-ink/40">{info.pct}% concluído</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0 flex overflow-hidden">
          <div className="flex-1 min-w-0 overflow-y-auto scrollbar-fina-clara bg-surface/20">
            <div className="border-b border-black/5 bg-white">
              <div className="px-10 py-4 max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
                <p className="text-xs font-semibold text-ink/40">
                  <span className="hover:text-ink/70 cursor-default">Academy</span>
                  {categoriaAtual && (
                    <>
                      <span className="mx-1.5 text-ink/20">/</span>
                      <span className="hover:text-ink/70 cursor-default">{categoriaAtual.nome}</span>
                    </>
                  )}
                  {paginaAtual && (
                    <>
                      <span className="mx-1.5 text-ink/20">/</span>
                      <span className="text-forest font-bold">{paginaAtual.titulo}</span>
                    </>
                  )}
                  {temaAtivo && (
                    <>
                      <span className="mx-1.5 text-ink/20">/</span>
                      <span className="text-ink/60">
                        Aula {indiceTemaAtivo + 1} de {temasDaPagina.length}
                      </span>
                    </>
                  )}
                </p>
                <button
                  onClick={voltarPraHome}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white px-4 py-2 text-sm font-bold hover:bg-forest transition-colors shrink-0"
                >
                  <ArrowLeft size={14} /> Voltar pro Academy
                </button>
              </div>
            </div>

            {editandoTituloPagina && (
              <div className="px-10 pt-6 max-w-5xl mx-auto">
                <FormTituloPagina
                  pagina={paginaAtual}
                  onCancelar={() => setEditandoTituloPagina(false)}
                  onSalvo={(titulo, emoji) => {
                    setPaginas((atual) => atual.map((p) => (p.id === paginaAtual.id ? { ...p, titulo, emoji } : p)));
                    setEditandoTituloPagina(false);
                  }}
                />
              </div>
            )}

            {temasDaPagina.length === 0 ? (
              <div className="px-10 py-10 max-w-5xl mx-auto">
                <h1 className="text-2xl font-extrabold text-ink mb-2 flex items-center gap-2">
                  <span>{paginaAtual.emoji || "📄"}</span> {paginaAtual.titulo}
                </h1>
                <p className="text-sm text-ink/40 mb-4">Esse treinamento ainda não tem nenhum tema/aula.</p>
                {souAdmin && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setNovoTemaAberto(true)}
                      className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors"
                    >
                      + Criar primeiro tema
                    </button>
                    <button onClick={() => excluirPagina(paginaAtual.id)} className="text-sm font-semibold text-ink/40 hover:text-red-600">
                      Excluir treinamento
                    </button>
                  </div>
                )}
              </div>
            ) : temaAtivo ? (
              <div className="px-10 py-8 max-w-5xl mx-auto">
                <div className="max-w-3xl">
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <button
                      onClick={() => alternarConcluido(temaAtivo.id)}
                      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                        progresso.has(temaAtivo.id) ? "bg-forest text-mint" : "bg-mint text-forest"
                      }`}
                    >
                      <CheckCircle2 size={17} /> {progresso.has(temaAtivo.id) ? "Aula concluída" : "Marcar como concluída"}
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => indiceTemaAtivo > 0 && abrirTema(paginaAtual.id, temasDaPagina[indiceTemaAtivo - 1].id)}
                        disabled={indiceTemaAtivo <= 0}
                        title="Aula anterior"
                        className="h-10 w-10 rounded-full bg-ink text-white flex items-center justify-center hover:bg-forest transition-colors disabled:opacity-20 disabled:hover:bg-ink"
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <button
                        onClick={() => indiceTemaAtivo < temasDaPagina.length - 1 && abrirTema(paginaAtual.id, temasDaPagina[indiceTemaAtivo + 1].id)}
                        disabled={indiceTemaAtivo >= temasDaPagina.length - 1}
                        title="Próxima aula"
                        className="h-10 w-10 rounded-full bg-ink text-white flex items-center justify-center hover:bg-forest transition-colors disabled:opacity-20 disabled:hover:bg-ink"
                      >
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  </div>

                  <span className="inline-block rounded-full bg-mint text-forest px-3 py-1 text-[11px] font-extrabold tracking-wide mb-3">
                    AULA {indiceTemaAtivo + 1} DE {temasDaPagina.length}
                  </span>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-ink mb-6 pb-5 border-b-4 border-mint inline-block">{temaAtivo.titulo}</h1>
                </div>

                <div className="max-w-3xl">
                  {videosDoTemaAtivo.length > 0 && (
                    <div className={`grid gap-4 mb-6 ${videosDoTemaAtivo.length > 1 ? "sm:grid-cols-2" : "grid-cols-1"}`}>
                      {videosDoTemaAtivo.map((v) => {
                        const embed = embedDeVideo(v.url);
                        return (
                          <div key={v.id} className="group/vid relative rounded-2xl overflow-hidden bg-ink shadow-lg">
                            {embed ? (
                              <div className="aspect-video">
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
                                className="flex items-center gap-2 p-4 text-sm text-mint hover:underline break-all"
                              >
                                <LinkIcon size={14} className="shrink-0" /> {v.url}
                              </a>
                            )}
                            {v.titulo && <p className="px-3 py-2 text-sm font-semibold text-white/90 truncate bg-ink">{v.titulo}</p>}
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

                  {souAdmin && (
                    <div className="flex flex-wrap items-center gap-4 mb-5 pb-4 border-b border-black/5">
                      <button
                        onClick={() => setRenomeandoTema(temaAtivo)}
                        className="text-xs font-semibold text-ink/50 hover:text-ink flex items-center gap-1"
                      >
                        <Pencil size={12} /> Renomear
                      </button>
                      <button
                        onClick={() => setNovoVideoTemaId(temaAtivo.id)}
                        className="text-xs font-semibold text-forest hover:underline flex items-center gap-1"
                      >
                        <Plus size={12} /> Adicionar vídeo
                      </button>
                      <button onClick={() => setTemaEditandoConteudo((v) => !v)} className="text-xs font-semibold text-ink/50 hover:text-ink">
                        {temaEditandoConteudo ? "Ver como ficou" : "Editar texto"}
                      </button>
                      <button onClick={() => setEditandoTituloPagina(true)} className="text-xs font-semibold text-ink/50 hover:text-ink">
                        Renomear treinamento
                      </button>
                      <button onClick={() => excluirPagina(paginaAtual.id)} className="text-xs font-semibold text-ink/50 hover:text-red-600">
                        Excluir treinamento
                      </button>
                      <button
                        onClick={() => excluirTema(temaAtivo.id)}
                        className="text-xs font-semibold text-red-500 hover:underline flex items-center gap-1 ml-auto"
                      >
                        <Trash2 size={12} /> Excluir tema
                      </button>
                    </div>
                  )}

                  {souAdmin && temaEditandoConteudo ? (
                    <RichTextEditor
                      valorHtml={temaAtivo.conteudo ?? ""}
                      onChange={(html) => setTemas((atual) => atual.map((t) => (t.id === temaAtivo.id ? { ...t, conteudo: html } : t)))}
                      onSalvar={() => salvarConteudoTema(temaAtivo.id, temaAtivo.conteudo ?? "")}
                      semCaixa
                      placeholder="Escreva o conteúdo desse tema..."
                    />
                  ) : (
                    <div className="rounded-2xl bg-white border border-black/5 p-6">
                      <ConteudoFormatado html={temaAtivo.conteudo || "<p class='text-ink/35'>Sem texto por aqui ainda.</p>"} />
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {temasDaPagina.length > 0 && (
            <aside className="w-80 shrink-0 border-l border-black/5 bg-white overflow-y-auto scrollbar-fina-clara p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">Seu progresso nesse treinamento</p>
              <p className="text-xl font-extrabold text-forest mb-1.5">{progressoDaPagina(paginaAtual.id).pct}% concluído</p>
              <div className="h-2 rounded-full bg-surface overflow-hidden mb-6">
                <div className="h-full bg-forest rounded-full transition-all duration-500" style={{ width: `${progressoDaPagina(paginaAtual.id).pct}%` }} />
              </div>

              <div className="space-y-1.5">
                {temasDaPagina.map((t, i) => {
                  const feito = progresso.has(t.id);
                  const ativo = t.id === temaAtivoId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => abrirTema(paginaAtual.id, t.id)}
                      className={`w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-2.5 transition-all border ${
                        ativo
                          ? "bg-mint border-forest/20 shadow-sm"
                          : feito
                          ? "bg-mint/25 border-transparent hover:bg-mint/40"
                          : "bg-white border-black/5 hover:border-black/10 hover:bg-surface"
                      }`}
                    >
                      {feito ? (
                        <CheckCircle2 size={19} className="text-forest shrink-0" />
                      ) : ativo ? (
                        <span className="h-[19px] w-[19px] rounded-full bg-forest shrink-0 flex items-center justify-center">
                          <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                        </span>
                      ) : (
                        <Circle size={19} className="text-ink/20 shrink-0" />
                      )}
                      <span className={`text-sm truncate ${ativo ? "font-extrabold text-forest" : feito ? "font-semibold text-forest/80" : "text-ink/70"}`}>
                        {String(i + 1).padStart(2, "0")}. {t.titulo}
                      </span>
                    </button>
                  );
                })}
              </div>

              {souAdmin && (
                <button
                  onClick={() => setNovoTemaAberto(true)}
                  className="w-full mt-3 rounded-xl border-2 border-dashed border-black/10 py-2.5 text-xs font-semibold text-ink/40 hover:text-forest hover:border-forest/30 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus size={13} /> Novo tema
                </button>
              )}
            </aside>
          )}
        </div>
      )}

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
            abrirTema(paginaAtual.id, novo.id);
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
