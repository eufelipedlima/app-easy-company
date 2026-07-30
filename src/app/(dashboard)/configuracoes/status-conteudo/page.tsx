"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PALETA_CORES } from "@/lib/status-conteudo";

interface StatusItem {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  visivel_cliente: boolean;
}

export default function StatusConteudoPage() {
  const [itens, setItens] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState("cinza");
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [corEditada, setCorEditada] = useState("cinza");

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("status_conteudo").select("id, nome, cor, ordem, visivel_cliente").order("ordem");
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
    const maxOrdem = Math.max(0, ...itens.map((i) => i.ordem));
    await supabase.from("status_conteudo").insert({ nome: novoNome.trim(), cor: novaCor, ordem: maxOrdem + 1 });
    setNovoNome("");
    setNovaCor("cinza");
    setSalvando(false);
    carregar();
  }

  async function salvarEdicao(id: string) {
    if (!nomeEditado.trim()) return;
    const supabase = createClient();
    await supabase.from("status_conteudo").update({ nome: nomeEditado.trim(), cor: corEditada }).eq("id", id);
    setEditandoId(null);
    carregar();
  }

  async function remover(id: string) {
    if (!window.confirm("Remover este status? Posts que já usam ele precisam ser reatribuídos antes.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("status_conteudo").delete().eq("id", id);
    if (error) {
      window.alert("Não foi possível remover — provavelmente ainda tem post usando esse status.");
      return;
    }
    carregar();
  }

  async function alternarVisivelCliente(item: StatusItem) {
    const supabase = createClient();
    await supabase.from("status_conteudo").update({ visivel_cliente: !item.visivel_cliente }).eq("id", item.id);
    carregar();
  }

  async function mover(item: StatusItem, direcao: -1 | 1) {
    const ordenados = [...itens].sort((a, b) => a.ordem - b.ordem);
    const indice = ordenados.findIndex((i) => i.id === item.id);
    const alvo = ordenados[indice + direcao];
    if (!alvo) return;
    const supabase = createClient();
    await supabase.from("status_conteudo").update({ ordem: alvo.ordem }).eq("id", item.id);
    await supabase.from("status_conteudo").update({ ordem: item.ordem }).eq("id", alvo.id);
    carregar();
  }

  return (
    <section>
      <p className="text-xs text-ink/50 bg-surface rounded-full px-4 py-2 inline-flex items-center gap-1.5 w-fit mb-6">
        💡 Esses são os status que aparecem no Calendário de Conteúdo. A ordem aqui é a ordem que
        aparece no seletor lá.
      </p>

      <form onSubmit={adicionar} className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          className="input flex-1 min-w-[160px]"
          placeholder="Nome do status..."
        />
        <select value={novaCor} onChange={(e) => setNovaCor(e.target.value)} className="input !w-auto">
          {Object.entries(PALETA_CORES).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.nome}
            </option>
          ))}
        </select>
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
          <p className="p-4 text-sm text-ink/50">Nenhum status cadastrado ainda.</p>
        ) : (
          [...itens]
            .sort((a, b) => a.ordem - b.ordem)
            .map((item, i, arr) => (
              <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/5 last:border-0">
                {editandoId === item.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      autoFocus
                      value={nomeEditado}
                      onChange={(e) => setNomeEditado(e.target.value)}
                      className="input py-1.5 text-sm flex-1"
                    />
                    <select value={corEditada} onChange={(e) => setCorEditada(e.target.value)} className="input py-1.5 text-sm !w-auto">
                      {Object.entries(PALETA_CORES).map(([key, cfg]) => (
                        <option key={key} value={key}>
                          {cfg.nome}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => salvarEdicao(item.id)} className="text-xs font-bold text-forest hover:text-ink shrink-0">
                      Salvar
                    </button>
                    <button onClick={() => setEditandoId(null)} className="text-xs font-semibold text-ink/40 hover:text-ink shrink-0">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <>
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${PALETA_CORES[item.cor]?.cor ?? PALETA_CORES.cinza.cor}`}>
                      <span className={`h-2 w-2 rounded-full ${PALETA_CORES[item.cor]?.dot ?? PALETA_CORES.cinza.dot}`} />
                      {item.nome}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => alternarVisivelCliente(item)}
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          item.visivel_cliente ? "bg-mint text-forest" : "bg-black/5 text-ink/40"
                        }`}
                        title="Clique pra alternar se o cliente vê esse status no link público"
                      >
                        {item.visivel_cliente ? "👁 Visível pro cliente" : "Só interno"}
                      </button>
                      <button onClick={() => mover(item, -1)} disabled={i === 0} className="text-ink/40 hover:text-ink disabled:opacity-20 px-1.5">
                        ↑
                      </button>
                      <button onClick={() => mover(item, 1)} disabled={i === arr.length - 1} className="text-ink/40 hover:text-ink disabled:opacity-20 px-1.5">
                        ↓
                      </button>
                      <button
                        onClick={() => {
                          setEditandoId(item.id);
                          setNomeEditado(item.nome);
                          setCorEditada(item.cor);
                        }}
                        className="text-xs font-semibold text-ink/40 hover:text-ink px-1.5"
                      >
                        Editar
                      </button>
                      <button onClick={() => remover(item.id)} className="text-xs font-semibold text-ink/40 hover:text-red-600 px-1.5">
                        Remover
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
        )}
      </div>
    </section>
  );
}
