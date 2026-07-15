"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Servico {
  id: string;
  nome: string;
  descricao: string | null;
  entregaveis: string | null;
  valor: number | null;
}

function formatarMoeda(valor: number | null) {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);
  const [editando, setEditando] = useState<Servico | null>(null);
  const [detalhe, setDetalhe] = useState<Servico | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("servicos")
      .select("id, nome, descricao, entregaveis, valor")
      .order("nome");
    setServicos(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function remover(id: string) {
    if (!window.confirm("Excluir este serviço?")) return;
    const supabase = createClient();
    await supabase.from("servicos").delete().eq("id", id);
    setDetalhe(null);
    carregar();
  }

  return (
    <section>
      <div className="flex items-center justify-end mb-4">
        {!painelAberto && (
          <button
            onClick={() => setPainelAberto(true)}
            className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors"
          >
            + Adicionar serviço
          </button>
        )}
      </div>

      {(painelAberto || editando) && (
        <div className="mb-6 rounded-3xl bg-card border border-black/5 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-ink mb-5">
            {editando ? "Editar serviço" : "Novo serviço"}
          </h2>
          <ServicoForm
            servicoEditando={editando}
            onSaved={() => {
              setPainelAberto(false);
              setEditando(null);
              carregar();
            }}
            onCancel={() => {
              setPainelAberto(false);
              setEditando(null);
            }}
          />
        </div>
      )}

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        {loading ? (
          <p className="p-4 text-sm text-ink/50">Carregando...</p>
        ) : servicos.length === 0 ? (
          <p className="p-4 text-sm text-ink/50">Nenhum serviço cadastrado ainda.</p>
        ) : (
          servicos.map((s) => (
            <div
              key={s.id}
              onClick={() => setDetalhe(s)}
              className="flex items-center justify-between px-4 py-3 border-b border-black/5 last:border-0 hover:bg-surface/60 cursor-pointer"
            >
              <span className="text-sm font-medium text-ink">{s.nome}</span>
              <span className="text-sm text-ink/60">{formatarMoeda(s.valor)}</span>
            </div>
          ))
        )}
      </div>

      {detalhe && (
        <div
          className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6"
          onClick={() => setDetalhe(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-surface p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <p className="font-bold text-ink text-lg leading-tight">{detalhe.nome}</p>
              <button onClick={() => setDetalhe(null)} className="text-ink/40 hover:text-ink text-lg leading-none">
                ✕
              </button>
            </div>

            <div className="rounded-2xl bg-card p-4 mb-4 shadow-sm">
              <p className="text-xs text-ink/50 mb-0.5">Valor</p>
              <p className="text-xl font-extrabold text-forest">{formatarMoeda(detalhe.valor)}</p>
            </div>

            {detalhe.descricao && (
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">Descrição</p>
                <div className="rounded-2xl bg-card p-4 shadow-sm">
                  <p className="text-sm text-ink whitespace-pre-wrap">{detalhe.descricao}</p>
                </div>
              </div>
            )}

            {detalhe.entregaveis && (
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">Entregáveis</p>
                <div className="rounded-2xl bg-card p-4 shadow-sm">
                  <ul className="text-sm text-ink space-y-1 list-disc list-inside">
                    {detalhe.entregaveis.split("\n").filter(Boolean).map((linha, i) => (
                      <li key={i}>{linha}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setEditando(detalhe);
                  setDetalhe(null);
                  setPainelAberto(false);
                }}
                className="flex-1 rounded-full bg-forest text-white px-5 py-2.5 text-sm font-bold hover:bg-ink transition-colors"
              >
                Editar serviço
              </button>
              <button
                onClick={() => remover(detalhe.id)}
                className="text-sm font-semibold text-red-500 hover:text-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ServicoForm({
  servicoEditando,
  onSaved,
  onCancel,
}: {
  servicoEditando: Servico | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const editando = !!servicoEditando;
  const [nome, setNome] = useState(servicoEditando?.nome ?? "");
  const [descricao, setDescricao] = useState(servicoEditando?.descricao ?? "");
  const [entregaveis, setEntregaveis] = useState(servicoEditando?.entregaveis ?? "");
  const [valor, setValor] = useState(servicoEditando?.valor != null ? String(servicoEditando.valor) : "");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setErro("Informe o nome do serviço.");
      return;
    }
    setSaving(true);
    setErro(null);
    try {
      const supabase = createClient();
      const payload = {
        nome: nome.trim(),
        descricao: descricao || null,
        entregaveis: entregaveis || null,
        valor: valor ? Number(valor) : null,
      };
      if (editando && servicoEditando) {
        const { error } = await supabase.from("servicos").update(payload).eq("id", servicoEditando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("servicos").insert(payload);
        if (error) throw error;
      }
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar serviço.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="block col-span-2 sm:col-span-1">
          <span className="block text-sm font-medium text-ink/70 mb-1">Nome do serviço *</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" required />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-ink/70 mb-1">Valor (R$)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="input"
            placeholder="Opcional"
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-ink/70 mb-1">Descrição</span>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="input"
          rows={3}
          placeholder="Do que se trata esse serviço..."
        />
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-ink/70 mb-1">Entregáveis</span>
        <textarea
          value={entregaveis}
          onChange={(e) => setEntregaveis(e.target.value)}
          className="input"
          rows={4}
          placeholder={"Um por linha, ex:\n4 posts por semana\n1 reunião mensal\nRelatório de resultados"}
        />
        <span className="block text-xs text-ink/40 mt-1">Um item por linha.</span>
      </label>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
        >
          {saving ? "Salvando..." : editando ? "Salvar alterações" : "Salvar serviço"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-ink/60 hover:text-ink">
          Cancelar
        </button>
      </div>
    </form>
  );
}
