"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface PlanoConta {
  id: string;
  nome: string;
  tipo: "receita" | "despesa";
  dre_categoria_id: string | null;
}

interface Categoria {
  id: string;
  nome: string;
  grupo: string;
}

const GRUPO_LABEL: Record<string, string> = {
  receita_bruta: "Receita Bruta",
  deducoes: "Deduções",
  custos_vendas: "Custos de Vendas",
  despesas_vendas: "Despesas com Vendas",
  despesas_administrativas: "Despesas Administrativas",
  despesas_financeiras: "Despesas Financeiras",
  receitas_financeiras: "Receitas Financeiras",
  outras_receitas: "Outras Receitas",
  outras_despesas: "Outras Despesas",
  ir_csll: "IR/CSLL",
};

export default function PlanosContaPage() {
  const [planos, setPlanos] = useState<PlanoConta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("planos_conta").select("id, nome, tipo, dre_categoria_id").order("nome"),
      supabase.from("dre_categorias").select("id, nome, grupo").order("grupo").order("ordem"),
    ]);
    setPlanos((p as PlanoConta[]) ?? []);
    setCategorias((c as Categoria[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const receitas = planos.filter((p) => p.tipo === "receita");
  const despesas = planos.filter((p) => p.tipo === "despesa");

  async function remover(id: string) {
    const supabase = createClient();
    await supabase.from("planos_conta").delete().eq("id", id);
    carregar();
  }

  async function atualizarCategoria(id: string, categoriaId: string) {
    const supabase = createClient();
    await supabase.from("planos_conta").update({ dre_categoria_id: categoriaId || null }).eq("id", id);
    carregar();
  }

  if (loading) {
    return <p className="text-sm text-ink/50">Carregando...</p>;
  }

  return (
    <div>
      <p className="text-xs text-ink/50 bg-surface rounded-full px-4 py-2 inline-flex items-center gap-1.5 w-fit mb-6">
        💡 Cada plano de conta pode ser ligado a uma categoria do DRE — assim os lançamentos entram
        automaticamente no relatório. Gerencie as categorias em Financeiro → DRE.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Grupo
          titulo="Receita"
          emoji="💚"
          tipo="receita"
          planos={receitas}
          categorias={categorias.filter((c) => ["receita_bruta", "receitas_financeiras", "outras_receitas"].includes(c.grupo))}
          onChange={carregar}
          onRemover={remover}
          onCategoriaChange={atualizarCategoria}
        />
        <Grupo
          titulo="Despesa"
          emoji="❤️"
          tipo="despesa"
          planos={despesas}
          categorias={categorias.filter((c) =>
            ["deducoes", "custos_vendas", "despesas_vendas", "despesas_administrativas", "despesas_financeiras", "outras_despesas", "ir_csll"].includes(c.grupo)
          )}
          onChange={carregar}
          onRemover={remover}
          onCategoriaChange={atualizarCategoria}
        />
      </div>
    </div>
  );
}

function Grupo({
  titulo,
  emoji,
  tipo,
  planos,
  categorias,
  onChange,
  onRemover,
  onCategoriaChange,
}: {
  titulo: string;
  emoji: string;
  tipo: "receita" | "despesa";
  planos: PlanoConta[];
  categorias: Categoria[];
  onChange: () => void;
  onRemover: (id: string) => void;
  onCategoriaChange: (id: string, categoriaId: string) => void;
}) {
  const [novoNome, setNovoNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setSalvando(true);
    const supabase = createClient();
    await supabase.from("planos_conta").insert({ nome: novoNome.trim(), tipo });
    setNovoNome("");
    setSalvando(false);
    onChange();
  }

  return (
    <section>
      <h2 className="text-sm font-bold text-ink flex items-center gap-2 mb-3">
        <span>{emoji}</span> Plano de conta — {titulo}
      </h2>

      <form onSubmit={adicionar} className="flex gap-2 mb-4">
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          className="input"
          placeholder={`Nova conta de ${titulo.toLowerCase()}...`}
        />
        <button
          type="submit"
          disabled={salvando}
          className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
            tipo === "receita" ? "bg-forest hover:bg-ink" : "bg-red-600 hover:bg-ink"
          }`}
        >
          + {titulo}
        </button>
      </form>

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        {planos.length === 0 ? (
          <p className="p-4 text-sm text-ink/50">Nenhuma conta de {titulo.toLowerCase()} ainda.</p>
        ) : (
          planos.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/5 last:border-0">
              <span className="text-sm font-medium text-ink truncate">{p.nome}</span>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={p.dre_categoria_id ?? ""}
                  onChange={(e) => onCategoriaChange(p.id, e.target.value)}
                  className="input py-1.5 text-xs w-44"
                >
                  <option value="">Sem categoria DRE</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {GRUPO_LABEL[c.grupo]} · {c.nome}
                    </option>
                  ))}
                </select>
                <button onClick={() => onRemover(p.id)} className="text-xs font-semibold text-ink/40 hover:text-red-600">
                  Remover
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
