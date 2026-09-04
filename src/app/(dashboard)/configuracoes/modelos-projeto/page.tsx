"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { statusPadrao } from "@/lib/status-conteudo";
import { FolderTree, Pencil, Trash2 } from "lucide-react";

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
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

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
    const { data: statusList } = await supabase.from("status_conteudo").select("id, nome").eq("area", "tarefas").order("ordem");
    const { data: modelo, error } = await supabase
      .from("tarefas")
      .insert({ titulo: "Novo modelo de projeto", eh_modelo_projeto: true, status_id: statusPadrao(statusList ?? [])?.id })
      .select("id")
      .single();
    setCriando(false);
    if (!error && modelo) router.push(`/tarefas/${modelo.id}`);
  }

  async function excluirModelo(modeloId: string, titulo: string) {
    if (!window.confirm(`Excluir o modelo "${titulo}"? Isso também remove as etapas salvas dentro dele.`)) return;
    setExcluindoId(modeloId);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const agora = new Date().toISOString();
    const { data: etapas } = await supabase.from("tarefas").select("id").eq("tarefa_pai_id", modeloId).is("excluido_em", null);
    const ids = [modeloId, ...(etapas ?? []).map((e) => e.id)];
    await supabase.from("tarefas").update({ excluido_em: agora, excluido_por: user?.id ?? null }).in("id", ids);
    setExcluindoId(null);
    carregar();
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
            <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors">
              <button onClick={() => router.push(`/tarefas/${m.id}`)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                <FolderTree size={16} className="text-ink/40 shrink-0" />
                <p className="text-sm font-bold text-ink truncate">{m.titulo}</p>
                <span className="text-xs text-ink/40 shrink-0">{m.qtdEtapas} subtarefas</span>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => router.push(`/tarefas/${m.id}`)}
                  title="Editar modelo"
                  className="h-8 w-8 rounded-full flex items-center justify-center text-ink/40 hover:text-ink hover:bg-black/5 transition-colors"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => excluirModelo(m.id, m.titulo)}
                  disabled={excluindoId === m.id}
                  title="Excluir modelo"
                  className="h-8 w-8 rounded-full flex items-center justify-center text-ink/40 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
