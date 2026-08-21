"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";
import { corDoStatus, PALETA_CORES } from "@/lib/status-conteudo";
import { BuscaCliente, type OpcaoCliente } from "@/components/busca-cliente";
import { LayoutGrid, List as ListIcon } from "lucide-react";

interface Categoria {
  id: string;
  nome: string;
  cor: string;
}

interface Doc {
  id: string;
  titulo: string;
  emoji: string | null;
  conteudo: string | null;
  cliente_id: string | null;
  categoria_id: string | null;
  created_at: string;
  updated_at: string;
  clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
}

function formatarQuando(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function resumoTexto(html: string | null, tamanho = 90): string {
  if (!html) return "";
  const texto = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return texto.length > tamanho ? texto.slice(0, tamanho) + "…" : texto;
}

export default function DocsPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [subdocsPorPai, setSubdocsPorPai] = useState<Record<string, number>>({});
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [clientes, setClientes] = useState<OpcaoCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [clienteFiltroId, setClienteFiltroId] = useState("");
  const [categoriaFiltroId, setCategoriaFiltroId] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);
  const [visualizacao, setVisualizacao] = useState<"lista" | "grade">("lista");

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from("docs")
      .select("id, titulo, emoji, conteudo, cliente_id, categoria_id, created_at, updated_at, clientes ( papeis ( pessoas ( nome ) ) )")
      .is("doc_pai_id", null)
      .is("excluido_em", null)
      .order("updated_at", { ascending: false });
    if (clienteFiltroId === "internos") query = query.is("cliente_id", null);
    else if (clienteFiltroId) query = query.eq("cliente_id", clienteFiltroId);
    if (categoriaFiltroId) query = query.eq("categoria_id", categoriaFiltroId);
    const { data } = await query;
    const lista = (data as unknown as Doc[]) ?? [];
    setDocs(lista);

    if (lista.length > 0) {
      const { data: subs } = await supabase.from("docs").select("doc_pai_id").in("doc_pai_id", lista.map((d) => d.id)).is("excluido_em", null);
      const mapa: Record<string, number> = {};
      for (const s of subs ?? []) {
        if (s.doc_pai_id) mapa[s.doc_pai_id] = (mapa[s.doc_pai_id] ?? 0) + 1;
      }
      setSubdocsPorPai(mapa);
    } else {
      setSubdocsPorPai({});
    }
    setLoading(false);
  }, [clienteFiltroId, categoriaFiltroId]);

  useEffect(() => {
    async function carregarClientes() {
      const supabase = createClient();
      const { data } = await supabase.from("clientes").select("id, papeis ( pessoas ( nome ) )");
      const lista = ((data ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[])
        .map((c) => ({ id: c.id, nome: c.papeis?.pessoas?.nome ?? "—" }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      setClientes(lista);
    }
    async function carregarCategorias() {
      const supabase = createClient();
      const { data } = await supabase.from("doc_categorias").select("id, nome, cor").order("nome");
      setCategorias(data ?? []);
    }
    carregarClientes();
    carregarCategorias();
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarDoc() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("docs")
      .insert({
        titulo: "Documento sem título",
        cliente_id: clienteFiltroId && clienteFiltroId !== "internos" ? clienteFiltroId : null,
        categoria_id: categoriaFiltroId || null,
        criado_por: user?.id ?? null,
        atualizado_por: user?.id ?? null,
      })
      .select("id")
      .single();
    if (!error && data) router.push(`/docs/${data.id}`);
  }

  const docsFiltrados = docs.filter((d) => normalizar(d.titulo).includes(normalizar(busca)));

  return (
    <main className="w-full px-6 sm:px-8 lg:px-10 py-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink mb-1">Docs</h1>
          <p className="text-sm text-ink/60">Organize e acesse todos os documentos importantes da sua empresa.</p>
        </div>
        <button
          onClick={() => setNovoAberto(true)}
          className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors shrink-0"
        >
          + Novo documento
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="🔍 Buscar documentos..."
          className="input py-2 flex-1 min-w-[220px]"
        />
        <select value={clienteFiltroId} onChange={(e) => setClienteFiltroId(e.target.value)} className="input py-2 !w-auto">
          <option value="">Todos os clientes</option>
          <option value="internos">Internos (sem cliente)</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <select value={categoriaFiltroId} onChange={(e) => setCategoriaFiltroId(e.target.value)} className="input py-2 !w-auto">
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1 shrink-0">
          <button
            onClick={() => setVisualizacao("grade")}
            title="Ver em grade"
            className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${
              visualizacao === "grade" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
            }`}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setVisualizacao("lista")}
            title="Ver em lista"
            className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${
              visualizacao === "lista" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
            }`}
          >
            <ListIcon size={15} />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink/50">Carregando...</p>
      ) : docsFiltrados.length === 0 ? (
        <p className="text-sm text-ink/50">Nenhum doc encontrado.</p>
      ) : visualizacao === "grade" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {docsFiltrados.map((d) => {
            const categoria = categorias.find((c) => c.id === d.categoria_id);
            const qtdSub = subdocsPorPai[d.id] ?? 0;
            const resumo = resumoTexto(d.conteudo, 70);
            return (
              <button
                key={d.id}
                onClick={() => router.push(`/docs/${d.id}`)}
                className="flex flex-col text-left rounded-2xl bg-card border border-black/5 p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="h-11 w-11 rounded-xl bg-surface flex items-center justify-center text-xl shrink-0">{d.emoji || "📄"}</span>
                  {qtdSub > 0 && (
                    <span className="text-[11px] font-semibold text-ink/40 shrink-0">{qtdSub} sub-doc{qtdSub > 1 ? "s" : ""}</span>
                  )}
                </div>
                <p className="text-sm font-bold text-ink truncate">{d.titulo}</p>
                <p className="text-xs text-ink/40 truncate mt-0.5">{resumo || (d.clientes?.papeis?.pessoas?.nome ?? "Interno")}</p>
                {categoria && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold w-fit max-w-full truncate mt-3 ${corDoStatus(categoria.cor).cor}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${corDoStatus(categoria.cor).dot}`} />
                    {categoria.nome}
                  </span>
                )}
                <div className="mt-auto pt-3 border-t border-black/5 text-[11px] text-ink/40 flex items-center justify-between">
                  <span>Atualizado {formatarQuando(d.updated_at)}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
          <div className="grid grid-cols-[1fr_140px_110px_110px_90px] gap-3 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink/40 bg-surface/60">
            <span>Nome</span>
            <span>Categoria</span>
            <span>Criado em</span>
            <span>Atualizado em</span>
            <span>Sub-docs</span>
          </div>
          {docsFiltrados.map((d) => {
            const categoria = categorias.find((c) => c.id === d.categoria_id);
            const qtdSub = subdocsPorPai[d.id] ?? 0;
            const resumo = resumoTexto(d.conteudo);
            return (
              <button
                key={d.id}
                onClick={() => router.push(`/docs/${d.id}`)}
                className="w-full grid grid-cols-[1fr_140px_110px_110px_90px] gap-3 items-center px-5 py-3.5 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors text-left"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="h-9 w-9 rounded-xl bg-surface flex items-center justify-center text-lg shrink-0">{d.emoji || "📄"}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-ink truncate">{d.titulo}</span>
                    <span className="block text-xs text-ink/40 truncate">
                      {resumo || (d.clientes?.papeis?.pessoas?.nome ?? "Interno")}
                    </span>
                  </span>
                </span>
                <span>
                  {categoria ? (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold w-fit ${corDoStatus(categoria.cor).cor}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${corDoStatus(categoria.cor).dot}`} />
                      {categoria.nome}
                    </span>
                  ) : (
                    <span className="text-xs text-ink/30">—</span>
                  )}
                </span>
                <span className="text-xs text-ink/50">{formatarQuando(d.created_at)}</span>
                <span className="text-xs text-ink/50">{formatarQuando(d.updated_at)}</span>
                <span className="text-xs text-ink/50">{qtdSub > 0 ? qtdSub : "—"}</span>
              </button>
            );
          })}
        </div>
      )}

      {novoAberto && (
        <NovoDocModal
          clientes={clientes}
          categorias={categorias}
          clienteFixoId={clienteFiltroId && clienteFiltroId !== "internos" ? clienteFiltroId : null}
          categoriaFixaId={categoriaFiltroId || null}
          onCategoriaCriada={(nova) => setCategorias((atual) => [...atual, nova].sort((a, b) => a.nome.localeCompare(b.nome)))}
          onClose={() => setNovoAberto(false)}
          onCriado={(id) => router.push(`/docs/${id}`)}
        />
      )}
    </main>
  );
}

function NovoDocModal({
  clientes,
  categorias,
  clienteFixoId,
  categoriaFixaId,
  onCategoriaCriada,
  onClose,
  onCriado,
}: {
  clientes: OpcaoCliente[];
  categorias: Categoria[];
  clienteFixoId: string | null;
  categoriaFixaId: string | null;
  onCategoriaCriada: (c: Categoria) => void;
  onClose: () => void;
  onCriado: (id: string) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<OpcaoCliente | null>(
    clienteFixoId ? clientes.find((c) => c.id === clienteFixoId) ?? null : null
  );
  const [categoriaId, setCategoriaId] = useState(categoriaFixaId ?? "");
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [criandoCategoria, setCriandoCategoria] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const CORES_DISPONIVEIS = Object.keys(PALETA_CORES);

  async function criarCategoria() {
    if (!novaCategoriaNome.trim()) return;
    setCriandoCategoria(true);
    const supabase = createClient();
    const corAleatoria = CORES_DISPONIVEIS[Math.floor(Math.random() * CORES_DISPONIVEIS.length)];
    const { data, error } = await supabase
      .from("doc_categorias")
      .insert({ nome: novaCategoriaNome.trim(), cor: corAleatoria })
      .select("id, nome, cor")
      .single();
    setCriandoCategoria(false);
    if (error || !data) {
      setErro(error?.code === "23505" ? "Já existe uma categoria com esse nome." : error?.message ?? "Erro ao criar categoria.");
      return;
    }
    onCategoriaCriada(data);
    setCategoriaId(data.id);
    setNovaCategoriaNome("");
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) {
      setErro("Dê um título pro doc.");
      return;
    }
    setSaving(true);
    setErro(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("docs")
      .insert({
        titulo: titulo.trim(),
        cliente_id: clienteSelecionado?.id ?? null,
        categoria_id: categoriaId || null,
        criado_por: user?.id ?? null,
        atualizado_por: user?.id ?? null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      setErro(error?.message ?? "Erro ao criar doc.");
      return;
    }
    onCriado(data.id);
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-4">Novo documento</h2>
        <form onSubmit={criar} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Título *</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input" autoFocus required />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Cliente</span>
            <BuscaCliente
              clientes={clientes}
              valor={clienteSelecionado}
              onSelecionar={setClienteSelecionado}
              placeholder="Digite pra buscar (deixe em branco = interno)..."
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Categoria</span>
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="input mb-2">
              <option value="">Sem categoria</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input
                value={novaCategoriaNome}
                onChange={(e) => setNovaCategoriaNome(e.target.value)}
                placeholder="Ou crie uma categoria nova..."
                className="input !py-1.5 text-xs flex-1"
              />
              <button
                type="button"
                onClick={criarCategoria}
                disabled={criandoCategoria || !novaCategoriaNome.trim()}
                className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-ink hover:text-white transition-colors disabled:opacity-40"
              >
                + Criar
              </button>
            </div>
          </label>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
            >
              {saving ? "Criando..." : "Criar e abrir"}
            </button>
            <button type="button" onClick={onClose} className="text-sm font-semibold text-ink/60 hover:text-ink">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
