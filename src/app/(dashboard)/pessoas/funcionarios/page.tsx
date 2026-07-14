"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PessoaForm } from "@/components/pessoa-form";

interface Beneficio {
  id: string;
  nome: string;
  valor: number;
}

interface Funcionario {
  id: string;
  papel_id: string;
  cargo: string | null;
  salario: number;
  data_admissao: string | null;
  papeis: { pessoas: { nome: string } | null } | null;
}

interface PessoaOpcao {
  id: string;
  nome: string;
  tipo_pessoa: "PF" | "PJ";
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string | null) {
  if (!data) return "—";
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
}

export default function FuncionariosPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [beneficiosPorFuncionario, setBeneficiosPorFuncionario] = useState<Record<string, Beneficio[]>>({});
  const [loading, setLoading] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);
  const [detalhe, setDetalhe] = useState<Funcionario | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: func } = await supabase
      .from("funcionarios")
      .select("id, papel_id, cargo, salario, data_admissao, papeis ( pessoas ( nome ) )")
      .eq("ativo", true)
      .order("created_at", { ascending: false });

    const lista = (func as unknown as Funcionario[]) ?? [];
    setFuncionarios(lista);

    if (lista.length > 0) {
      const { data: beneficios } = await supabase
        .from("funcionario_beneficios")
        .select("id, funcionario_id, nome, valor")
        .in("funcionario_id", lista.map((f) => f.id));

      const agrupado: Record<string, Beneficio[]> = {};
      (beneficios ?? []).forEach((b) => {
        if (!agrupado[b.funcionario_id]) agrupado[b.funcionario_id] = [];
        agrupado[b.funcionario_id].push({ id: b.id, nome: b.nome, valor: b.valor });
      });
      setBeneficiosPorFuncionario(agrupado);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function custoTotal(f: Funcionario) {
    const beneficios = beneficiosPorFuncionario[f.id] ?? [];
    return f.salario + beneficios.reduce((s, b) => s + b.valor, 0);
  }

  async function remover(id: string) {
    const supabase = createClient();
    await supabase.from("funcionarios").update({ ativo: false }).eq("id", id);
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
            + Novo funcionário
          </button>
        )}
      </div>

      {painelAberto && (
        <div className="mb-8 rounded-3xl bg-card border border-black/5 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-ink mb-6">Cadastrar funcionário</h2>
          <FuncionarioForm
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
        ) : funcionarios.length === 0 ? (
          <p className="p-6 text-sm text-ink/50">Nenhum funcionário cadastrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/50 border-b border-black/5">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Cargo</th>
                <th className="px-4 py-3 font-medium">Salário</th>
                <th className="px-4 py-3 font-medium">Custo total</th>
                <th className="px-4 py-3 font-medium">Admissão</th>
              </tr>
            </thead>
            <tbody>
              {funcionarios.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => setDetalhe(f)}
                  className="border-b border-black/5 last:border-0 hover:bg-surface/60 cursor-pointer"
                >
                  <td className="px-4 py-3 font-semibold text-ink">{f.papeis?.pessoas?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-ink/70">{f.cargo ?? "—"}</td>
                  <td className="px-4 py-3 text-ink/70">{formatarMoeda(f.salario)}</td>
                  <td className="px-4 py-3 font-semibold text-forest">{formatarMoeda(custoTotal(f))}</td>
                  <td className="px-4 py-3 text-ink/70">{formatarData(f.data_admissao)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detalhe && (
        <DetalheFuncionario
          funcionario={detalhe}
          beneficios={beneficiosPorFuncionario[detalhe.id] ?? []}
          onClose={() => setDetalhe(null)}
          onChange={carregar}
          onRemover={() => {
            remover(detalhe.id);
            setDetalhe(null);
          }}
        />
      )}
    </div>
  );
}

function DetalheFuncionario({
  funcionario,
  beneficios,
  onClose,
  onChange,
  onRemover,
}: {
  funcionario: Funcionario;
  beneficios: Beneficio[];
  onClose: () => void;
  onChange: () => void;
  onRemover: () => void;
}) {
  const [nomeBeneficio, setNomeBeneficio] = useState("");
  const [valorBeneficio, setValorBeneficio] = useState("");
  const [salvando, setSalvando] = useState(false);

  const custoTotal = funcionario.salario + beneficios.reduce((s, b) => s + b.valor, 0);

  async function adicionarBeneficio(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeBeneficio.trim() || !valorBeneficio) return;
    setSalvando(true);
    const supabase = createClient();
    await supabase.from("funcionario_beneficios").insert({
      funcionario_id: funcionario.id,
      nome: nomeBeneficio.trim(),
      valor: Number(valorBeneficio),
    });
    setNomeBeneficio("");
    setValorBeneficio("");
    setSalvando(false);
    onChange();
  }

  async function removerBeneficio(id: string) {
    const supabase = createClient();
    await supabase.from("funcionario_beneficios").delete().eq("id", id);
    onChange();
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl bg-surface p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="font-bold text-ink leading-tight">{funcionario.papeis?.pessoas?.nome ?? "—"}</p>
            {funcionario.cargo && <p className="text-xs text-ink/50">{funcionario.cargo}</p>}
          </div>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-lg leading-none">
            ✕
          </button>
        </div>

        <div className="rounded-2xl bg-card p-4 mb-4 shadow-sm">
          <p className="text-xs text-ink/50 mb-0.5">Custo total mensal</p>
          <p className="text-xl font-extrabold text-forest">{formatarMoeda(custoTotal)}</p>
          <p className="text-xs text-ink/40 mt-3 pt-3 border-t border-black/5">
            Salário base: {formatarMoeda(funcionario.salario)}
          </p>
        </div>

        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">Benefícios</p>
          <div className="rounded-2xl bg-card p-4 shadow-sm space-y-2.5">
            {beneficios.length === 0 ? (
              <p className="text-sm text-ink/40">Nenhum benefício cadastrado.</p>
            ) : (
              beneficios.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink/70">{b.nome}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{formatarMoeda(b.valor)}</span>
                    <button onClick={() => removerBeneficio(b.id)} className="text-xs text-ink/30 hover:text-red-600">
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}

            <form onSubmit={adicionarBeneficio} className="flex gap-2 pt-2 border-t border-black/5">
              <input
                value={nomeBeneficio}
                onChange={(e) => setNomeBeneficio(e.target.value)}
                className="input text-sm"
                placeholder="Vale-refeição..."
              />
              <input
                type="number"
                step="0.01"
                value={valorBeneficio}
                onChange={(e) => setValorBeneficio(e.target.value)}
                className="input text-sm w-28"
                placeholder="R$"
              />
              <button
                type="submit"
                disabled={salvando}
                className="shrink-0 rounded-full bg-forest text-white px-3 text-xs font-bold hover:bg-ink transition-colors"
              >
                +
              </button>
            </form>
          </div>
        </div>

        <button
          onClick={onRemover}
          className="w-full rounded-full border-2 border-red-200 text-red-600 px-5 py-2.5 text-sm font-bold hover:bg-red-50 transition-colors"
        >
          Desativar funcionário
        </button>
      </div>
    </div>
  );
}

function FuncionarioForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [pessoas, setPessoas] = useState<PessoaOpcao[]>([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<PessoaOpcao | null>(null);
  const [busca, setBusca] = useState("");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [cadastrandoPessoa, setCadastrandoPessoa] = useState(false);
  const [cargo, setCargo] = useState("");
  const [salario, setSalario] = useState("");
  const [dataAdmissao, setDataAdmissao] = useState("");
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

  async function garantirFuncionarioPapelId(pessoaId: string): Promise<string> {
    const supabase = createClient();
    const { data: existente } = await supabase
      .from("papeis")
      .select("id")
      .eq("pessoa_id", pessoaId)
      .eq("papel", "funcionario")
      .maybeSingle();
    if (existente?.id) return existente.id;

    const { data: novo, error } = await supabase
      .from("papeis")
      .insert({ pessoa_id: pessoaId, papel: "funcionario" })
      .select("id")
      .single();
    if (error) throw error;
    return novo.id;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pessoaSelecionada || !salario) {
      setErro("Selecione a pessoa e informe o salário.");
      return;
    }
    setSaving(true);
    setErro(null);
    try {
      const supabase = createClient();
      const papelId = await garantirFuncionarioPapelId(pessoaSelecionada.id);
      const { error } = await supabase.from("funcionarios").insert({
        papel_id: papelId,
        cargo: cargo || null,
        salario: Number(salario),
        data_admissao: dataAdmissao || null,
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="block">
          <span className="block text-sm font-medium text-ink/70 mb-1">Cargo</span>
          <input value={cargo} onChange={(e) => setCargo(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-ink/70 mb-1">Salário (R$) *</span>
          <input type="number" step="0.01" min="0" value={salario} onChange={(e) => setSalario(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-ink/70 mb-1">Data de admissão</span>
          <input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} className="input" />
        </label>
      </div>

      <p className="text-xs text-ink/40">
        Depois de salvar, você pode adicionar benefícios (vale-refeição, plano de saúde, etc.) clicando no
        funcionário na lista.
      </p>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar funcionário"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-ink/60 hover:text-ink">
          Cancelar
        </button>
      </div>
    </form>
  );
}
