"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RichTextEditor } from "@/components/rich-text-editor";

interface Etapa {
  id: string;
  titulo: string;
  etapa_pai_id: string | null;
  ordem: number;
}
interface EtapaNode extends Etapa {
  filhos: EtapaNode[];
}

function construirArvore(lista: Etapa[]): EtapaNode[] {
  const mapa = new Map<string, EtapaNode>();
  lista.forEach((e) => mapa.set(e.id, { ...e, filhos: [] }));
  const raizes: EtapaNode[] = [];
  lista.forEach((e) => {
    const no = mapa.get(e.id)!;
    if (e.etapa_pai_id && mapa.has(e.etapa_pai_id)) mapa.get(e.etapa_pai_id)!.filhos.push(no);
    else raizes.push(no);
  });
  return raizes;
}

export default function ModeloProjetoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: modelo } = await supabase.from("modelos_projeto").select("nome, descricao").eq("id", id).maybeSingle();
    if (modelo) {
      setNome(modelo.nome);
      setDescricao(modelo.descricao ?? "");
    }
    const { data: etapasData } = await supabase
      .from("modelos_projeto_etapas")
      .select("id, titulo, etapa_pai_id, ordem")
      .eq("modelo_id", id)
      .order("ordem");
    setEtapas(etapasData ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarNome() {
    if (!nome.trim()) return;
    const supabase = createClient();
    await supabase.from("modelos_projeto").update({ nome: nome.trim() }).eq("id", id);
  }

  async function salvarDescricao() {
    const supabase = createClient();
    await supabase.from("modelos_projeto").update({ descricao: descricao || null }).eq("id", id);
  }

  async function adicionarEtapa(paiId: string | null, titulo: string) {
    if (!titulo.trim()) return;
    const supabase = createClient();
    const irmaos = etapas.filter((e) => e.etapa_pai_id === paiId);
    const { data: nova } = await supabase
      .from("modelos_projeto_etapas")
      .insert({ modelo_id: id, etapa_pai_id: paiId, titulo: titulo.trim(), ordem: irmaos.length })
      .select("id, titulo, etapa_pai_id, ordem")
      .single();
    if (nova) {
      setEtapas((atual) => [...atual, nova]);
      if (paiId) setExpandidas((atual) => new Set(atual).add(paiId));
    }
  }

  async function renomearEtapa(etapaId: string, novoTitulo: string) {
    const supabase = createClient();
    await supabase.from("modelos_projeto_etapas").update({ titulo: novoTitulo }).eq("id", etapaId);
    setEtapas((atual) => atual.map((e) => (e.id === etapaId ? { ...e, titulo: novoTitulo } : e)));
  }

  async function excluirEtapa(etapaId: string) {
    const supabase = createClient();
    await supabase.from("modelos_projeto_etapas").delete().eq("id", etapaId);
    setEtapas((atual) => atual.filter((e) => e.id !== etapaId && e.etapa_pai_id !== etapaId));
  }

  const arvore = construirArvore(etapas);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-ink/50">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <button onClick={() => router.push("/configuracoes/modelos-projeto")} className="text-xs font-semibold text-ink/50 hover:text-ink mb-4">
        ← Modelos de Projeto
      </button>

      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 text-violet-700 px-3 py-1 text-xs font-bold uppercase tracking-wide mb-3">
        🗂️ Modelo de Projeto
      </span>

      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onBlur={salvarNome}
        className="text-2xl font-extrabold text-ink w-full mb-4 outline-none focus:bg-white rounded-lg px-1 -mx-1 bg-transparent block"
      />

      <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
        <span className="block text-sm font-bold text-ink mb-2">Descrição padrão</span>
        <p className="text-xs text-ink/40 mb-2">Vai junto quando alguém criar um projeto a partir desse modelo.</p>
        <RichTextEditor valorHtml={descricao} onChange={setDescricao} onSalvar={salvarDescricao} placeholder="Descreva do que se trata esse tipo de projeto..." />
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <span className="block text-sm font-bold text-ink mb-3">Etapas ({etapas.length})</span>
        <div className="space-y-1 mb-3">
          {arvore.map((no) => (
            <NoEtapa
              key={no.id}
              no={no}
              nivel={0}
              expandidas={expandidas}
              onToggle={(nid) =>
                setExpandidas((atual) => {
                  const novo = new Set(atual);
                  if (novo.has(nid)) novo.delete(nid);
                  else novo.add(nid);
                  return novo;
                })
              }
              onRenomear={renomearEtapa}
              onExcluir={excluirEtapa}
              onAdicionarFilho={adicionarEtapa}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-black/5">
          <NovaEtapaInline onAdicionar={(titulo) => adicionarEtapa(null, titulo)} placeholder="+ Adicionar subtarefa" />
          <NovaEtapaInline onAdicionar={(titulo) => adicionarEtapa(null, titulo)} placeholder="+ Adicionar pasta" ehPasta />
        </div>
      </div>
    </main>
  );
}

function NovaEtapaInline({ onAdicionar, placeholder, ehPasta }: { onAdicionar: (titulo: string) => void; placeholder: string; ehPasta?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className={`text-xs font-semibold rounded-full px-3 py-1.5 transition-colors ${
          ehPasta ? "text-violet-600 hover:bg-violet-50" : "text-forest hover:bg-mint"
        }`}
      >
        {ehPasta ? "📁 " : ""}
        {placeholder}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && valor.trim()) {
          onAdicionar(valor.trim());
          setValor("");
          setAberto(false);
        }
        if (e.key === "Escape") setAberto(false);
      }}
      onBlur={() => {
        if (valor.trim()) {
          onAdicionar(valor.trim());
        }
        setValor("");
        setAberto(false);
      }}
      className="input py-1 text-sm flex-1"
      placeholder={ehPasta ? "Nome da pasta..." : "Nome da subtarefa..."}
    />
  );
}

function NoEtapa({
  no,
  nivel,
  expandidas,
  onToggle,
  onRenomear,
  onExcluir,
  onAdicionarFilho,
}: {
  no: EtapaNode;
  nivel: number;
  expandidas: Set<string>;
  onToggle: (id: string) => void;
  onRenomear: (id: string, titulo: string) => void;
  onExcluir: (id: string) => void;
  onAdicionarFilho: (paiId: string, titulo: string) => void;
}) {
  const temFilhos = no.filhos.length > 0;
  const aberto = expandidas.has(no.id);
  const [editando, setEditando] = useState(false);
  const [tituloTemp, setTituloTemp] = useState(no.titulo);

  return (
    <div style={{ marginLeft: nivel * 20 }}>
      <div className="group/etapa flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-surface">
        <button
          onClick={() => onToggle(no.id)}
          className={`h-4 w-4 shrink-0 flex items-center justify-center text-[10px] text-ink/40 ${!temFilhos && "invisible"}`}
        >
          {aberto ? "▾" : "▸"}
        </button>
        <span className="text-sm shrink-0">{temFilhos ? "📁" : "☐"}</span>
        {editando ? (
          <input
            autoFocus
            value={tituloTemp}
            onChange={(e) => setTituloTemp(e.target.value)}
            onBlur={() => {
              if (tituloTemp.trim()) onRenomear(no.id, tituloTemp.trim());
              setEditando(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="input py-0.5 text-sm flex-1"
          />
        ) : (
          <button onClick={() => setEditando(true)} className="text-sm text-ink flex-1 text-left truncate">
            {no.titulo}
          </button>
        )}
        <button
          onClick={() => onAdicionarFilho(no.id, "Nova subtarefa")}
          className="opacity-0 group-hover/etapa:opacity-100 text-ink/30 hover:text-ink text-xs px-1 shrink-0"
          title="Adicionar dentro dessa pasta"
        >
          +
        </button>
        <button
          onClick={() => onExcluir(no.id)}
          className="opacity-0 group-hover/etapa:opacity-100 text-ink/30 hover:text-red-600 text-xs px-1 shrink-0"
        >
          ✕
        </button>
      </div>
      {aberto && temFilhos && (
        <div className="space-y-1 mt-0.5">
          {no.filhos.map((filho) => (
            <NoEtapa
              key={filho.id}
              no={filho}
              nivel={nivel + 1}
              expandidas={expandidas}
              onToggle={onToggle}
              onRenomear={onRenomear}
              onExcluir={onExcluir}
              onAdicionarFilho={onAdicionarFilho}
            />
          ))}
        </div>
      )}
    </div>
  );
}
