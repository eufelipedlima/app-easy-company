"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PALETA_CORES, corDoStatus } from "@/lib/status-conteudo";

interface CategoriaDoc {
  id: string;
  nome: string;
  cor: string;
}

const CORES_DISPONIVEIS = Object.keys(PALETA_CORES);

export default function DocCategoriasPage() {
  const [itens, setItens] = useState<CategoriaDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState("cinza");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [corEditada, setCorEditada] = useState("cinza");

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("doc_categorias").select("id, nome, cor").order("nome");
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
    const { error } = await supabase.from("doc_categorias").insert({ nome: novoNome.trim(), cor: novaCor });
    setSalvando(false);
    if (error) {
      setErro(error.code === "23505" ? "Já existe uma categoria com esse nome." : error.message);
      return;
    }
    setNovoNome("");
    setNovaCor("cinza");
    carregar();
  }

  async function salvarEdicao(id: string, nomeAntigo: string, corAntiga: string) {
    const nomeNovo = nomeEditado.trim() || nomeAntigo;
    if (nomeNovo === nomeAntigo && corEditada === corAntiga) {
      setEditandoId(null);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("doc_categorias").update({ nome: nomeNovo, cor: corEditada }).eq("id", id);
    if (error) {
      setErro(error.code === "23505" ? "Já existe uma categoria com esse nome." : error.message);
      return;
    }
    setEditandoId(null);
    setErro(null);
    carregar();
  }

  async function remover(id: string, nome: string) {
    const supabase = createClient();
    const { count } = await supabase.from("docs").select("id", { count: "exact", head: true }).eq("categoria_id", id);
    const total = count ?? 0;
    const aviso =
      total > 0
        ? `Essa categoria está em uso em ${total} ${total === 1 ? "documento" : "documentos"}. Excluir tira a categoria desses documentos, mas não apaga os documentos em si. Confirma?`
        : "Excluir essa categoria?";
    if (!window.confirm(aviso)) return;
    await supabase.from("doc_categorias").delete().eq("id", id);
    carregar();
  }

  return (
    <section>
      <p className="text-sm text-ink/50 mb-4">
        Categorias usadas pra organizar e filtrar documentos em Docs. Renomear ou trocar a cor aqui já reflete
        automaticamente em todos os documentos que usam essa categoria.
      </p>
      <form onSubmit={adicionar} className="flex gap-2 mb-4">
        <input
          value={novoNome}
          onChange={(e) => {
            setNovoNome(e.target.value);
            setErro(null);
          }}
          className="input flex-1"
          placeholder="Nova categoria..."
        />
        <select value={novaCor} onChange={(e) => setNovaCor(e.target.value)} className="input !w-40">
          {CORES_DISPONIVEIS.map((chave) => (
            <option key={chave} value={chave}>
              {PALETA_CORES[chave].nome}
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
      {erro && <p className="text-sm text-red-600 mb-4">{erro}</p>}

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        {loading ? (
          <p className="p-4 text-sm text-ink/50">Carregando...</p>
        ) : itens.length === 0 ? (
          <p className="p-4 text-sm text-ink/50">Nenhuma categoria cadastrada ainda.</p>
        ) : (
          itens.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3 border-b border-black/5 last:border-0 gap-3">
              {editandoId === item.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    autoFocus
                    value={nomeEditado}
                    onChange={(e) => setNomeEditado(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && salvarEdicao(item.id, item.nome, item.cor)}
                    className="input text-sm flex-1"
                  />
                  <select
                    value={corEditada}
                    onChange={(e) => setCorEditada(e.target.value)}
                    className="input text-sm !w-36"
                  >
                    {CORES_DISPONIVEIS.map((chave) => (
                      <option key={chave} value={chave}>
                        {PALETA_CORES[chave].nome}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => salvarEdicao(item.id, item.nome, item.cor)}
                    className="shrink-0 rounded-full bg-ink text-white px-4 py-2 text-xs font-semibold hover:bg-forest"
                  >
                    Salvar
                  </button>
                </div>
              ) : (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold w-fit ${corDoStatus(item.cor).cor}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${corDoStatus(item.cor).dot}`} />
                  {item.nome}
                </span>
              )}
              <div className="flex items-center gap-3 shrink-0">
                {editandoId !== item.id && (
                  <button
                    onClick={() => {
                      setEditandoId(item.id);
                      setNomeEditado(item.nome);
                      setCorEditada(item.cor);
                      setErro(null);
                    }}
                    className="text-xs font-semibold text-ink/40 hover:text-ink"
                  >
                    Editar
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
