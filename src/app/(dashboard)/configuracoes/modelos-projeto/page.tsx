"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Etapa {
  id: string;
  titulo: string;
  ordem: number;
}
interface Modelo {
  id: string;
  nome: string;
  descricao: string | null;
  etapas: Etapa[];
}

export default function ModelosProjetoPage() {
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modeloAberto, setModeloAberto] = useState<string | null>(null);
  const [criandoAberto, setCriandoAberto] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: modelosData } = await supabase.from("modelos_projeto").select("id, nome, descricao").order("nome");
    const { data: etapasData } = await supabase.from("modelos_projeto_etapas").select("id, modelo_id, titulo, ordem").order("ordem");
    const lista = (modelosData ?? []).map((m) => ({
      ...m,
      etapas: (etapasData ?? []).filter((e) => e.modelo_id === m.id),
    }));
    setModelos(lista);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function excluirModelo(id: string) {
    if (!window.confirm("Excluir esse modelo de projeto?")) return;
    const supabase = createClient();
    await supabase.from("modelos_projeto").delete().eq("id", id);
    carregar();
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-ink/60">
          Modelos reutilizáveis pra criar projetos com etapas (subtarefas) já prontas — ex: &quot;Criação de Site&quot; com Briefing,
          Wireframe, Design, Desenvolvimento, Entrega.
        </p>
        <button
          onClick={() => setCriandoAberto(true)}
          className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors shrink-0"
        >
          + Novo modelo
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-ink/50">Carregando...</p>
      ) : modelos.length === 0 ? (
        <p className="text-sm text-ink/50">Nenhum modelo cadastrado ainda.</p>
      ) : (
        <div className="space-y-3">
          {modelos.map((m) => (
            <div key={m.id} className="rounded-2xl bg-card border border-black/5 overflow-hidden">
              <button
                onClick={() => setModeloAberto(modeloAberto === m.id ? null : m.id)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface/60 transition-colors"
              >
                <div>
                  <p className="text-sm font-bold text-ink">{m.nome}</p>
                  {m.descricao && <p className="text-xs text-ink/50 mt-0.5">{m.descricao}</p>}
                </div>
                <span className="text-xs text-ink/40">{m.etapas.length} etapas</span>
              </button>
              {modeloAberto === m.id && (
                <div className="px-5 pb-4 space-y-2">
                  <div className="space-y-1">
                    {m.etapas.map((e, i) => (
                      <div key={e.id} className="flex items-center gap-2 text-sm text-ink/70 bg-surface rounded-lg px-3 py-1.5">
                        <span className="text-xs text-ink/40 w-4">{i + 1}.</span>
                        {e.titulo}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => excluirModelo(m.id)} className="text-xs font-semibold text-red-500 hover:text-red-700">
                    Excluir modelo
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {criandoAberto && (
        <NovoModeloModal
          onClose={() => setCriandoAberto(false)}
          onCriado={() => {
            setCriandoAberto(false);
            carregar();
          }}
        />
      )}
    </section>
  );
}

function NovoModeloModal({ onClose, onCriado }: { onClose: () => void; onCriado: () => void }) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [etapas, setEtapas] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function atualizarEtapa(i: number, valor: string) {
    setEtapas((atual) => atual.map((e, idx) => (idx === i ? valor : e)));
  }
  function adicionarEtapa() {
    setEtapas((atual) => [...atual, ""]);
  }
  function removerEtapa(i: number) {
    setEtapas((atual) => atual.filter((_, idx) => idx !== i));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setErro("Dê um nome pro modelo.");
      return;
    }
    setSaving(true);
    setErro(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: modelo, error } = await supabase
      .from("modelos_projeto")
      .insert({ nome: nome.trim(), descricao: descricao.trim() || null, criado_por: user?.id ?? null })
      .select("id")
      .single();
    if (error || !modelo) {
      setErro(error?.message ?? "Erro ao criar modelo.");
      setSaving(false);
      return;
    }
    const etapasValidas = etapas.map((e) => e.trim()).filter(Boolean);
    if (etapasValidas.length > 0) {
      await supabase
        .from("modelos_projeto_etapas")
        .insert(etapasValidas.map((titulo, ordem) => ({ modelo_id: modelo.id, titulo, ordem })));
    }
    setSaving(false);
    onCriado();
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-4">Novo modelo de projeto</h2>
        <form onSubmit={salvar} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Nome *</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" autoFocus placeholder="Ex: Criação de Site" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Descrição</span>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input" rows={2} />
          </label>
          <div>
            <span className="block text-sm font-medium text-ink/70 mb-1">Etapas (viram subtarefas)</span>
            <div className="space-y-1.5">
              {etapas.map((etapa, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={etapa}
                    onChange={(e) => atualizarEtapa(i, e.target.value)}
                    className="input text-sm"
                    placeholder={`Etapa ${i + 1}`}
                  />
                  {etapas.length > 1 && (
                    <button type="button" onClick={() => removerEtapa(i)} className="text-ink/30 hover:text-red-600 shrink-0 px-1">
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={adicionarEtapa} className="text-xs font-semibold text-forest hover:text-ink mt-2">
              + Adicionar etapa
            </button>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
            >
              {saving ? "Criando..." : "Criar modelo"}
            </button>
            <button type="button" onClick={onClose} className="text-sm font-semibold text-ink/60 hover:text-ink">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
