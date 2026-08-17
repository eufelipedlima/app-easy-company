"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Grupo {
  id: string;
  nome: string;
}

export default function GruposLancamentoPage() {
  const [itens, setItens] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("grupos_lancamento").select("id, nome").order("nome");
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
    setErro(null);
    const supabase = createClient();
    const { error } = await supabase.from("grupos_lancamento").insert({ nome: novoNome.trim() });
    setSalvando(false);
    if (error) {
      setErro(error.code === "23505" ? "Já existe um grupo com esse nome." : error.message);
      return;
    }
    setNovoNome("");
    carregar();
  }

  async function salvarEdicao(id: string, nomeAntigo: string) {
    if (!nomeEditado.trim() || nomeEditado.trim() === nomeAntigo) {
      setEditandoId(null);
      return;
    }
    const supabase = createClient();
    const nomeNovo = nomeEditado.trim();
    const { error } = await supabase.from("grupos_lancamento").update({ nome: nomeNovo }).eq("id", id);
    if (error) {
      setErro(error.code === "23505" ? "Já existe um grupo com esse nome." : error.message);
      return;
    }
    // Renomear precisa refletir em tudo que já usa o nome antigo — senão os
    // lançamentos e despesas fixas antigos ficam "órfãos" com o nome velho.
    await Promise.all([
      supabase.from("lancamentos").update({ grupo: nomeNovo }).eq("grupo", nomeAntigo),
      supabase.from("despesas_fixas").update({ grupo: nomeNovo }).eq("grupo", nomeAntigo),
    ]);
    setEditandoId(null);
    setErro(null);
    carregar();
  }

  async function remover(id: string, nome: string) {
    const supabase = createClient();
    const [{ count: cLanc }, { count: cDesp }] = await Promise.all([
      supabase.from("lancamentos").select("id", { count: "exact", head: true }).eq("grupo", nome),
      supabase.from("despesas_fixas").select("id", { count: "exact", head: true }).eq("grupo", nome),
    ]);
    const total = (cLanc ?? 0) + (cDesp ?? 0);
    const aviso =
      total > 0
        ? `Esse grupo está em uso em ${total} ${total === 1 ? "registro" : "registros"} (lançamentos/despesas fixas). Excluir o grupo tira ele desses registros, mas não apaga os registros em si. Confirma?`
        : "Excluir esse grupo?";
    if (!window.confirm(aviso)) return;
    await Promise.all([
      supabase.from("lancamentos").update({ grupo: null }).eq("grupo", nome),
      supabase.from("despesas_fixas").update({ grupo: null }).eq("grupo", nome),
    ]);
    await supabase.from("grupos_lancamento").delete().eq("id", id);
    carregar();
  }

  return (
    <section>
      <p className="text-sm text-ink/50 mb-4">
        Grupos usados pra organizar e filtrar lançamentos e despesas fixas no Financeiro. Renomear aqui já atualiza
        automaticamente todos os lançamentos que usam esse grupo.
      </p>
      <form onSubmit={adicionar} className="flex gap-2 mb-4">
        <input
          value={novoNome}
          onChange={(e) => {
            setNovoNome(e.target.value);
            setErro(null);
          }}
          className="input"
          placeholder="Novo grupo..."
        />
        <button
          type="submit"
          disabled={salvando}
          className="shrink-0 rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
        >
          Adicionar
        </button>
      </form>
      {erro && <p className="text-sm text-red-600 mb-4">{erro}</p>}

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        {loading ? (
          <p className="p-4 text-sm text-ink/50">Carregando...</p>
        ) : itens.length === 0 ? (
          <p className="p-4 text-sm text-ink/50">Nenhum grupo cadastrado ainda.</p>
        ) : (
          itens.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3 border-b border-black/5 last:border-0 gap-3">
              {editandoId === item.id ? (
                <input
                  autoFocus
                  value={nomeEditado}
                  onChange={(e) => setNomeEditado(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && salvarEdicao(item.id, item.nome)}
                  onBlur={() => salvarEdicao(item.id, item.nome)}
                  className="input text-sm flex-1"
                />
              ) : (
                <span className="text-sm font-medium text-ink">{item.nome}</span>
              )}
              <div className="flex items-center gap-3 shrink-0">
                {editandoId !== item.id && (
                  <button
                    onClick={() => {
                      setEditandoId(item.id);
                      setNomeEditado(item.nome);
                      setErro(null);
                    }}
                    className="text-xs font-semibold text-ink/40 hover:text-ink"
                  >
                    Renomear
                  </button>
                )}
                <button onClick={() => remover(item.id, item.nome)} className="text-xs font-semibold text-ink/40 hover:text-red-600">
                  Remover
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
