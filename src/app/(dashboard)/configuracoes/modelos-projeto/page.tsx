"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Modelo {
  id: string;
  nome: string;
  descricao: string | null;
  qtdEtapas: number;
}

export default function ModelosProjetoPage() {
  const router = useRouter();
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: modelosData } = await supabase.from("modelos_projeto").select("id, nome, descricao").order("nome");
    const { data: etapasData } = await supabase.from("modelos_projeto_etapas").select("modelo_id");
    const contagem = new Map<string, number>();
    for (const e of etapasData ?? []) contagem.set(e.modelo_id, (contagem.get(e.modelo_id) ?? 0) + 1);
    setModelos((modelosData ?? []).map((m) => ({ ...m, qtdEtapas: contagem.get(m.id) ?? 0 })));
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarModelo() {
    setCriando(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: modelo, error } = await supabase
      .from("modelos_projeto")
      .insert({ nome: "Novo modelo", criado_por: user?.id ?? null })
      .select("id")
      .single();
    setCriando(false);
    if (!error && modelo) router.push(`/configuracoes/modelos-projeto/${modelo.id}`);
  }

  async function excluirModelo(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("Excluir esse modelo de projeto?")) return;
    const supabase = createClient();
    await supabase.from("modelos_projeto").delete().eq("id", id);
    carregar();
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-ink/60">
          Modelos reutilizáveis pra criar projetos com etapas (e pastas de etapas) já prontas — ex: &quot;Criação de Site&quot; com
          Briefing, Wireframe, Design, Desenvolvimento, Entrega.
        </p>
        <button
          onClick={criarModelo}
          disabled={criando}
          className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors shrink-0 disabled:opacity-50"
        >
          {criando ? "Criando..." : "+ Novo modelo"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-ink/50">Carregando...</p>
      ) : modelos.length === 0 ? (
        <p className="text-sm text-ink/50">Nenhum modelo cadastrado ainda.</p>
      ) : (
        <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
          {modelos.map((m) => (
            <button
              key={m.id}
              onClick={() => router.push(`/configuracoes/modelos-projeto/${m.id}`)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors text-left"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink truncate">🗂️ {m.nome}</p>
                {m.descricao && <p className="text-xs text-ink/50 truncate mt-0.5">{m.descricao.replace(/<[^>]*>/g, " ")}</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-ink/40">{m.qtdEtapas} etapas</span>
                <button onClick={(e) => excluirModelo(m.id, e)} className="text-xs font-semibold text-red-500 hover:text-red-700">
                  Excluir
                </button>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
