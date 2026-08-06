"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RichTextEditor } from "@/components/rich-text-editor";
import { BuscaCliente, type OpcaoCliente } from "@/components/busca-cliente";

interface Doc {
  id: string;
  titulo: string;
  conteudo: string | null;
  emoji: string | null;
  cliente_id: string | null;
  doc_pai_id: string | null;
  criado_por: string | null;
  atualizado_por: string | null;
  created_at: string;
  updated_at: string;
  excluido_em: string | null;
  excluido_por: string | null;
}

interface HistoricoItem {
  id: string;
  autor_id: string | null;
  descricao: string;
  created_at: string;
}

interface DocResumo {
  id: string;
  titulo: string;
  doc_pai_id: string | null;
  emoji: string | null;
}

interface DocNode extends DocResumo {
  filhos: DocNode[];
}

const DOC_EMOJIS = [
  "📄", "📝", "📋", "📌", "🔒", "🔑", "💻", "📊", "📁", "📎",
  "🎨", "🚀", "💡", "📢", "🗓️", "✅", "⚙️", "💰", "🔗", "🖼️",
  "📷", "🎯", "🧩", "📞", "🏢", "🌐", "⭐", "🔥", "📈", "🛠️",
];

function formatarQuando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function construirArvore(lista: DocResumo[]): DocNode[] {
  const mapa = new Map<string, DocNode>();
  lista.forEach((d) => mapa.set(d.id, { ...d, filhos: [] }));
  const raizes: DocNode[] = [];
  lista.forEach((d) => {
    const node = mapa.get(d.id)!;
    if (d.doc_pai_id && mapa.has(d.doc_pai_id)) {
      mapa.get(d.doc_pai_id)!.filhos.push(node);
    } else {
      raizes.push(node);
    }
  });
  return raizes;
}

function ancestrais(lista: DocResumo[], docId: string): string[] {
  const mapa = new Map(lista.map((d) => [d.id, d]));
  const resultado: string[] = [];
  let atual = mapa.get(docId);
  while (atual?.doc_pai_id) {
    resultado.push(atual.doc_pai_id);
    atual = mapa.get(atual.doc_pai_id);
  }
  return resultado;
}

export default function DocDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [doc, setDoc] = useState<Doc | null>(null);
  const [docsDoEscopo, setDocsDoEscopo] = useState<DocResumo[]>([]);
  const [clientes, setClientes] = useState<OpcaoCliente[]>([]);
  const [colegas, setColegas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [meuId, setMeuId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [seletorClienteAberto, setSeletorClienteAberto] = useState(false);
  const [seletorEmojiAberto, setSeletorEmojiAberto] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [conteudo, setConteudo] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<OpcaoCliente | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregarDocsDoEscopo = useCallback(async (clienteId: string | null) => {
    const supabase = createClient();
    let query = supabase.from("docs").select("id, titulo, doc_pai_id, emoji").is("excluido_em", null);
    query = clienteId ? query.eq("cliente_id", clienteId) : query.is("cliente_id", null);
    const { data } = await query.order("created_at");
    setDocsDoEscopo(data ?? []);
    return data ?? [];
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setMeuId(user?.id ?? null);

    const [{ data: d }, { data: clientesData }, { data: funcData }] = await Promise.all([
      supabase.from("docs").select("*").eq("id", id).maybeSingle(),
      supabase.from("clientes").select("id, papeis ( pessoas ( nome ) )"),
      supabase.from("funcionarios").select("auth_user_id, papeis ( pessoas ( nome, apelido ) )").not("auth_user_id", "is", null),
    ]);

    const listaClientes = ((clientesData ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[])
      .map((c) => ({ id: c.id, nome: c.papeis?.pessoas?.nome ?? "—" }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setClientes(listaClientes);

    const mapaColegas: Record<string, string> = {};
    for (const f of (funcData ?? []) as unknown as { auth_user_id: string; papeis: { pessoas: { nome: string; apelido: string | null } | null } | null }[]) {
      mapaColegas[f.auth_user_id] = f.papeis?.pessoas?.apelido || f.papeis?.pessoas?.nome || "Alguém";
    }
    setColegas(mapaColegas);

    if (d) {
      setDoc(d);
      setTitulo(d.titulo);
      setEmoji(d.emoji);
      setConteudo(d.conteudo ?? "");
      setClienteSelecionado(d.cliente_id ? listaClientes.find((c) => c.id === d.cliente_id) ?? null : null);

      const escopo = await carregarDocsDoEscopo(d.cliente_id);
      setExpandidos(new Set(ancestrais(escopo, d.id)));

      const { data: historicoData } = await supabase
        .from("docs_historico")
        .select("id, autor_id, descricao, created_at")
        .eq("doc_id", d.id)
        .order("created_at", { ascending: false });
      setHistorico(historicoData ?? []);
    }
    setLoading(false);
  }, [id, carregarDocsDoEscopo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function registrarHistorico(descricaoEvento: string) {
    const supabase = createClient();
    await supabase.from("docs_historico").insert({ doc_id: id, autor_id: meuId, descricao: descricaoEvento });
    setHistorico((atual) => [
      { id: `temp-${Date.now()}`, autor_id: meuId, descricao: descricaoEvento, created_at: new Date().toISOString() },
      ...atual,
    ]);
  }

  async function salvarCampo(campo: Record<string, string | null>, eventoHistorico?: string) {
    setSalvando(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("docs")
      .update({ ...campo, atualizado_por: user?.id ?? null })
      .eq("id", id);
    setSalvando(false);
    setDoc((atual) => (atual ? { ...atual, ...campo, updated_at: new Date().toISOString() } : atual));
    if ("titulo" in campo) {
      setDocsDoEscopo((atual) => atual.map((d) => (d.id === id ? { ...d, titulo: campo.titulo || d.titulo } : d)));
    }
    if (eventoHistorico) registrarHistorico(eventoHistorico);
  }

  async function excluirDoc() {
    if (!window.confirm(`Mover "${doc?.titulo}" (e as sub-páginas dela) pra lixeira? Um administrador pode restaurar em até 30 dias.`)) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    function descendentes(paiId: string): string[] {
      const filhos = docsDoEscopo.filter((d) => d.doc_pai_id === paiId);
      return filhos.flatMap((f) => [f.id, ...descendentes(f.id)]);
    }
    const ids = [id, ...descendentes(id)];
    await supabase.from("docs").update({ excluido_em: new Date().toISOString(), excluido_por: user?.id ?? null }).in("id", ids);
    router.push("/docs");
  }

  async function restaurarDoc() {
    const supabase = createClient();
    function descendentes(paiId: string): string[] {
      const filhos = docsDoEscopo.filter((d) => d.doc_pai_id === paiId);
      return filhos.flatMap((f) => [f.id, ...descendentes(f.id)]);
    }
    const ids = [id, ...descendentes(id)];
    await supabase.from("docs").update({ excluido_em: null, excluido_por: null }).in("id", ids);
    setDoc((atual) => (atual ? { ...atual, excluido_em: null, excluido_por: null } : atual));
  }

  async function excluirDocDefinitivo() {
    if (!window.confirm("Excluir esse doc definitivamente, sem volta nenhuma?")) return;
    const supabase = createClient();
    await supabase.from("docs").delete().eq("id", id);
    router.push("/configuracoes/lixeira");
  }

  async function adicionarPagina(docPaiId: string | null) {
    const tituloNovo = window.prompt("Nome da nova página:");
    if (!tituloNovo || !tituloNovo.trim() || !doc) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: nova } = await supabase
      .from("docs")
      .insert({
        titulo: tituloNovo.trim(),
        cliente_id: doc.cliente_id,
        doc_pai_id: docPaiId,
        criado_por: user?.id ?? null,
        atualizado_por: user?.id ?? null,
      })
      .select("id")
      .single();
    if (nova) {
      if (docPaiId) setExpandidos((atual) => new Set(atual).add(docPaiId));
      router.push(`/docs/${nova.id}`);
    }
  }

  function alternarExpandir(docId: string) {
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(docId)) novo.delete(docId);
      else novo.add(docId);
      return novo;
    });
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-ink/50">Carregando...</p>
      </main>
    );
  }

  if (!doc) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-ink/50">Doc não encontrado.</p>
      </main>
    );
  }

  const arvore = construirArvore(docsDoEscopo);
  const nomeEscopo = clienteSelecionado?.nome ?? "Docs internos";

  return (
    <main className="h-screen flex flex-col bg-surface/30">
      <div className="px-8 py-4 flex items-center justify-between bg-white shrink-0">
        <button
          onClick={() => router.push("/docs")}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white px-4 py-2 text-sm font-bold hover:bg-forest transition-colors"
        >
          ← Docs
        </button>
        <div className="flex items-center gap-3">
          {salvando && <span className="text-xs text-ink/40">Salvando...</span>}
          {!doc.excluido_em && (
            <button onClick={excluirDoc} className="text-sm font-semibold text-red-500 hover:text-red-700">
              Excluir
            </button>
          )}
        </div>
      </div>

      {doc.excluido_em && (
        <div className="mx-8 mt-4 rounded-2xl bg-red-50 border-2 border-red-200 px-5 py-3.5 flex items-center justify-between flex-wrap gap-3 shrink-0">
          <p className="text-sm font-bold text-red-700">
            🗑️ Excluído em {formatarQuando(doc.excluido_em)}
            {doc.excluido_por && colegas[doc.excluido_por] && ` por ${colegas[doc.excluido_por]}`}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={restaurarDoc} className="rounded-full bg-forest text-white px-4 py-1.5 text-xs font-semibold hover:brightness-110 transition">
              Restaurar
            </button>
            <button
              onClick={excluirDocDefinitivo}
              className="rounded-full border-2 border-red-300 text-red-700 px-4 py-1.5 text-xs font-semibold hover:bg-red-100 transition"
            >
              Excluir de vez
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 shrink-0 border-r border-black/5 bg-card flex flex-col">
          <div className="px-4 py-4 border-b border-black/5">
            <p className="text-xs font-bold uppercase tracking-wide text-ink/40 truncate">{nomeEscopo}</p>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {arvore.map((node) => (
              <ItemArvoreDoc
                key={node.id}
                node={node}
                nivel={0}
                docAtivoId={id}
                expandidos={expandidos}
                onToggleExpandir={alternarExpandir}
                onAbrir={(docId) => router.push(`/docs/${docId}`)}
                onAdicionarFilho={adicionarPagina}
              />
            ))}
          </div>
          <div className="px-2 py-3 border-t border-black/5">
            <button
              onClick={() => adicionarPagina(null)}
              className="w-full text-left px-2 py-2 rounded-lg text-sm font-semibold text-ink/50 hover:text-ink hover:bg-surface transition-colors"
            >
              + Adicionar página
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-8">
            <div className="relative w-fit mb-2">
              <button
                onClick={() => setSeletorEmojiAberto((v) => !v)}
                className="h-14 w-14 rounded-2xl bg-surface hover:bg-black/5 flex items-center justify-center text-3xl transition-colors"
                title="Escolher ícone"
              >
                {emoji || "📄"}
              </button>
              {seletorEmojiAberto && (
                <div
                  className="absolute z-20 top-16 left-0 w-64 rounded-2xl bg-white border border-black/10 shadow-lg p-2 grid grid-cols-8 gap-1"
                  onMouseLeave={() => setSeletorEmojiAberto(false)}
                >
                  {emoji && (
                    <button
                      onClick={() => {
                        setEmoji(null);
                        salvarCampo({ emoji: null }, "removeu o ícone");
                        setSeletorEmojiAberto(false);
                      }}
                      className="col-span-8 text-xs text-ink/50 hover:text-red-600 text-left px-1 pb-1"
                    >
                      Remover ícone
                    </button>
                  )}
                  {DOC_EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => {
                        setEmoji(e);
                        salvarCampo({ emoji: e }, "mudou o ícone do documento");
                        setSeletorEmojiAberto(false);
                      }}
                      className="text-lg hover:bg-surface rounded-lg h-8 w-8 flex items-center justify-center"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onBlur={() => {
                if (titulo.trim() && titulo.trim() !== doc.titulo) salvarCampo({ titulo: titulo.trim() }, `renomeou para "${titulo.trim()}"`);
              }}
              className="text-3xl font-extrabold text-ink w-full mb-3 outline-none focus:bg-white rounded-lg px-1 -mx-1 bg-transparent"
            />

            <div className="flex items-center gap-3 mb-8 text-xs text-ink/40">
              <span>
                Atualizado em {formatarQuando(doc.updated_at)}
                {doc.atualizado_por && colegas[doc.atualizado_por] && ` por ${colegas[doc.atualizado_por]}`}
              </span>
              <span className="text-ink/20">·</span>
              <div className="relative">
                <button
                  onClick={() => setSeletorClienteAberto((v) => !v)}
                  className="hover:text-ink transition-colors"
                >
                  {clienteSelecionado ? clienteSelecionado.nome : "+ Vincular a um cliente"}
                </button>
                {seletorClienteAberto && (
                  <div
                    className="absolute z-20 top-6 left-0 w-64 rounded-2xl bg-white border border-black/10 shadow-lg p-3"
                    onMouseLeave={() => setSeletorClienteAberto(false)}
                  >
                    <BuscaCliente
                      clientes={clientes}
                      valor={clienteSelecionado}
                      onSelecionar={async (c) => {
                        setClienteSelecionado(c);
                        await salvarCampo({ cliente_id: c?.id ?? null }, c ? `mudou o cliente para ${c.nome}` : "removeu o cliente");
                        const escopo = await carregarDocsDoEscopo(c?.id ?? null);
                        setExpandidos(new Set(ancestrais(escopo, id)));
                        setSeletorClienteAberto(false);
                      }}
                      placeholder="Digite pra buscar (deixe em branco = interno)..."
                    />
                  </div>
                )}
              </div>
              <div className="relative ml-auto">
                <button
                  onClick={() => setHistoricoAberto((v) => !v)}
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-base transition-colors ${
                    historicoAberto ? "bg-ink text-white" : "bg-surface text-ink/60 hover:bg-black/10 hover:text-ink"
                  }`}
                  title="Histórico de alterações"
                >
                  🕐
                </button>
                {historicoAberto && (
                  <div
                    className="absolute z-20 top-10 right-0 w-72 max-h-80 overflow-y-auto rounded-2xl bg-white border border-black/10 shadow-lg p-3"
                    onMouseLeave={() => setHistoricoAberto(false)}
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">Histórico</p>
                    {historico.length === 0 ? (
                      <p className="text-xs text-ink/40">Nenhuma alteração registrada ainda.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {historico.map((h) => (
                          <div key={h.id} className="text-xs text-ink/60 border-l-2 border-black/10 pl-2.5 py-0.5">
                            <span className="font-semibold text-ink">{(h.autor_id && colegas[h.autor_id]) || "Alguém"}</span> {h.descricao}
                            <span className="block text-[10px] text-ink/40 mt-0.5">{formatarQuando(h.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <RichTextEditor
              valorHtml={conteudo}
              onChange={setConteudo}
              onSalvar={() => salvarCampo({ conteudo: conteudo || null }, "atualizou o conteúdo")}
              placeholder="Escreva aqui... anotações de reunião, links importantes, entregáveis, inspirações..."
              semCaixa
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function ItemArvoreDoc({
  node,
  nivel,
  docAtivoId,
  expandidos,
  onToggleExpandir,
  onAbrir,
  onAdicionarFilho,
}: {
  node: DocNode;
  nivel: number;
  docAtivoId: string;
  expandidos: Set<string>;
  onToggleExpandir: (id: string) => void;
  onAbrir: (id: string) => void;
  onAdicionarFilho: (paiId: string) => void;
}) {
  const temFilhos = node.filhos.length > 0;
  const expandido = expandidos.has(node.id);
  const ativo = node.id === docAtivoId;

  return (
    <div>
      <div
        onClick={() => onAbrir(node.id)}
        className={`group/item flex items-center gap-1 rounded-lg py-1.5 pr-1 cursor-pointer transition-colors ${
          ativo ? "bg-mint" : "hover:bg-surface"
        }`}
        style={{ paddingLeft: 8 + nivel * 16 }}
      >
        {temFilhos ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpandir(node.id);
            }}
            className="h-5 w-5 rounded-md flex items-center justify-center shrink-0 text-ink/50 hover:text-ink hover:bg-black/10 transition-colors text-xs"
          >
            {expandido ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <span className={`flex-1 text-sm truncate flex items-center gap-1.5 ${ativo ? "font-semibold text-forest" : "text-ink"}`}>
          {node.emoji || "📄"} {node.titulo}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdicionarFilho(node.id);
          }}
          className="opacity-0 group-hover/item:opacity-100 text-ink/30 hover:text-ink text-xs shrink-0 px-1"
          title="Adicionar sub-página"
        >
          +
        </button>
      </div>
      {expandido &&
        node.filhos.map((filho) => (
          <ItemArvoreDoc
            key={filho.id}
            node={filho}
            nivel={nivel + 1}
            docAtivoId={docAtivoId}
            expandidos={expandidos}
            onToggleExpandir={onToggleExpandir}
            onAbrir={onAbrir}
            onAdicionarFilho={onAdicionarFilho}
          />
        ))}
    </div>
  );
}
