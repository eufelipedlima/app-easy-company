"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Item {
  id: string;
  nome: string;
}

export default function ConfiguracoesFinanceiroPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Configurações financeiras</h1>
        <p className="text-sm text-ink/60 mt-1">
          Cadastre os bancos e planos de conta usados nos lançamentos.
        </p>
      </div>

      <ListaCadastravel titulo="Bancos" tabela="bancos" emoji="🏦" />
      <ListaCadastravel titulo="Planos de conta" tabela="planos_conta" emoji="📊" />
    </main>
  );
}

function ListaCadastravel({
  titulo,
  tabela,
  emoji,
}: {
  titulo: string;
  tabela: "bancos" | "planos_conta";
  emoji: string;
}) {
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from(tabela).select("id, nome").order("nome");
    setItens(data ?? []);
    setLoading(false);
  }, [tabela]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setSalvando(true);
    const supabase = createClient();
    await supabase.from(tabela).insert({ nome: novoNome.trim() });
    setNovoNome("");
    setSalvando(false);
    carregar();
  }

  async function remover(id: string) {
    const supabase = createClient();
    await supabase.from(tabela).delete().eq("id", id);
    carregar();
  }

  return (
    <section>
      <h2 className="text-sm font-bold text-ink flex items-center gap-2 mb-3">
        <span>{emoji}</span> {titulo}
      </h2>

      <form onSubmit={adicionar} className="flex gap-2 mb-4">
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          className="input"
          placeholder={`Novo ${titulo.toLowerCase().replace(/s$/, "")}...`}
        />
        <button
          type="submit"
          disabled={salvando}
          className="shrink-0 rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
        >
          Adicionar
        </button>
      </form>

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        {loading ? (
          <p className="p-4 text-sm text-ink/50">Carregando...</p>
        ) : itens.length === 0 ? (
          <p className="p-4 text-sm text-ink/50">Nenhum cadastrado ainda.</p>
        ) : (
          itens.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-4 py-3 border-b border-black/5 last:border-0"
            >
              <span className="text-sm font-medium text-ink">{item.nome}</span>
              <button
                onClick={() => remover(item.id)}
                className="text-xs font-semibold text-ink/40 hover:text-red-600"
              >
                Remover
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
