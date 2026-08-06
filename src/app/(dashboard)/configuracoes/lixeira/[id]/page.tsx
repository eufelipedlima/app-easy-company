"use client";

import { useEffect, useState, useCallback, use } from "react";
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

function limparHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export default function LixeiraItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<ItemLixeira | null>(null);
  const [nomeAutor, setNomeAutor] = useState<string | null>(null);
  const [nomeCliente, setNomeCliente] = useState<string | null>(null);
  const [nomeStatus, setNomeStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("lixeira").select("*").eq("id", id).maybeSingle();
    setItem(data);

    if (data) {
      if (data.excluido_por) {
        const { data: func } = await supabase
          .from("funcionarios")
          .select("papeis ( pessoas ( nome, apelido ) )")
          .eq("auth_user_id", data.excluido_por)
          .maybeSingle();
        const pessoa = (func as unknown as { papeis: { pessoas: { nome: string; apelido: string | null } | null } | null } | null)?.papeis?.pessoas;
        setNomeAutor(pessoa?.apelido || pessoa?.nome || null);
      }
      const clienteId = (data.dados as { cliente_id?: string | null }).cliente_id;
      if (clienteId) {
        const { data: cliente } = await supabase.from("clientes").select("papeis ( pessoas ( nome ) )").eq("id", clienteId).maybeSingle();
        setNomeCliente((cliente as unknown as { papeis: { pessoas: { nome: string } | null } | null } | null)?.papeis?.pessoas?.nome ?? null);
      }
      const statusId = (data.dados as { status_id?: string | null }).status_id;
      if (statusId) {
        const { data: status } = await supabase.from("status_conteudo").select("nome").eq("id", statusId).maybeSingle();
        setNomeStatus(status?.nome ?? null);
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function restaurar() {
    if (!item) return;
    setProcessando(true);
    const supabase = createClient();
    const tabela = LABEL_TIPO[item.tipo].tabela;
    const { error } = await supabase.from(tabela).insert(item.dados);
    if (!error) {
      await supabase.from("lixeira").delete().eq("id", item.id);
      router.push("/configuracoes/lixeira");
    } else {
      alert("Não foi possível restaurar: " + error.message);
      setProcessando(false);
    }
  }

  async function excluirDefinitivo() {
    if (!item) return;
    if (!window.confirm(`Excluir "${item.titulo || "esse item"}" definitivamente? Não tem mais volta.`)) return;
    setProcessando(true);
    const supabase = createClient();
    await supabase.from("lixeira").delete().eq("id", item.id);
    router.push("/configuracoes/lixeira");
  }

  if (loading) {
    return (
      <section>
        <p className="text-sm text-ink/50">Carregando...</p>
      </section>
    );
  }

  if (!item) {
    return (
      <section>
        <p className="text-sm text-ink/50">Item não encontrado na lixeira (talvez já tenha sido restaurado ou apagado).</p>
      </section>
    );
  }

  const info = LABEL_TIPO[item.tipo];
  const dados = item.dados as {
    titulo?: string | null;
    descricao?: string | null;
    legenda?: string | null;
    observacoes_internas?: string | null;
    conteudo?: string | null;
    prioridade?: string | null;
    prazo?: string | null;
    data_publicacao?: string | null;
    emoji?: string | null;
  };
  const descricaoHtml = dados.descricao ?? dados.observacoes_internas ?? dados.conteudo ?? null;

  return (
    <section>
      <button onClick={() => router.push("/configuracoes/lixeira")} className="text-xs font-semibold text-ink/50 hover:text-ink mb-4">
        ← Lixeira
      </button>

      <div className="rounded-2xl bg-red-50 border-2 border-red-200 px-5 py-4 mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-bold text-red-700">
            🗑️ {info.label} excluída em {formatarQuando(item.excluido_em)}
            {nomeAutor && ` por ${nomeAutor}`}
          </p>
          <p className="text-xs text-red-600/70 mt-0.5">
            Alguns dados (comentários, subtarefas, histórico) não ficam guardados aqui — só as informações principais do item.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={restaurar}
            disabled={processando}
            className="rounded-full bg-forest text-white px-5 py-2 text-sm font-semibold hover:brightness-110 transition disabled:opacity-50"
          >
            Restaurar
          </button>
          <button
            onClick={excluirDefinitivo}
            disabled={processando}
            className="rounded-full border-2 border-red-300 text-red-700 px-5 py-2 text-sm font-semibold hover:bg-red-100 transition disabled:opacity-50"
          >
            Excluir de vez
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-card border border-black/5 p-6 max-w-2xl">
        <h1 className="text-2xl font-extrabold text-ink mb-4">
          {dados.emoji && <span className="mr-2">{dados.emoji}</span>}
          {item.titulo || "Sem título"}
        </h1>

        <div className="flex flex-wrap items-center gap-2 mb-5">
          {nomeCliente && <span className="rounded-full bg-surface text-ink/60 px-3 py-1 text-xs font-semibold">{nomeCliente}</span>}
          {nomeStatus && <span className="rounded-full bg-surface text-ink/60 px-3 py-1 text-xs font-semibold">{nomeStatus}</span>}
          {dados.prioridade && <span className="rounded-full bg-surface text-ink/60 px-3 py-1 text-xs font-semibold">Prioridade: {dados.prioridade}</span>}
          {(dados.prazo || dados.data_publicacao) && (
            <span className="rounded-full bg-surface text-ink/60 px-3 py-1 text-xs font-semibold">
              {dados.prazo ?? dados.data_publicacao}
            </span>
          )}
        </div>

        {dados.legenda && (
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-1">Legenda</p>
            <p className="text-sm text-ink/80 whitespace-pre-wrap">{dados.legenda}</p>
          </div>
        )}

        {descricaoHtml ? (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-1">Descrição</p>
            <p className="text-sm text-ink/80 whitespace-pre-wrap">{limparHtml(descricaoHtml)}</p>
          </div>
        ) : (
          <p className="text-sm text-ink/40">Sem descrição.</p>
        )}
      </div>
    </section>
  );
}
