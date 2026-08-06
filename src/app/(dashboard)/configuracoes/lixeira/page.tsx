"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface ItemLixeira {
  id: string;
  tipo: "tarefa" | "doc" | "conteudo";
  titulo: string | null;
  excluido_por: string | null;
  excluido_em: string;
  link: string;
}

const LABEL_TIPO: Record<string, { label: string; icone: string }> = {
  tarefa: { label: "Tarefa", icone: "✔️" },
  doc: { label: "Doc", icone: "📄" },
  conteudo: { label: "Conteúdo", icone: "📅" },
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

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // Apaga de vez (definitivamente) o que já passou de 30 dias
    const limite = new Date();
    limite.setDate(limite.getDate() - 30);
    await Promise.all([
      supabase.from("tarefas").delete().not("excluido_em", "is", null).lt("excluido_em", limite.toISOString()),
      supabase.from("docs").delete().not("excluido_em", "is", null).lt("excluido_em", limite.toISOString()),
      supabase.from("posts_conteudo").delete().not("excluido_em", "is", null).lt("excluido_em", limite.toISOString()),
    ]);

    const [{ data: tarefas }, { data: docs }, { data: posts }] = await Promise.all([
      supabase.from("tarefas").select("id, titulo, excluido_por, excluido_em").not("excluido_em", "is", null),
      supabase.from("docs").select("id, titulo, excluido_por, excluido_em").not("excluido_em", "is", null),
      supabase.from("posts_conteudo").select("id, titulo, excluido_por, excluido_em").not("excluido_em", "is", null),
    ]);

    const lista: ItemLixeira[] = [
      ...(tarefas ?? []).map((t) => ({ id: t.id, tipo: "tarefa" as const, titulo: t.titulo, excluido_por: t.excluido_por, excluido_em: t.excluido_em!, link: `/tarefas/${t.id}` })),
      ...(docs ?? []).map((d) => ({ id: d.id, tipo: "doc" as const, titulo: d.titulo, excluido_por: d.excluido_por, excluido_em: d.excluido_em!, link: `/docs/${d.id}` })),
      ...(posts ?? []).map((p) => ({
        id: p.id,
        tipo: "conteudo" as const,
        titulo: p.titulo,
        excluido_por: p.excluido_por,
        excluido_em: p.excluido_em!,
        link: `/conteudo/calendario/post/${p.id}`,
      })),
    ].sort((a, b) => (a.excluido_em < b.excluido_em ? 1 : -1));

    setItens(lista);

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

  return (
    <section>
      <p className="text-xs text-ink/50 bg-surface rounded-full px-4 py-2 inline-flex items-center gap-1.5 w-fit mb-6">
        🗑️ Itens ficam aqui por até 30 dias antes de serem apagados de vez. Clique num item pra abrir a tela completa dele (com
        descrição, subtarefas, comentários — tudo). Só administradores veem essa página.
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
              <button
                key={`${item.tipo}-${item.id}`}
                onClick={() => router.push(item.link)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg shrink-0">{info.icone}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{item.titulo || "Sem título"}</p>
                    <p className="text-xs text-ink/40">
                      {info.label} · Excluído em {formatarQuando(item.excluido_em)}
                      {item.excluido_por && nomesPorAutor[item.excluido_por] && ` por ${nomesPorAutor[item.excluido_por]}`}
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-semibold shrink-0 ${restantes <= 5 ? "text-red-600" : "text-ink/40"}`}>
                  {restantes === 0 ? "some hoje" : `some em ${restantes}d`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
