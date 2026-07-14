"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface PlanoConta {
  id: string;
  nome: string;
  tipo: "receita" | "despesa";
}

export default function PlanosContaPage() {
  const [planos, setPlanos] = useState<PlanoConta[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("planos_conta").select("id, nome, tipo").order("nome");
    setPlanos((data as PlanoConta[]) ?? []);
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

  if (loading) {
    return <p className="text-sm text-ink/50">Carregando...</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Grupo titulo="Receita" emoji="💚" tipo="receita" planos={receitas} onChange={carregar} onRemover={remover} />
      <Grupo titulo="Despesa" emoji="❤️" tipo="despesa" planos={despesas} onChange={carregar} onRemover={remover} />
    </div>
  );
}

function Grupo({
  titulo,
  emoji,
  tipo,
  planos,
  onChange,
  onRemover,
}: {
  titulo: string;
  emoji: string;
  tipo: "receita" | "despesa";
  planos: PlanoConta[];
  onChange: () => void;
  onRemover: (id: string) => void;
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
            <div key={p.id} className="flex items-center justify-between px-4 py-3 border-b border-black/5 last:border-0">
              <span className="text-sm font-medium text-ink">{p.nome}</span>
              <button onClick={() => onRemover(p.id)} className="text-xs font-semibold text-ink/40 hover:text-red-600">
                Remover
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
