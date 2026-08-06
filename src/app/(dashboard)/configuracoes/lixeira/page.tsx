"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface ItemLixeira {
  id: string;
  tipo: "tarefa" | "doc" | "conteudo";
  item_id_original: string;
  titulo: string | null;
  dados: Record<string, unknown>;
  excluido_por: string | null;
  excluido_em: string;
}

const LABEL_TIPO: Record<string, { label: string; icone: string; tabela: string }> = {
  tarefa: { label: "Tarefa", icone: "✔️", tabela: "tarefas" },
  doc: { label: "Doc", icone: "📄", tabela: "docs" },
  conteudo: { label: "Conteúdo", icone: "📅", tabela: "posts_conteudo" },
};

function formatarQuando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function diasRestantes(iso: string) {
  const excluidoEm = new Date(iso).getTime();
  const limite = excluidoEm + 30 * 24 * 60 * 60 * 1000;
  const restante = Math.ceil((limite - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(restante, 0);
}

export default function LixeiraPage() {
  const router = useRouter();
  const [itens, setItens] = useState<ItemLixeira[]>([]);
  const [nomesPorAutor, setNomesPorAutor] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // Limpa da lixeira (de verdade) o que já passou de 30 dias
    const limite = new Date();
    limite.setDate(limite.getDate() - 30);
    await supabase.from("lixeira").delete().lt("excluido_em", limite.toISOString());

    const { data } = await supabase.from("lixeira").select("*").order("excluido_em", { ascending: false });
    setItens(data ?? []);

    const { data: func } = await supabase.from("funcionarios").select("auth_user_id, papeis ( pessoas ( nome, apelido ) )").not("auth_user_id", "is", null);
    const mapa: Record<string, string> = {};
    for (const f of (func ?? []) as unknown as { auth_user_id: string; papeis: { pessoas: { nome: string; apelido: string | null } | null } | null }[]) {
      mapa[f.auth_user_id] = f.papeis?.pessoas?.apelido || f.papeis?.pessoas?.nome || "Alguém";
    }
    setNomesPorAutor(mapa);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function restaurar(item: ItemLixeira) {
    setProcessando(item.id);
    const supabase = createClient();
    const tabela = LABEL_TIPO[item.tipo].tabela;
    const { error } = await supabase.from(tabela).insert(item.dados);
    if (!error) {
      await supabase.from("lixeira").delete().eq("id", item.id);
      setItens((atual) => atual.filter((i) => i.id !== item.id));
    } else {
      alert("Não foi possível restaurar: " + error.message);
    }
    setProcessando(null);
  }

  async function excluirDefinitivo(item: ItemLixeira) {
    if (!window.confirm(`Excluir "${item.titulo || "esse item"}" definitivamente? Não tem mais volta.`)) return;
    setProcessando(item.id);
    const supabase = createClient();
    await supabase.from("lixeira").delete().eq("id", item.id);
    setItens((atual) => atual.filter((i) => i.id !== item.id));
    setProcessando(null);
  }

  return (
    <section>
      <p className="text-xs text-ink/50 bg-surface rounded-full px-4 py-2 inline-flex items-center gap-1.5 w-fit mb-6">
        🗑️ Itens ficam aqui por até 30 dias antes de serem apagados de vez. Só administradores veem essa página.
      </p>

      {loading ? (
        <p className="text-sm text-ink/50">Carregando...</p>
      ) : itens.length === 0 ? (
        <p className="text-sm text-ink/50">A lixeira está vazia.</p>
      ) : (
        <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
          {itens.map((item) => {
            const info = LABEL_TIPO[item.tipo];
            const restantes = diasRestantes(item.excluido_em);
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/5 last:border-0"
              >
                <button
                  onClick={() => router.push(`/configuracoes/lixeira/${item.id}`)}
                  className="flex items-center gap-3 min-w-0 text-left hover:opacity-70 transition-opacity"
                >
                  <span className="text-lg shrink-0">{info.icone}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{item.titulo || "Sem título"}</p>
                    <p className="text-xs text-ink/40">
                      {info.label} · Excluído em {formatarQuando(item.excluido_em)}
                      {item.excluido_por && nomesPorAutor[item.excluido_por] && ` por ${nomesPorAutor[item.excluido_por]}`}
                      {" · "}
                      <span className={restantes <= 5 ? "text-red-600 font-semibold" : ""}>
                        {restantes === 0 ? "some hoje" : `some em ${restantes}d`}
                      </span>
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => restaurar(item)}
                    disabled={processando === item.id}
                    className="rounded-full bg-forest text-white px-4 py-1.5 text-xs font-semibold hover:brightness-110 transition disabled:opacity-50"
                  >
                    Restaurar
                  </button>
                  <button
                    onClick={() => excluirDefinitivo(item)}
                    disabled={processando === item.id}
                    className="rounded-full border-2 border-red-200 text-red-600 px-4 py-1.5 text-xs font-semibold hover:bg-red-50 transition disabled:opacity-50"
                  >
                    Excluir de vez
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
