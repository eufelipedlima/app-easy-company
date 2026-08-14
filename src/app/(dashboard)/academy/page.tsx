"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";
import { RichTextEditor } from "@/components/rich-text-editor";
import { ConteudoFormatado } from "@/components/conteudo-formatado";
import { comLinks } from "@/lib/linkify";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GraduationCap,
  Search,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronLeft,
  GripVertical,
  MoreVertical,
  Move,
  Link as LinkIcon,
  X,
  Lock,
  ArrowLeft,
  CheckCircle2,
  Circle,
  PlayCircle,
  Clock,
  FileText,
  BarChart3,
  BookOpen,
  FolderOpen,
  PenLine,
  MessageCircle,
  Download,
  Upload,
  Send,
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
  descricao: string | null;
  duracaoMin: number | null;
  dificuldade: "iniciante" | "intermediario" | "avancado" | null;
}
interface Pagina {
  id: string;
  categoriaId: string;
  titulo: string;
  emoji: string | null;
  conteudo: string | null;
  ordem: number;
  cargosPermitidos: string[] | null;
}
interface Categoria {
  id: string;
  nome: string;
  emoji: string | null;
  ordem: number;
  cargosPermitidos: string[] | null;
}
interface Material {
  id: string;
  temaId: string;
  nome: string;
  arquivoPath: string;
  arquivoTipo: string | null;
  arquivoTamanho: number | null;
  ordem: number;
}
interface Duvida {
  id: string;
  temaId: string;
  autorId: string;
  texto: string;
  createdAt: string;
}
interface Colega {
  authUserId: string;
  nome: string;
  fotoUrl: string | null;
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

function CategoriaArrastavel({ id, arrastavel, children }: { id: string; arrastavel: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !arrastavel });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="relative group/drag">
      {arrastavel && (
        <button
          {...attributes}
          {...listeners}
          title="Arrastar pra reordenar"
          className="absolute left-0 top-1.5 h-7 w-4 flex items-center justify-center text-white/0 group-hover/drag:text-white/30 hover:!text-white/70 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={13} />
        </button>
      )}
      <div className={arrastavel ? "pl-4" : ""}>{children}</div>
    </div>
  );
}

function PaginaArrastavel({ id, arrastavel, children }: { id: string; arrastavel: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !arrastavel });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="relative group/drag flex items-center">
      {arrastavel && (
        <button
          {...attributes}
          {...listeners}
          title="Arrastar pra reordenar"
          className="h-7 w-4 shrink-0 flex items-center justify-center text-white/0 group-hover/drag:text-white/30 hover:!text-white/70 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={12} />
        </button>
      )}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export default function AcademyPage() {
  const [souAdmin, setSouAdmin] = useState(false);
  const [meuFuncionarioId, setMeuFuncionarioId] = useState<string | null>(null);
  const [meuAuthUserId, setMeuAuthUserId] = useState<string | null>(null);
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
  const [editandoDescricao, setEditandoDescricao] = useState(false);
  const [ultimoAcesso, setUltimoAcesso] = useState<{ paginaId: string; temaId: string } | null>(null);

  const [novaCategoriaAberta, setNovaCategoriaAberta] = useState(false);
  const [editandoCategoria, setEditandoCategoria] = useState<Categoria | null>(null);
  const [novaPaginaCategoriaId, setNovaPaginaCategoriaId] = useState<string | null>(null);
  const [editandoTituloPagina, setEditandoTituloPagina] = useState(false);
  const [novoTemaAberto, setNovoTemaAberto] = useState(false);
  const [renomeandoTema, setRenomeandoTema] = useState<Tema | null>(null);
  const [editandoMetaTema, setEditandoMetaTema] = useState<Tema | null>(null);
  const [menuAcoesAberto, setMenuAcoesAberto] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"conteudo" | "materiais" | "notas" | "duvidas">("conteudo");
  const [colegas, setColegas] = useState<Colega[]>([]);
  const [materiaisTema, setMateriaisTema] = useState<Material[]>([]);
  const [notaPessoal, setNotaPessoal] = useState("");
  const [duvidas, setDuvidas] = useState<Duvida[]>([]);
  const [novaDuvida, setNovaDuvida] = useState("");
  const [enviandoMaterial, setEnviandoMaterial] = useState(false);
  const [novoVideoTemaId, setNovoVideoTemaId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setMeuAuthUserId(user.id);
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

      const { data: colegasData } = await supabase.from("funcionarios").select("auth_user_id, papeis ( pessoas ( nome, apelido, foto_url ) )");
      setColegas(
        ((colegasData ?? []) as unknown as { auth_user_id: string; papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null }[]).map((c) => ({
          authUserId: c.auth_user_id,
          nome: c.papeis?.pessoas?.apelido || c.papeis?.pessoas?.nome || "Colega",
          fotoUrl: c.papeis?.pessoas?.foto_url ?? null,
        }))
      );
    }

    const [{ data: cargosData }, { data: categoriasData }, { data: paginasData }] = await Promise.all([
      supabase.from("cargos").select("id, nome").order("nome"),
      supabase.from("academy_categorias").select("id, nome, emoji, ordem, cargos_permitidos").order("ordem"),
      supabase.from("academy_paginas").select("id, categoria_id, titulo, emoji, conteudo, ordem, cargos_permitidos").order("ordem"),
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
      cargosPermitidos: p.cargos_permitidos,
    }));
    setPaginas(listaPaginas);

    if (listaPaginas.length > 0) {
      const { data: temasData } = await supabase
        .from("academy_temas")
        .select("id, pagina_id, titulo, emoji, conteudo, ordem, descricao, duracao_min, dificuldade")
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
        descricao: t.descricao,
        duracaoMin: t.duracao_min,
        dificuldade: t.dificuldade,
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

  const categoriaVisivelPraMim = useCallback(
    (c: Categoria) =>
      souAdmin || !c.cargosPermitidos || c.cargosPermitidos.length === 0 || (meuCargoId != null && c.cargosPermitidos.includes(meuCargoId)),
    [souAdmin, meuCargoId]
  );

  const paginaVisivelPraMim = useCallback(
    (p: Pagina) => {
      if (souAdmin) return true;
      const cat = categorias.find((c) => c.id === p.categoriaId);
      if (cat && !categoriaVisivelPraMim(cat)) return false;
      return !p.cargosPermitidos || p.cargosPermitidos.length === 0 || (meuCargoId != null && p.cargosPermitidos.includes(meuCargoId));
    },
    [souAdmin, meuCargoId, categorias, categoriaVisivelPraMim]
  );

  const categoriasVisiveis = useMemo(() => {
    if (souAdmin) return categorias;
    return categorias.filter((c) => categoriaVisivelPraMim(c) && paginas.some((p) => p.categoriaId === c.id && paginaVisivelPraMim(p)));
  }, [categorias, souAdmin, paginas, categoriaVisivelPraMim, paginaVisivelPraMim]);

  const paginasPorCategoria = useMemo(() => {
    const mapa = new Map<string, Pagina[]>();
    for (const p of paginas.filter(paginaVisivelPraMim)) mapa.set(p.categoriaId, [...(mapa.get(p.categoriaId) ?? []), p]);
    return mapa;
  }, [paginas, paginaVisivelPraMim]);

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

  async function abrirTema(paginaId: string, temaId: string) {
    setPaginaAtivaId(paginaId);
    setTemaAtivoId(temaId);
    setTemaEditandoConteudo(false);
    setEditandoTituloPagina(false);
    setEditandoDescricao(false);
    setMenuAcoesAberto(false);
    setAbaAtiva("conteudo");
    localStorage.setItem(CHAVE_ULTIMO, JSON.stringify({ paginaId, temaId }));
    setUltimoAcesso({ paginaId, temaId });

    const supabase = createClient();
    const [{ data: materiaisData }, { data: duvidasData }] = await Promise.all([
      supabase
        .from("academy_temas_materiais")
        .select("id, tema_id, nome, arquivo_path, arquivo_tipo, arquivo_tamanho, ordem")
        .eq("tema_id", temaId)
        .order("ordem"),
      supabase.from("academy_temas_duvidas").select("id, tema_id, autor_id, texto, created_at").eq("tema_id", temaId).order("created_at"),
    ]);
    setMateriaisTema(
      (materiaisData ?? []).map((m) => ({
        id: m.id,
        temaId: m.tema_id,
        nome: m.nome,
        arquivoPath: m.arquivo_path,
        arquivoTipo: m.arquivo_tipo,
        arquivoTamanho: m.arquivo_tamanho,
        ordem: m.ordem,
      }))
    );
    setDuvidas((duvidasData ?? []).map((d) => ({ id: d.id, temaId: d.tema_id, autorId: d.autor_id, texto: d.texto, createdAt: d.created_at })));

    if (meuFuncionarioId) {
      const { data: notaData } = await supabase
        .from("academy_temas_notas")
        .select("texto")
        .eq("tema_id", temaId)
        .eq("funcionario_id", meuFuncionarioId)
        .maybeSingle();
      setNotaPessoal(notaData?.texto ?? "");
    } else {
      setNotaPessoal("");
    }
  }

  function selecionarPagina(id: string) {
    setPaginaAtivaId(id);
    setTemaAtivoId(null);
    setEditandoTituloPagina(false);
    setEditandoDescricao(false);
  }

  function voltarPraHome() {
    setPaginaAtivaId(null);
    setTemaAtivoId(null);
  }

  function voltarParaTreinamento() {
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function persistirOrdemCategorias(lista: Categoria[]) {
    const comNovaOrdem = lista.map((c, i) => ({ ...c, ordem: i }));
    setCategorias(comNovaOrdem);
    const supabase = createClient();
    await Promise.all(comNovaOrdem.map((c) => supabase.from("academy_categorias").update({ ordem: c.ordem }).eq("id", c.id)));
  }

  function handleArrastarCategoria(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const lista = [...categorias].sort((a, b) => a.ordem - b.ordem);
    const de = lista.findIndex((c) => c.id === active.id);
    const para = lista.findIndex((c) => c.id === over.id);
    if (de === -1 || para === -1) return;
    persistirOrdemCategorias(arrayMove(lista, de, para));
  }

  async function persistirOrdemPaginas(lista: Pagina[]) {
    const comNovaOrdem = lista.map((p, i) => ({ ...p, ordem: i }));
    setPaginas((atual) => atual.map((p) => comNovaOrdem.find((n) => n.id === p.id) ?? p));
    const supabase = createClient();
    await Promise.all(comNovaOrdem.map((p) => supabase.from("academy_paginas").update({ ordem: p.ordem }).eq("id", p.id)));
  }

  function handleArrastarPagina(categoriaId: string, e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const doGrupo = paginas.filter((p) => p.categoriaId === categoriaId).sort((a, b) => a.ordem - b.ordem);
    const de = doGrupo.findIndex((p) => p.id === active.id);
    const para = doGrupo.findIndex((p) => p.id === over.id);
    if (de === -1 || para === -1) return;
    persistirOrdemPaginas(arrayMove(doGrupo, de, para));
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

  function urlMaterial(arquivoPath: string) {
    const supabase = createClient();
    return supabase.storage.from("academy-materiais").getPublicUrl(arquivoPath).data.publicUrl;
  }

  async function enviarMaterial(arquivo: File) {
    if (!temaAtivoId) return;
    setEnviandoMaterial(true);
    const supabase = createClient();
    const caminho = `${temaAtivoId}/${Date.now()}-${arquivo.name}`;
    const { error: erroUpload } = await supabase.storage.from("academy-materiais").upload(caminho, arquivo);
    if (erroUpload) {
      setEnviandoMaterial(false);
      return;
    }
    const { data, error } = await supabase
      .from("academy_temas_materiais")
      .insert({
        tema_id: temaAtivoId,
        nome: arquivo.name,
        arquivo_path: caminho,
        arquivo_tipo: arquivo.type || null,
        arquivo_tamanho: arquivo.size,
        ordem: materiaisTema.length,
      })
      .select("id")
      .single();
    setEnviandoMaterial(false);
    if (error || !data) return;
    setMateriaisTema((atual) => [
      ...atual,
      { id: data.id, temaId: temaAtivoId, nome: arquivo.name, arquivoPath: caminho, arquivoTipo: arquivo.type || null, arquivoTamanho: arquivo.size, ordem: atual.length },
    ]);
  }

  async function removerMaterial(id: string, arquivoPath: string) {
    const supabase = createClient();
    await supabase.storage.from("academy-materiais").remove([arquivoPath]);
    await supabase.from("academy_temas_materiais").delete().eq("id", id);
    setMateriaisTema((atual) => atual.filter((m) => m.id !== id));
  }

  async function salvarNota() {
    if (!temaAtivoId || !meuFuncionarioId) return;
    const supabase = createClient();
    await supabase
      .from("academy_temas_notas")
      .upsert({ tema_id: temaAtivoId, funcionario_id: meuFuncionarioId, texto: notaPessoal }, { onConflict: "tema_id,funcionario_id" });
  }

  async function enviarDuvida() {
    if (!temaAtivoId || !novaDuvida.trim() || !meuAuthUserId) return;
    const supabase = createClient();
    const texto = novaDuvida.trim();
    const { data, error } = await supabase
      .from("academy_temas_duvidas")
      .insert({ tema_id: temaAtivoId, autor_id: meuAuthUserId, texto })
      .select("id, created_at")
      .single();
    if (error || !data) return;
    setDuvidas((atual) => [...atual, { id: data.id, temaId: temaAtivoId, autorId: meuAuthUserId, texto, createdAt: data.created_at }]);
    setNovaDuvida("");
  }

  function formatarDataHora(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={souAdmin ? handleArrastarCategoria : undefined}>
              <SortableContext items={categoriasVisiveis.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                {categoriasVisiveis.map((cat) => {
                  const paginasCat = (paginasPorCategoria.get(cat.id) ?? []).filter(
                    (p) => !busca || normalizar(p.titulo).includes(normalizar(busca))
                  );
                  if (busca && paginasCat.length === 0) return null;
                  const colapsada = categoriasColapsadas.has(cat.id);
                  return (
                    <CategoriaArrastavel key={cat.id} id={cat.id} arrastavel={souAdmin}>
                      <div className="mb-1 px-3">
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
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={souAdmin ? (e) => handleArrastarPagina(cat.id, e) : undefined}
                            >
                              <SortableContext items={paginasCat.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                                {paginasCat.map((p) => {
                                  const prog = progressoDaPagina(p.id);
                                  return (
                                    <PaginaArrastavel key={p.id} id={p.id} arrastavel={souAdmin}>
                                      <div className="group/pag flex items-center gap-0.5">
                                        <button
                                          onClick={() => selecionarPagina(p.id)}
                                          className={`flex-1 min-w-0 text-left rounded-lg pl-1 pr-2.5 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${
                                            paginaAtivaId === p.id
                                              ? "bg-forest text-white font-semibold"
                                              : "text-white/60 hover:bg-white/5 hover:text-white/90"
                                          }`}
                                        >
                                          <span className="shrink-0">{p.emoji || "📄"}</span>
                                          <span className="truncate flex-1">{p.titulo}</span>
                                          {p.cargosPermitidos && p.cargosPermitidos.length > 0 && <Lock size={10} className="text-white/25 shrink-0" />}
                                          {prog.total > 0 && prog.pct === 100 && <CheckCircle2 size={13} className="text-mint shrink-0" />}
                                        </button>
                                        {souAdmin && (
                                          <button
                                            onClick={() => {
                                              selecionarPagina(p.id);
                                              setEditandoTituloPagina(true);
                                            }}
                                            title="Editar treinamento"
                                            className="opacity-0 group-hover/pag:opacity-100 transition-opacity text-white/40 hover:text-white shrink-0 pr-1"
                                          >
                                            <Pencil size={11} />
                                          </button>
                                        )}
                                      </div>
                                    </PaginaArrastavel>
                                  );
                                })}
                              </SortableContext>
                            </DndContext>
                            {paginasCat.length === 0 && <p className="pl-6 text-xs text-white/25 italic">Sem páginas ainda</p>}
                          </div>
                        )}
                      </div>
                    </CategoriaArrastavel>
                  );
                })}
              </SortableContext>
            </DndContext>
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
              <div className="px-10 py-3 max-w-5xl mx-auto">
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
                      <button onClick={voltarParaTreinamento} className="text-forest font-bold hover:underline">
                        {paginaAtual.titulo}
                      </button>
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
              </div>
            </div>

            {editandoTituloPagina && (
              <div className="px-10 pt-6 max-w-5xl mx-auto">
                <FormTituloPagina
                  pagina={paginaAtual}
                  cargos={cargos}
                  onCancelar={() => setEditandoTituloPagina(false)}
                  onSalvo={(titulo, emoji, cargosPermitidos) => {
                    setPaginas((atual) => atual.map((p) => (p.id === paginaAtual.id ? { ...p, titulo, emoji, cargosPermitidos } : p)));
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
            ) : !temaAtivo ? (
              <div className="px-10 py-8 max-w-5xl mx-auto">
                <div className="max-w-3xl">
                  <button
                    onClick={voltarPraHome}
                    className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white px-4 py-2 text-sm font-bold hover:bg-forest transition-colors mb-6"
                  >
                    <ArrowLeft size={14} /> Voltar pro Academy
                  </button>

                  <div className="relative rounded-3xl bg-white border border-black/5 shadow-sm p-6 mb-8">
                    {souAdmin && (
                      <button
                        onClick={() => excluirPagina(paginaAtual.id)}
                        title="Excluir treinamento"
                        className="absolute top-5 right-5 text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <div className="flex items-center gap-3 mb-2 pr-8">
                      <span className="text-4xl shrink-0">{paginaAtual.emoji || "📄"}</span>
                      <h1 className="text-3xl sm:text-4xl font-extrabold text-ink">{paginaAtual.titulo}</h1>
                    </div>
                    <p className="text-sm text-ink/50 mb-5">
                      {temasDaPagina.length} {temasDaPagina.length === 1 ? "aula" : "aulas"} · {progressoDaPagina(paginaAtual.id).pct}% concluído
                    </p>

                    {souAdmin && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setEditandoTituloPagina(true)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-xs font-bold text-ink/70 hover:bg-mint hover:text-forest transition-colors"
                        >
                          <Pencil size={12} /> Editar treinamento
                        </button>
                        <button
                          onClick={() => setEditandoDescricao((v) => !v)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-xs font-bold text-ink/70 hover:bg-mint hover:text-forest transition-colors"
                        >
                          {editandoDescricao ? "Ver como ficou" : "Editar descrição"}
                        </button>
                      </div>
                    )}
                  </div>

                  {(paginaAtual.conteudo || souAdmin) && (
                    <div className="rounded-2xl bg-white border border-black/5 p-6 mb-8">
                      {souAdmin && editandoDescricao ? (
                        <RichTextEditor
                          valorHtml={paginaAtual.conteudo ?? ""}
                          onChange={(html) => setPaginas((atual) => atual.map((p) => (p.id === paginaAtual.id ? { ...p, conteudo: html } : p)))}
                          onSalvar={async () => {
                            const supabase = createClient();
                            await supabase.from("academy_paginas").update({ conteudo: paginaAtual.conteudo ?? "" }).eq("id", paginaAtual.id);
                          }}
                          semCaixa
                          placeholder="Escreva uma breve descrição: o que a pessoa vai aprender nesse treinamento..."
                        />
                      ) : (
                        <ConteudoFormatado html={paginaAtual.conteudo || "<p class='text-ink/35'>Sem descrição ainda.</p>"} />
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-extrabold text-ink/50 uppercase tracking-wide">Conteúdo do treinamento</p>
                    {souAdmin && (
                      <button
                        onClick={() => setNovoTemaAberto(true)}
                        className="text-xs font-semibold text-forest hover:underline flex items-center gap-1"
                      >
                        <Plus size={12} /> Novo tema
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {temasDaPagina.map((t, i) => {
                      const feito = progresso.has(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => abrirTema(paginaAtual.id, t.id)}
                          className={`w-full text-left rounded-2xl border px-5 py-4 flex items-center gap-4 transition-all hover:shadow-sm hover:-translate-y-0.5 ${
                            feito ? "bg-mint/20 border-mint" : "bg-white border-black/5 hover:border-black/10"
                          }`}
                        >
                          {feito ? (
                            <CheckCircle2 size={22} className="text-forest shrink-0" />
                          ) : (
                            <Circle size={22} className="text-ink/20 shrink-0" />
                          )}
                          <span className={`font-bold flex-1 ${feito ? "text-forest" : "text-ink"}`}>
                            {String(i + 1).padStart(2, "0")}. {t.titulo}
                          </span>
                          <ChevronRight size={16} className="text-ink/30 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-10 py-8 max-w-5xl mx-auto">
                <div className="max-w-3xl">
                  <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                    <button
                      onClick={voltarParaTreinamento}
                      className="inline-flex items-center gap-1.5 rounded-full border-2 border-black/10 text-ink/60 px-4 py-2 text-sm font-bold hover:border-black/20 hover:text-ink transition-colors"
                    >
                      <ArrowLeft size={14} /> Voltar para o treinamento
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => alternarConcluido(temaAtivo.id)}
                        className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                          progresso.has(temaAtivo.id) ? "bg-forest text-mint" : "bg-mint text-forest"
                        }`}
                      >
                        <CheckCircle2 size={17} /> {progresso.has(temaAtivo.id) ? "Aula concluída" : "Marcar como concluída"}
                      </button>
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
                      {souAdmin && (
                        <div className="relative">
                          <button
                            onClick={() => setMenuAcoesAberto((v) => !v)}
                            title="Ações da aula"
                            className="h-10 w-10 rounded-full border-2 border-black/10 text-ink/50 flex items-center justify-center hover:border-black/20 hover:text-ink transition-colors"
                          >
                            <MoreVertical size={17} />
                          </button>
                          {menuAcoesAberto && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setMenuAcoesAberto(false)} />
                              <div className="absolute right-0 top-12 z-20 w-56 rounded-2xl bg-white border border-black/10 shadow-xl py-2">
                                <p className="px-4 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink/35">Ações da aula</p>
                                <button
                                  onClick={() => {
                                    setRenomeandoTema(temaAtivo);
                                    setMenuAcoesAberto(false);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-ink/80 hover:bg-surface transition-colors"
                                >
                                  <Pencil size={14} /> Renomear aula
                                </button>
                                <button
                                  onClick={() => {
                                    setEditandoMetaTema(temaAtivo);
                                    setMenuAcoesAberto(false);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-ink/80 hover:bg-surface transition-colors"
                                >
                                  <FileText size={14} /> Editar detalhes
                                </button>
                                <button
                                  onClick={() => {
                                    setNovoVideoTemaId(temaAtivo.id);
                                    setMenuAcoesAberto(false);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-ink/80 hover:bg-surface transition-colors"
                                >
                                  <PlayCircle size={14} /> Adicionar vídeo
                                </button>
                                <button
                                  onClick={() => {
                                    setAbaAtiva("conteudo");
                                    setTemaEditandoConteudo(true);
                                    setMenuAcoesAberto(false);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-ink/80 hover:bg-surface transition-colors"
                                >
                                  <MoreVertical size={14} className="rotate-90" /> Editar texto
                                </button>
                                <button
                                  onClick={() => {
                                    setEditandoTituloPagina(true);
                                    setMenuAcoesAberto(false);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-ink/80 hover:bg-surface transition-colors"
                                >
                                  <Move size={14} /> Editar treinamento
                                </button>
                                <div className="my-1.5 border-t border-black/5" />
                                <p className="px-4 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-red-400">Zona de perigo</p>
                                <button
                                  onClick={() => {
                                    setMenuAcoesAberto(false);
                                    excluirTema(temaAtivo.id);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 size={14} /> Excluir aula
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-xl bg-mint px-4 py-2 mb-4">
                    <span className="text-forest font-extrabold text-sm tracking-wide">
                      AULA {indiceTemaAtivo + 1} DE {temasDaPagina.length}
                    </span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-ink mb-3">{temaAtivo.titulo}</h1>
                  {temaAtivo.descricao && <p className="text-ink/55 mb-5 leading-relaxed">{temaAtivo.descricao}</p>}

                  <div className="flex flex-wrap items-center gap-2.5 mb-2">
                    {temaAtivo.duracaoMin && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink/60">
                        <Clock size={13} /> {temaAtivo.duracaoMin} min
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink/60">
                      <FileText size={13} /> {videosDoTemaAtivo.length > 0 ? "Vídeo + Texto" : "Só texto"}
                    </span>
                    {temaAtivo.dificuldade && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink/60">
                        <BarChart3 size={13} />{" "}
                        {temaAtivo.dificuldade === "iniciante" ? "Iniciante" : temaAtivo.dificuldade === "avancado" ? "Avançado" : "Intermediário"}
                      </span>
                    )}
                    {souAdmin && (
                      <button
                        onClick={() => setEditandoMetaTema(temaAtivo)}
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-black/15 px-3 py-1.5 text-xs font-semibold text-ink/40 hover:text-forest hover:border-forest/30 transition-colors"
                      >
                        <Pencil size={11} /> Editar detalhes
                      </button>
                    )}
                  </div>
                </div>

                <hr className="max-w-3xl border-t-2 border-black/5 my-8" />

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
                    <div className="flex items-center gap-2 mb-5 pb-4 border-b border-black/5">
                      <button
                        onClick={() => setEditandoMetaTema(temaAtivo)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-xs font-bold text-ink/70 hover:bg-mint hover:text-forest transition-colors"
                      >
                        <Pencil size={12} /> Editar detalhes
                      </button>
                      <button
                        onClick={() => setNovoVideoTemaId(temaAtivo.id)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-xs font-bold text-ink/70 hover:bg-mint hover:text-forest transition-colors"
                      >
                        <PlayCircle size={12} /> Adicionar vídeo
                      </button>
                      <button
                        onClick={() => {
                          setAbaAtiva("conteudo");
                          setTemaEditandoConteudo((v) => !v);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-xs font-bold text-ink/70 hover:bg-mint hover:text-forest transition-colors"
                      >
                        <FileText size={12} /> {temaEditandoConteudo ? "Ver como ficou" : "Adicionar/editar texto"}
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-6 border-b border-black/5 mb-6 overflow-x-auto">
                    {(
                      [
                        { id: "conteudo", label: "Conteúdo", icone: <BookOpen size={15} /> },
                        { id: "materiais", label: "Materiais", icone: <FolderOpen size={15} />, badge: materiaisTema.length },
                        { id: "notas", label: "Notas", icone: <PenLine size={15} />, badge: notaPessoal.trim() ? 1 : 0 },
                        { id: "duvidas", label: "Dúvidas", icone: <MessageCircle size={15} />, badge: duvidas.length },
                      ] as const
                    ).map((aba) => (
                      <button
                        key={aba.id}
                        onClick={() => setAbaAtiva(aba.id)}
                        className={`flex items-center gap-1.5 pb-3 text-sm font-bold border-b-2 -mb-px shrink-0 transition-colors ${
                          abaAtiva === aba.id ? "border-forest text-forest" : "border-transparent text-ink/40 hover:text-ink/70"
                        }`}
                      >
                        {aba.icone} {aba.label}
                        {"badge" in aba && aba.badge > 0 && (
                          <span className="h-4 min-w-4 px-1 rounded-full bg-forest text-white text-[10px] font-bold flex items-center justify-center">
                            {aba.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {abaAtiva === "conteudo" &&
                    (souAdmin && temaEditandoConteudo ? (
                      <RichTextEditor
                        valorHtml={temaAtivo.conteudo ?? ""}
                        onChange={(html) => setTemas((atual) => atual.map((t) => (t.id === temaAtivo.id ? { ...t, conteudo: html } : t)))}
                        onSalvar={() => salvarConteudoTema(temaAtivo.id, temaAtivo.conteudo ?? "")}
                        semCaixa
                        placeholder="Escreva o conteúdo desse tema..."
                      />
                    ) : !temaAtivo.conteudo && videosDoTemaAtivo.length === 0 ? (
                      <div className="rounded-2xl bg-white border border-black/5 p-10 text-center">
                        <div className="h-14 w-14 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4">
                          <FileText size={24} className="text-ink/30" />
                        </div>
                        <p className="font-bold text-ink mb-1">Esta aula ainda não possui conteúdo.</p>
                        <p className="text-sm text-ink/45 mb-6">Adicione textos, vídeos ou outros materiais pra começar.</p>
                        {souAdmin && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto text-left">
                            <div className="rounded-2xl border border-black/5 p-4">
                              <div className="h-9 w-9 rounded-xl bg-mint text-forest flex items-center justify-center mb-3">
                                <FileText size={16} />
                              </div>
                              <p className="font-bold text-sm text-ink mb-1">Adicionar texto</p>
                              <p className="text-xs text-ink/45 mb-3">Escreva explicações e conteúdo pra essa aula.</p>
                              <button
                                onClick={() => setTemaEditandoConteudo(true)}
                                className="text-xs font-bold text-forest hover:underline"
                              >
                                + Adicionar texto
                              </button>
                            </div>
                            <div className="rounded-2xl border border-black/5 p-4">
                              <div className="h-9 w-9 rounded-xl bg-mint text-forest flex items-center justify-center mb-3">
                                <PlayCircle size={16} />
                              </div>
                              <p className="font-bold text-sm text-ink mb-1">Adicionar vídeo</p>
                              <p className="text-xs text-ink/45 mb-3">Cole um link do YouTube, Vimeo ou outras plataformas.</p>
                              <button
                                onClick={() => setNovoVideoTemaId(temaAtivo.id)}
                                className="text-xs font-bold text-forest hover:underline"
                              >
                                + Adicionar vídeo
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-white border border-black/5 p-6">
                        <ConteudoFormatado html={temaAtivo.conteudo || "<p class='text-ink/35'>Sem texto por aqui ainda.</p>"} />
                      </div>
                    ))}

                  {abaAtiva === "materiais" && (
                    <div className="rounded-2xl bg-white border border-black/5 p-6">
                      {souAdmin && (
                        <label className="inline-flex items-center gap-2 rounded-full bg-forest text-white px-4 py-2 text-sm font-semibold cursor-pointer hover:brightness-110 transition-all mb-4">
                          <Upload size={14} /> {enviandoMaterial ? "Enviando..." : "Enviar material"}
                          <input
                            type="file"
                            className="hidden"
                            disabled={enviandoMaterial}
                            onChange={(e) => {
                              const arquivo = e.target.files?.[0];
                              e.target.value = "";
                              if (arquivo) enviarMaterial(arquivo);
                            }}
                          />
                        </label>
                      )}
                      {materiaisTema.length === 0 ? (
                        <p className="text-sm text-ink/40">Nenhum material nessa aula ainda.</p>
                      ) : (
                        <div className="space-y-2">
                          {materiaisTema.map((m) => (
                            <div key={m.id} className="flex items-center gap-3 rounded-xl border border-black/5 px-4 py-3">
                              <FileText size={18} className="text-forest shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-ink truncate">{m.nome}</p>
                                {m.arquivoTamanho != null && <p className="text-xs text-ink/40">{Math.round(m.arquivoTamanho / 1024)} KB</p>}
                              </div>
                              <a
                                href={urlMaterial(m.arquivoPath)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Baixar"
                                className="text-ink/40 hover:text-forest shrink-0"
                              >
                                <Download size={16} />
                              </a>
                              {souAdmin && (
                                <button
                                  onClick={() => removerMaterial(m.id, m.arquivoPath)}
                                  title="Remover"
                                  className="text-ink/30 hover:text-red-600 shrink-0"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {abaAtiva === "notas" && (
                    <div className="rounded-2xl bg-white border border-black/5 p-6">
                      <p className="text-xs text-ink/40 mb-3">Essas anotações são só suas — ninguém mais vê.</p>
                      <textarea
                        value={notaPessoal}
                        onChange={(e) => setNotaPessoal(e.target.value)}
                        onBlur={salvarNota}
                        placeholder="Escreva suas anotações pessoais sobre essa aula..."
                        className="input min-h-40"
                      />
                    </div>
                  )}

                  {abaAtiva === "duvidas" && (
                    <div className="rounded-2xl bg-white border border-black/5 p-6">
                      <div className="flex items-start gap-3 mb-6">
                        <textarea
                          value={novaDuvida}
                          onChange={(e) => setNovaDuvida(e.target.value)}
                          placeholder="Escreva sua dúvida pro time responder..."
                          className="input flex-1 min-h-[4.5rem]"
                        />
                        <button
                          onClick={enviarDuvida}
                          disabled={!novaDuvida.trim()}
                          title="Enviar"
                          className="rounded-full bg-forest text-white h-10 w-10 flex items-center justify-center shrink-0 hover:brightness-110 disabled:opacity-30 transition-all"
                        >
                          <Send size={15} />
                        </button>
                      </div>
                      {duvidas.length === 0 ? (
                        <p className="text-sm text-ink/40">Nenhuma dúvida por aqui ainda — seja o primeiro a perguntar.</p>
                      ) : (
                        <div className="space-y-4">
                          {duvidas.map((d) => {
                            const autor = colegas.find((c) => c.authUserId === d.autorId);
                            const souEu = d.autorId === meuAuthUserId;
                            return (
                              <div key={d.id} className="flex items-start gap-3">
                                <AvatarMini nome={souEu ? meuNome : autor?.nome ?? "Colega"} fotoUrl={souEu ? meuFotoUrl : autor?.fotoUrl} tamanho={32} />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm">
                                    <span className="font-bold text-ink">{souEu ? "Você" : autor?.nome ?? "Colega"}</span>{" "}
                                    <span className="text-ink/30 text-xs">{formatarDataHora(d.createdAt)}</span>
                                  </p>
                                  <p className="text-sm text-ink/70 whitespace-pre-wrap">{comLinks(d.texto, d.id)}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {temaAtivo && temasDaPagina.length > 0 && (
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

              {(() => {
                const concluidos = temasDaPagina.filter((t) => progresso.has(t.id)).length;
                const emAndamento = temaAtivo && !progresso.has(temaAtivo.id) ? 1 : 0;
                const restantes = temasDaPagina.length - concluidos - emAndamento;
                return (
                  <div className="mt-6 pt-5 border-t border-black/5 space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-ink/60">
                        <span className="h-2 w-2 rounded-full bg-forest shrink-0" /> Aulas concluídas
                      </span>
                      <span className="font-bold text-ink">{concluidos}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-ink/60">
                        <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" /> Em andamento
                      </span>
                      <span className="font-bold text-ink">{emAndamento}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-ink/60">
                        <span className="h-2 w-2 rounded-full bg-ink/20 shrink-0" /> Restantes
                      </span>
                      <span className="font-bold text-ink">{restantes}</span>
                    </div>
                  </div>
                );
              })()}
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

      {editandoMetaTema && (
        <ModalMetaTema
          tema={editandoMetaTema}
          onClose={() => setEditandoMetaTema(null)}
          onSalvo={(dados) => {
            setTemas((atual) => atual.map((t) => (t.id === editandoMetaTema.id ? { ...t, ...dados } : t)));
            setEditandoMetaTema(null);
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
  cargos,
  onCancelar,
  onSalvo,
}: {
  pagina: Pagina;
  cargos: Cargo[];
  onCancelar: () => void;
  onSalvo: (titulo: string, emoji: string | null, cargosPermitidos: string[] | null) => void;
}) {
  const [titulo, setTitulo] = useState(pagina.titulo);
  const [emoji, setEmoji] = useState(pagina.emoji ?? "📄");
  const [todosVeem, setTodosVeem] = useState(!pagina.cargosPermitidos || pagina.cargosPermitidos.length === 0);
  const [cargosSelecionados, setCargosSelecionados] = useState<string[]>(pagina.cargosPermitidos ?? []);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternarCargo(id: string) {
    setCargosSelecionados((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }

  async function salvar() {
    if (!titulo.trim()) return;
    if (!todosVeem && cargosSelecionados.length === 0) {
      setErro("Marca pelo menos um cargo, ou deixa em \"Todo mundo\".");
      return;
    }
    setErro(null);
    setSalvando(true);
    const supabase = createClient();
    const cargosFinal = todosVeem ? null : cargosSelecionados;
    await supabase.from("academy_paginas").update({ titulo: titulo.trim(), emoji, cargos_permitidos: cargosFinal }).eq("id", pagina.id);
    setSalvando(false);
    onSalvo(titulo.trim(), emoji, cargosFinal);
  }

  return (
    <div className="mb-6 rounded-2xl border border-black/10 p-4 bg-surface/30">
      <div className="flex items-center gap-2 mb-4">
        <select value={emoji} onChange={(e) => setEmoji(e.target.value)} className="input !w-20 text-lg text-center">
          {EMOJIS_SUGERIDOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input flex-1 text-lg font-bold" autoFocus />
      </div>

      <div className="mb-4">
        <p className="text-sm font-semibold text-ink/70 mb-2">Quem tem acesso a esse treinamento?</p>
        <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={todosVeem}
            onChange={(e) => {
              setTodosVeem(e.target.checked);
              setErro(null);
            }}
          />
          Todo mundo
        </label>
        {!todosVeem && (
          <div className="rounded-xl border border-black/10 p-2 max-h-40 overflow-y-auto space-y-1 bg-white">
            {cargos.length === 0 && <p className="text-xs text-ink/40 px-2 py-1">Nenhum cargo cadastrado ainda.</p>}
            {cargos.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded-lg hover:bg-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={cargosSelecionados.includes(c.id)}
                  onChange={() => {
                    alternarCargo(c.id);
                    setErro(null);
                  }}
                />
                {c.nome}
              </label>
            ))}
          </div>
        )}
        {erro && <p className="text-xs text-red-600 mt-1.5">{erro}</p>}
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
    setErro(null);
  }

  async function salvar() {
    if (!nome.trim()) {
      setErro("Dê um nome pra categoria.");
      return;
    }
    if (!todosVeem && cargosSelecionados.length === 0) {
      setErro("Marca pelo menos um cargo, ou deixa em \"Todo mundo\".");
      return;
    }
    setSalvando(true);
    setErro(null);
    const supabase = createClient();
    const cargosFinal = todosVeem ? null : cargosSelecionados;
    const payload = { nome: nome.trim(), emoji, cargos_permitidos: cargosFinal };
    if (categoria) {
      const { error } = await supabase.from("academy_categorias").update(payload).eq("id", categoria.id);
      setSalvando(false);
      if (error) {
        setErro(error.message);
        return;
      }
      onSalvo({ id: categoria.id, ordem: categoria.ordem, nome: payload.nome, emoji: payload.emoji, cargosPermitidos: cargosFinal });
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
      onSalvo({ id: data.id, ordem: data.ordem, nome: payload.nome, emoji: payload.emoji, cargosPermitidos: cargosFinal });
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
            <input
              type="checkbox"
              checked={todosVeem}
              onChange={(e) => {
                setTodosVeem(e.target.checked);
                setErro(null);
              }}
            />
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
          <p className="text-xs text-ink/35 mt-2">
            Isso restringe a categoria inteira. Cada treinamento dentro dela ainda pode ter sua própria restrição também.
          </p>
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
    onCriada({ id: data.id, categoriaId, titulo: titulo.trim(), emoji, conteudo: "", ordem: ordemInicial, cargosPermitidos: null });
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
    onCriado({
      id: data.id,
      paginaId,
      titulo: titulo.trim(),
      emoji: null,
      conteudo: "",
      ordem: ordemInicial,
      descricao: null,
      duracaoMin: null,
      dificuldade: null,
    });
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

function ModalMetaTema({
  tema,
  onClose,
  onSalvo,
}: {
  tema: Tema;
  onClose: () => void;
  onSalvo: (dados: { descricao: string | null; duracaoMin: number | null; dificuldade: Tema["dificuldade"] }) => void;
}) {
  const [descricao, setDescricao] = useState(tema.descricao ?? "");
  const [duracaoMin, setDuracaoMin] = useState(tema.duracaoMin != null ? String(tema.duracaoMin) : "");
  const [dificuldade, setDificuldade] = useState<Tema["dificuldade"]>(tema.dificuldade);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    const supabase = createClient();
    const dados = {
      descricao: descricao.trim() || null,
      duracaoMin: duracaoMin.trim() ? parseInt(duracaoMin, 10) : null,
      dificuldade,
    };
    await supabase
      .from("academy_temas")
      .update({ descricao: dados.descricao, duracao_min: dados.duracaoMin, dificuldade: dados.dificuldade })
      .eq("id", tema.id);
    setSalvando(false);
    onSalvo(dados);
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-4">Detalhes da aula</h2>

        <label className="block mb-4">
          <span className="block text-sm font-medium text-ink/70 mb-1">Descrição curta (aparece embaixo do título)</span>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Aprenda a criar roteiros estratégicos que prendem a atenção..."
            className="input min-h-20"
            autoFocus
          />
        </label>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Duração (min)</span>
            <input
              type="number"
              min={0}
              value={duracaoMin}
              onChange={(e) => setDuracaoMin(e.target.value)}
              placeholder="Ex: 12"
              className="input"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Dificuldade</span>
            <select
              value={dificuldade ?? ""}
              onChange={(e) => setDificuldade((e.target.value || null) as Tema["dificuldade"])}
              className="input"
            >
              <option value="">Sem definir</option>
              <option value="iniciante">Iniciante</option>
              <option value="intermediario">Intermediário</option>
              <option value="avancado">Avançado</option>
            </select>
          </label>
        </div>

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
