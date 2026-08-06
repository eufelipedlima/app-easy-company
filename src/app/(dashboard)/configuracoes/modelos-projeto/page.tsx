"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Modelo {
  id: string;
  titulo: string;
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
    const { data: modelosData } = await supabase
      .from("tarefas")
      .select("id, titulo")
      .eq("eh_modelo_projeto", true)
      .is("excluido_em", null)
      .order("titulo");
    const idsModelos = (modelosData ?? []).map((m) => m.id);
    const { data: etapasData } =
      idsModelos.length > 0
        ? await supabase.from("tarefas").select("tarefa_pai_id").in("tarefa_pai_id", idsModelos).is("excluido_em", null)
        : { data: [] };
    const contagem = new Map<string, number>();
    for (const e of etapasData ?? []) contagem.set(e.tarefa_pai_id!, (contagem.get(e.tarefa_pai_id!) ?? 0) + 1);
    setModelos((modelosData ?? []).map((m) => ({ id: m.id, titulo: m.titulo, qtdEtapas: contagem.get(m.id) ?? 0 })));
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarModelo() {
    setCriando(true);
    const supabase = createClient();
    const { data: statusList } = await supabase.from("status_conteudo").select("id").order("ordem").limit(1);
    const { data: modelo, error } = await supabase
      .from("tarefas")
      .insert({ titulo: "Novo modelo de projeto", eh_modelo_projeto: true, status_id: statusList?.[0]?.id })
      .select("id")
      .single();
    setCriando(false);
    if (!error && modelo) router.push(`/tarefas/${modelo.id}`);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-ink/60">
          Modelos reutilizáveis pra criar projetos com subtarefas (e pastas) já prontas. Cada modelo abre na mesma tela de
          tarefa/projeto — com descrição, subtarefas, comentários e histórico.
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
              onClick={() => router.push(`/tarefas/${m.id}`)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors text-left"
            >
              <p className="text-sm font-bold text-ink truncate">🗂️ {m.titulo}</p>
              <span className="text-xs text-ink/40 shrink-0">{m.qtdEtapas} subtarefas</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
