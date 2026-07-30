"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Item {
  id: string;
  nome: string;
}

export default function RedesSociaisPage() {
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("redes_sociais").select("id, nome").order("nome");
    setItens(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setSalvando(true);
    const supabase = createClient();
    await supabase.from("redes_sociais").insert({ nome: novoNome.trim() });
    setNovoNome("");
    setSalvando(false);
    carregar();
  }

  async function remover(id: string) {
    const supabase = createClient();
    await supabase.from("redes_sociais").delete().eq("id", id);
    carregar();
  }

  return (
    <section>
      <form onSubmit={adicionar} className="flex gap-2 mb-4">
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          className="input"
          placeholder="Ex: Instagram, TikTok..."
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
          <p className="p-4 text-sm text-ink/50">Nenhuma rede social cadastrada ainda.</p>
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
