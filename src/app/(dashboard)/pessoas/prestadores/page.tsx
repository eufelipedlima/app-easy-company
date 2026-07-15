"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PessoaForm } from "@/components/pessoa-form";

interface Prestador {
  id: string;
  tipo_servico: string | null;
  observacoes: string | null;
  pix: string | null;
  papeis: { pessoas: { nome: string; whatsapp: string | null; email: string | null } | null } | null;
}

interface PessoaOpcao {
  id: string;
  nome: string;
  tipo_pessoa: "PF" | "PJ";
}

export default function PrestadoresPage() {
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("prestadores")
      .select("id, tipo_servico, observacoes, pix, papeis ( pessoas ( nome, whatsapp, email ) )")
      .eq("ativo", true)
      .order("created_at", { ascending: false });
    setPrestadores((data as unknown as Prestador[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function remover(id: string) {
    const supabase = createClient();
    await supabase.from("prestadores").update({ ativo: false }).eq("id", id);
    carregar();
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-6">
        {!painelAberto && (
          <button
            onClick={() => setPainelAberto(true)}
            className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
          >
            + Novo prestador
          </button>
        )}
      </div>

      {painelAberto && (
        <div className="mb-8 rounded-3xl bg-card border border-black/5 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-ink mb-6">Cadastrar prestador de serviço</h2>
          <PrestadorForm
            onSaved={() => {
              setPainelAberto(false);
              carregar();
            }}
            onCancel={() => setPainelAberto(false)}
          />
        </div>
      )}

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-ink/50">Carregando...</p>
        ) : prestadores.length === 0 ? (
          <p className="p-6 text-sm text-ink/50">Nenhum prestador cadastrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/50 border-b border-black/5">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Tipo de serviço</th>
                <th className="px-4 py-3 font-medium">Contato</th>
                <th className="px-4 py-3 font-medium">PIX</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {prestadores.map((p) => (
                <tr key={p.id} className="border-b border-black/5 last:border-0 hover:bg-surface/60">
                  <td className="px-4 py-3 font-semibold text-ink">{p.papeis?.pessoas?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-ink/70">{p.tipo_servico ?? "—"}</td>
                  <td className="px-4 py-3 text-ink/70">
                    {p.papeis?.pessoas?.whatsapp && <span className="block">{p.papeis.pessoas.whatsapp}</span>}
                    {p.papeis?.pessoas?.email && <span className="block text-xs text-ink/50">{p.papeis.pessoas.email}</span>}
                  </td>
                  <td className="px-4 py-3 text-ink/70">{p.pix ?? "—"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => remover(p.id)}
                      className="text-xs font-semibold text-ink/40 hover:text-red-600"
                    >
                      Desativar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PrestadorForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [pessoas, setPessoas] = useState<PessoaOpcao[]>([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<PessoaOpcao | null>(null);
  const [busca, setBusca] = useState("");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [cadastrandoPessoa, setCadastrandoPessoa] = useState(false);
  const [tipoServico, setTipoServico] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [pix, setPix] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregarPessoas() {
      const supabase = createClient();
      const { data } = await supabase.from("pessoas").select("id, nome, tipo_pessoa").order("nome");
      setPessoas(data ?? []);
    }
    carregarPessoas();
  }, []);

  const sugestoes = pessoas.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase()));

  async function garantirPrestadorPapelId(pessoaId: string): Promise<string> {
    const supabase = createClient();
    const { data: existente } = await supabase
      .from("papeis")
      .select("id")
      .eq("pessoa_id", pessoaId)
      .eq("papel", "prestador")
      .maybeSingle();
    if (existente?.id) return existente.id;

    const { data: novo, error } = await supabase
      .from("papeis")
      .insert({ pessoa_id: pessoaId, papel: "prestador" })
      .select("id")
      .single();
    if (error) throw error;
    return novo.id;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pessoaSelecionada) {
      setErro("Selecione a pessoa.");
      return;
    }
    setSaving(true);
    setErro(null);
    try {
      const supabase = createClient();
      const papelId = await garantirPrestadorPapelId(pessoaSelecionada.id);
      const { error } = await supabase.from("prestadores").insert({
        papel_id: papelId,
        tipo_servico: tipoServico || null,
        observacoes: observacoes || null,
        pix: pix || null,
      });
      if (error) throw error;
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (cadastrandoPessoa) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setCadastrandoPessoa(false)}
          className="text-sm font-semibold text-ink/50 hover:text-ink mb-4"
        >
          ← Voltar
        </button>
        <PessoaForm
          nomeInicial={busca}
          onCancel={() => setCadastrandoPessoa(false)}
          onSaved={async (pessoa) => {
            const supabase = createClient();
            const { data } = await supabase.from("pessoas").select("id, nome, tipo_pessoa").order("nome");
            setPessoas(data ?? []);
            setPessoaSelecionada(data?.find((p) => p.id === pessoa.id) ?? { id: pessoa.id, nome: pessoa.nome, tipo_pessoa: "PF" });
            setBusca(pessoa.nome);
            setCadastrandoPessoa(false);
          }}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="relative">
        <span className="block text-sm font-medium text-ink/70 mb-1">
          Pessoa<span className="text-forest"> *</span>
        </span>
        <input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPessoaSelecionada(null);
            setMostrarSugestoes(true);
          }}
          onFocus={() => setMostrarSugestoes(true)}
          className="input"
          placeholder="Digite o nome..."
        />
        {mostrarSugestoes && busca && !pessoaSelecionada && (
          <div className="absolute z-10 mt-1 w-full rounded-xl bg-white border border-black/10 shadow-lg max-h-56 overflow-auto">
            {sugestoes.length > 0 ? (
              sugestoes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPessoaSelecionada(p);
                    setBusca(p.nome);
                    setMostrarSugestoes(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface"
                >
                  {p.nome}
                </button>
              ))
            ) : (
              <button
                type="button"
                onClick={() => setCadastrandoPessoa(true)}
                className="w-full text-left px-4 py-2.5 text-sm font-semibold text-forest hover:bg-surface"
              >
                + Cadastrar &ldquo;{busca}&rdquo; como nova pessoa
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium text-ink/70 mb-1">Tipo de serviço</span>
          <input
            value={tipoServico}
            onChange={(e) => setTipoServico(e.target.value)}
            className="input"
            placeholder="Ex: Design, Copywriting..."
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-ink/70 mb-1">Chave PIX</span>
          <input
            value={pix}
            onChange={(e) => setPix(e.target.value)}
            className="input"
            placeholder="CPF, e-mail, telefone ou aleatória"
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-ink/70 mb-1">Observações</span>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          className="input"
          rows={3}
        />
      </label>

      <p className="text-xs text-ink/40">
        Não tem salário fixo — os pagamentos são lançados individualmente em Financeiro &gt;
        Lançamentos, selecionando essa pessoa.
      </p>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar prestador"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-ink/60 hover:text-ink">
          Cancelar
        </button>
      </div>
    </form>
  );
}
