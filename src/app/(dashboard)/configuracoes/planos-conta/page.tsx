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

const GRUPOS_RECEITA = ["receita_bruta", "receitas_financeiras", "outras_receitas"];
const GRUPOS_DESPESA = [
  "deducoes",
  "custos_vendas",
  "despesas_vendas",
  "despesas_administrativas",
  "despesas_financeiras",
  "outras_despesas",
  "ir_csll",
];

type Filtro = "todos" | "receita" | "despesa";

export default function PlanosContaPage() {
  const [planos, setPlanos] = useState<PlanoConta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [painelAberto, setPainelAberto] = useState(false);

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

  const planosFiltrados = planos.filter((p) => filtro === "todos" || p.tipo === filtro);

  async function remover(id: string) {
    if (!window.confirm("Excluir este plano de conta?")) return;
    const supabase = createClient();
    await supabase.from("planos_conta").delete().eq("id", id);
    carregar();
  }

  async function atualizarCategoria(id: string, categoriaId: string) {
    const supabase = createClient();
    await supabase.from("planos_conta").update({ dre_categoria_id: categoriaId || null }).eq("id", id);
    carregar();
  }

  function categoriasParaTipo(tipo: "receita" | "despesa") {
    const grupos = tipo === "receita" ? GRUPOS_RECEITA : GRUPOS_DESPESA;
    return categorias.filter((c) => grupos.includes(c.grupo));
  }

  return (
    <div>
      <p className="text-xs text-ink/50 bg-surface rounded-full px-4 py-2 inline-flex items-center gap-1.5 w-fit mb-6">
        💡 Cada plano de conta pode ser ligado a uma categoria do DRE — assim os lançamentos entram
        automaticamente no relatório. Gerencie as categorias em Financeiro → DRE.
      </p>

      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1.5 shadow-inner">
          {(["todos", "receita", "despesa"] as Filtro[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
                filtro === f ? "bg-ink text-white shadow-md scale-105" : "text-ink/50 hover:text-ink hover:bg-white/60"
              }`}
            >
              {f === "todos" ? "Todos" : f === "receita" ? "Receita" : "Despesa"}
            </button>
          ))}
        </div>
        <button
          onClick={() => setPainelAberto(true)}
          className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
        >
          + Adicionar plano de conta
        </button>
      </div>

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface text-left text-ink/40 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Categoria DRE</th>
              <th className="px-4 py-3 font-semibold w-16"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-sm text-ink/50">Carregando...</td>
              </tr>
            ) : planosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-sm text-ink/50">Nenhum plano de conta encontrado.</td>
              </tr>
            ) : (
              planosFiltrados.map((p) => (
                <tr key={p.id} className="border-t border-black/5 hover:bg-surface/60">
                  <td className="px-4 py-3 font-medium text-ink">{p.nome}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        p.tipo === "receita" ? "bg-mint text-forest" : "bg-red-50 text-red-600"
                      }`}
                    >
                      {p.tipo === "receita" ? "Receita" : "Despesa"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={p.dre_categoria_id ?? ""}
                      onChange={(e) => atualizarCategoria(p.id, e.target.value)}
                      className="input py-1.5 text-xs w-full max-w-56"
                    >
                      <option value="">Sem categoria DRE</option>
                      {categoriasParaTipo(p.tipo).map((c) => (
                        <option key={c.id} value={c.id}>
                          {GRUPO_LABEL[c.grupo]} · {c.nome}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remover(p.id)} className="text-xs font-semibold text-ink/40 hover:text-red-600">
                      Remover
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {painelAberto && (
        <PainelNovoPlano
          onSaved={() => {
            setPainelAberto(false);
            carregar();
          }}
          onCancel={() => setPainelAberto(false)}
        />
      )}
    </div>
  );
}

function PainelNovoPlano({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"receita" | "despesa">("receita");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setErro("Informe o nome do plano de conta.");
      return;
    }
    setSaving(true);
    setErro(null);
    const supabase = createClient();
    const { error } = await supabase.from("planos_conta").insert({ nome: nome.trim(), tipo });
    if (error) {
      setErro(error.message);
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-5">Novo plano de conta</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" required autoFocus />
          </label>

          <div>
            <span className="block text-sm font-medium text-ink/70 mb-1">Tipo</span>
            <div className="flex items-center gap-1 rounded-full bg-surface p-1 w-fit">
              <button
                type="button"
                onClick={() => setTipo("receita")}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  tipo === "receita" ? "bg-forest text-white" : "text-ink/60"
                }`}
              >
                Receita
              </button>
              <button
                type="button"
                onClick={() => setTipo("despesa")}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  tipo === "despesa" ? "bg-red-600 text-white" : "text-ink/60"
                }`}
              >
                Despesa
              </button>
            </div>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button type="button" onClick={onCancel} className="text-sm font-semibold text-ink/60 hover:text-ink">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
