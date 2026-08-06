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
  temDescricao: boolean;
  qtdFilhos: number;
  responsaveis: string[];
}

const LABEL_TIPO: Record<string, { label: string; labelFilhos: string; icone: string }> = {
  tarefa: { label: "Tarefa", labelFilhos: "subtarefas", icone: "✔️" },
  doc: { label: "Doc", labelFilhos: "sub-páginas", icone: "📄" },
  conteudo: { label: "Conteúdo", labelFilhos: "sub-conteúdos", icone: "📅" },
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

    const limite = new Date();
    limite.setDate(limite.getDate() - 30);
    await Promise.all([
      supabase.from("tarefas").delete().not("excluido_em", "is", null).lt("excluido_em", limite.toISOString()),
      supabase.from("docs").delete().not("excluido_em", "is", null).lt("excluido_em", limite.toISOString()),
      supabase.from("posts_conteudo").delete().not("excluido_em", "is", null).lt("excluido_em", limite.toISOString()),
    ]);

    const [{ data: tarefas }, { data: docs }, { data: posts }] = await Promise.all([
      supabase.from("tarefas").select("id, titulo, tarefa_pai_id, descricao, excluido_por, excluido_em").not("excluido_em", "is", null),
      supabase.from("docs").select("id, titulo, doc_pai_id, conteudo, excluido_por, excluido_em").not("excluido_em", "is", null),
      supabase.from("posts_conteudo").select("id, titulo, post_pai_id, observacoes_internas, excluido_por, excluido_em").not("excluido_em", "is", null),
    ]);

    // Só mostra o item "raiz": se o pai dele também estiver na lixeira, ele é implícito (não aparece sozinho)
    const idsTarefasExcluidas = new Set((tarefas ?? []).map((t) => t.id));
    const idsDocsExcluidos = new Set((docs ?? []).map((d) => d.id));
    const idsPostsExcluidos = new Set((posts ?? []).map((p) => p.id));

    const tarefasRaiz = (tarefas ?? []).filter((t) => !t.tarefa_pai_id || !idsTarefasExcluidas.has(t.tarefa_pai_id));
    const docsRaiz = (docs ?? []).filter((d) => !d.doc_pai_id || !idsDocsExcluidos.has(d.doc_pai_id));
    const postsRaiz = (posts ?? []).filter((p) => !p.post_pai_id || !idsPostsExcluidos.has(p.post_pai_id));

    // Contagem de filhos (todas as subtarefas/sub-conteúdos/sub-páginas que foram junto, excluídas ou não)
    const [{ data: todasSubtarefas }, { data: todosSubdocs }, { data: todosSubposts }] = await Promise.all([
      tarefasRaiz.length > 0 ? supabase.from("tarefas").select("id, tarefa_pai_id").in("tarefa_pai_id", tarefasRaiz.map((t) => t.id)) : Promise.resolve({ data: [] }),
      docsRaiz.length > 0 ? supabase.from("docs").select("id, doc_pai_id").in("doc_pai_id", docsRaiz.map((d) => d.id)) : Promise.resolve({ data: [] }),
      postsRaiz.length > 0 ? supabase.from("posts_conteudo").select("id, post_pai_id").in("post_pai_id", postsRaiz.map((p) => p.id)) : Promise.resolve({ data: [] }),
    ]);
    const contagemT = new Map<string, number>();
    for (const s of todasSubtarefas ?? []) contagemT.set(s.tarefa_pai_id!, (contagemT.get(s.tarefa_pai_id!) ?? 0) + 1);
    const contagemD = new Map<string, number>();
    for (const s of todosSubdocs ?? []) contagemD.set(s.doc_pai_id!, (contagemD.get(s.doc_pai_id!) ?? 0) + 1);
    const contagemP = new Map<string, number>();
    for (const s of todosSubposts ?? []) contagemP.set(s.post_pai_id!, (contagemP.get(s.post_pai_id!) ?? 0) + 1);

    // Responsáveis das tarefas/conteúdos raiz
    const [{ data: respT }, { data: respP }] = await Promise.all([
      tarefasRaiz.length > 0
        ? supabase.from("tarefas_responsaveis").select("tarefa_id, funcionarios ( papeis ( pessoas ( nome, apelido ) ) )").in("tarefa_id", tarefasRaiz.map((t) => t.id))
        : Promise.resolve({ data: [] }),
      postsRaiz.length > 0
        ? supabase.from("posts_conteudo_responsaveis").select("post_id, funcionarios ( papeis ( pessoas ( nome, apelido ) ) )").in("post_id", postsRaiz.map((p) => p.id))
        : Promise.resolve({ data: [] }),
    ]);
    type RespRaw = { funcionarios: { papeis: { pessoas: { nome: string; apelido: string | null } | null } | null } | null };
    const mapaRespT = new Map<string, string[]>();
    for (const r of (respT ?? []) as unknown as (RespRaw & { tarefa_id: string })[]) {
      const nome = r.funcionarios?.papeis?.pessoas?.apelido || r.funcionarios?.papeis?.pessoas?.nome;
      if (nome) mapaRespT.set(r.tarefa_id, [...(mapaRespT.get(r.tarefa_id) ?? []), nome]);
    }
    const mapaRespP = new Map<string, string[]>();
    for (const r of (respP ?? []) as unknown as (RespRaw & { post_id: string })[]) {
      const nome = r.funcionarios?.papeis?.pessoas?.apelido || r.funcionarios?.papeis?.pessoas?.nome;
      if (nome) mapaRespP.set(r.post_id, [...(mapaRespP.get(r.post_id) ?? []), nome]);
    }

    const lista: ItemLixeira[] = [
      ...tarefasRaiz.map((t) => ({
        id: t.id,
        tipo: "tarefa" as const,
        titulo: t.titulo,
        excluido_por: t.excluido_por,
        excluido_em: t.excluido_em!,
        link: `/tarefas/${t.id}`,
        temDescricao: !!t.descricao,
        qtdFilhos: contagemT.get(t.id) ?? 0,
        responsaveis: mapaRespT.get(t.id) ?? [],
      })),
      ...docsRaiz.map((d) => ({
        id: d.id,
        tipo: "doc" as const,
        titulo: d.titulo,
        excluido_por: d.excluido_por,
        excluido_em: d.excluido_em!,
        link: `/docs/${d.id}`,
        temDescricao: !!d.conteudo,
        qtdFilhos: contagemD.get(d.id) ?? 0,
        responsaveis: [],
      })),
      ...postsRaiz.map((p) => ({
        id: p.id,
        tipo: "conteudo" as const,
        titulo: p.titulo,
        excluido_por: p.excluido_por,
        excluido_em: p.excluido_em!,
        link: `/conteudo/calendario/post/${p.id}`,
        temDescricao: !!p.observacoes_internas,
        qtdFilhos: contagemP.get(p.id) ?? 0,
        responsaveis: mapaRespP.get(p.id) ?? [],
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
        🗑️ Itens ficam aqui por até 30 dias. Clique num item pra abrir a tela completa dele. Sub-itens excluídos junto com o item
        principal aparecem resumidos ali dentro — só ficam com linha própria aqui se foram excluídos sozinhos.
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
                    <p className="text-xs text-ink/40 flex flex-wrap items-center gap-x-1.5">
                      <span>{info.label}</span>
                      <span>· Excluído em {formatarQuando(item.excluido_em)}</span>
                      {item.excluido_por && nomesPorAutor[item.excluido_por] && <span>por {nomesPorAutor[item.excluido_por]}</span>}
                      {item.responsaveis.length > 0 && <span>· Responsável: {item.responsaveis.join(", ")}</span>}
                      {item.temDescricao && <span>· tem descrição</span>}
                      {item.qtdFilhos > 0 && (
                        <span className="font-semibold text-ink/60">
                          · {item.qtdFilhos} {info.labelFilhos} dentro
                        </span>
                      )}
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
