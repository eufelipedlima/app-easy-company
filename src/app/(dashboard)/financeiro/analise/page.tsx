"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PessoaForm } from "@/components/pessoa-form";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, Wallet, Percent, ArrowDownCircle, Users } from "lucide-react";

interface LancamentoResumo {
  valor: number;
  tipo: "receita" | "despesa";
  situacao: "pendente" | "pago";
  data_quitacao: string | null;
  cliente_id: string | null;
  servicos: { nome: string } | null;
}

interface Funcionario {
  id: string;
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

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AnaliseFinanceiraPage() {
  const [lancamentos, setLancamentos] = useState<LancamentoResumo[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);

  const hoje = new Date();
  const [modo, setModo] = useState<"mensal" | "anual">("mensal");
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const carregar = useMemo(
    () => async () => {
      setLoading(true);
      const supabase = createClient();
      const [{ data: lanc }, { data: func }] = await Promise.all([
        supabase
          .from("lancamentos")
          .select("valor, tipo, situacao, data_quitacao, cliente_id, servicos ( nome )"),
        supabase
          .from("funcionarios")
          .select("id, cargo, salario, data_admissao, papeis ( pessoas ( nome ) )")
          .eq("ativo", true),
      ]);
      setLancamentos((lanc as unknown as LancamentoResumo[]) ?? []);
      setFuncionarios((func as unknown as Funcionario[]) ?? []);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  const periodo = useMemo(() => {
    if (modo === "anual") {
      return { inicio: toISODate(new Date(ano, 0, 1)), fim: toISODate(new Date(ano, 11, 31)) };
    }
    return { inicio: toISODate(new Date(ano, mes, 1)), fim: toISODate(new Date(ano, mes + 1, 0)) };
  }, [modo, mes, ano]);

  const noPeriodo = (data: string | null) => !!data && data >= periodo.inicio && data <= periodo.fim;

  const pagosNoPeriodo = lancamentos.filter((l) => l.situacao === "pago" && noPeriodo(l.data_quitacao));
  const faturamento = pagosNoPeriodo.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
  const custoTotal = pagosNoPeriodo.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);
  const margemLucro = faturamento > 0 ? ((faturamento - custoTotal) / faturamento) * 100 : 0;

  const clientesDistintos = new Set(
    pagosNoPeriodo.filter((l) => l.tipo === "receita" && l.cliente_id).map((l) => l.cliente_id)
  );
  const ticketMedio = clientesDistintos.size > 0 ? faturamento / clientesDistintos.size : 0;

  const mesesEvolucao = useMemo(() => {
    const lista: { label: string; ano: number; mes: number }[] = [];
    if (modo === "anual") {
      for (let m = 0; m < 12; m++) lista.push({ label: MESES[m].slice(0, 3), ano, mes: m });
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(ano, mes - i, 1);
        lista.push({
          label: `${MESES[d.getMonth()].slice(0, 3)}/${String(d.getFullYear()).slice(2)}`,
          ano: d.getFullYear(),
          mes: d.getMonth(),
        });
      }
    }
    return lista;
  }, [modo, mes, ano]);

  const dadosEvolucao = mesesEvolucao.map(({ label, ano: a, mes: m }) => {
    const inicio = toISODate(new Date(a, m, 1));
    const fim = toISODate(new Date(a, m + 1, 0));
    const doMes = lancamentos.filter(
      (l) => l.situacao === "pago" && l.data_quitacao && l.data_quitacao >= inicio && l.data_quitacao <= fim
    );
    return {
      nome: label,
      Faturamento: doMes.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0),
      Despesa: doMes.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0),
    };
  });

  const distribuicaoServico = useMemo(() => {
    const mapa = new Map<string, number>();
    pagosNoPeriodo
      .filter((l) => l.tipo === "receita")
      .forEach((l) => {
        const nome = l.servicos?.nome ?? "Sem serviço";
        mapa.set(nome, (mapa.get(nome) ?? 0) + l.valor);
      });
    return Array.from(mapa.entries())
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [pagosNoPeriodo]);

  const totalFolha = funcionarios.reduce((s, f) => s + f.salario, 0);
  const mediaFolha = funcionarios.length > 0 ? totalFolha / funcionarios.length : 0;

  const anos = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - 2 + i);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-ink/50">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-ink">Análise financeira</h1>
        <p className="text-sm text-ink/60 mt-1">Visão geral de faturamento, custos e margem.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div className="inline-flex items-center rounded-full bg-surface p-1 shadow-inner">
          <button
            onClick={() => setModo("mensal")}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              modo === "mensal" ? "bg-ink text-white" : "text-ink/50"
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setModo("anual")}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              modo === "anual" ? "bg-ink text-white" : "text-ink/50"
            }`}
          >
            Anual
          </button>
        </div>

        {modo === "mensal" && (
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="input w-auto">
            {MESES.map((nome, i) => (
              <option key={nome} value={i}>
                {nome}
                {i === hoje.getMonth() && ano === hoje.getFullYear() ? " (atual)" : ""}
              </option>
            ))}
          </select>
        )}

        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="input w-auto">
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Metrica icon={<Wallet size={16} />} label="Faturamento" valor={formatarMoeda(faturamento)} />
        <Metrica icon={<TrendingUp size={16} />} label="Ticket médio" valor={formatarMoeda(ticketMedio)} />
        <Metrica icon={<Percent size={16} />} label="Margem de lucro" valor={`${margemLucro.toFixed(1)}%`} />
        <Metrica icon={<ArrowDownCircle size={16} />} label="Custo total" valor={formatarMoeda(custoTotal)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-3xl bg-card border border-black/5 p-5 h-72">
          <p className="text-sm font-semibold text-ink mb-3">Evolução de faturamento e despesa</p>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={dadosEvolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="#02170B10" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 12, fill: "#02170B99" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#02170B99" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
              <Line type="monotone" dataKey="Faturamento" stroke="#143421" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Despesa" stroke="#dc2626" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-3xl bg-card border border-black/5 p-5 h-72">
          <p className="text-sm font-semibold text-ink mb-3">Faturamento por serviço</p>
          {distribuicaoServico.length === 0 ? (
            <p className="text-sm text-ink/40 mt-8 text-center">Nenhuma receita paga com serviço no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={distribuicaoServico} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#02170B10" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#02170B99" }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="nome"
                  tick={{ fontSize: 12, fill: "#02170B99" }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                <Bar dataKey="valor" fill="#143421" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <FolhaDePagamento
        funcionarios={funcionarios}
        totalFolha={totalFolha}
        mediaFolha={mediaFolha}
        onChange={carregar}
      />
    </main>
  );
}

function Metrica({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: string }) {
  return (
    <div className="rounded-2xl bg-card border border-black/5 p-4">
      <div className="flex items-center gap-2 text-forest mb-2">{icon}</div>
      <p className="text-xl font-extrabold text-ink leading-tight">{valor}</p>
      <p className="text-xs text-ink/50 mt-1">{label}</p>
    </div>
  );
}

function FolhaDePagamento({
  funcionarios,
  totalFolha,
  mediaFolha,
  onChange,
}: {
  funcionarios: Funcionario[];
  totalFolha: number;
  mediaFolha: number;
  onChange: () => void;
}) {
  const [painelAberto, setPainelAberto] = useState(false);
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

  async function adicionar(e: React.FormEvent) {
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

      setPessoaSelecionada(null);
      setBusca("");
      setCargo("");
      setSalario("");
      setDataAdmissao("");
      setPainelAberto(false);
      onChange();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remover(id: string) {
    const supabase = createClient();
    await supabase.from("funcionarios").update({ ativo: false }).eq("id", id);
    onChange();
  }

  if (cadastrandoPessoa) {
    return (
      <div className="rounded-3xl bg-card border border-black/5 p-6">
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
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink/40">Folha de pagamento</h2>
        {!painelAberto && (
          <button
            onClick={() => setPainelAberto(true)}
            className="rounded-full bg-ink text-white px-4 py-2 text-xs font-bold hover:bg-forest transition-colors"
          >
            + Adicionar colaborador
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Metrica icon={<Users size={16} />} label="Colaboradores" valor={String(funcionarios.length)} />
        <Metrica icon={<Wallet size={16} />} label="Valor total" valor={formatarMoeda(totalFolha)} />
        <Metrica icon={<TrendingUp size={16} />} label="Média" valor={formatarMoeda(mediaFolha)} />
      </div>

      {painelAberto && (
        <form onSubmit={adicionar} className="rounded-3xl bg-card border border-black/5 p-6 mb-6 space-y-4">
          <div className="relative">
            <span className="block text-sm font-medium text-ink/70 mb-1">Colaborador *</span>
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
              <input
                type="number"
                step="0.01"
                min="0"
                value={salario}
                onChange={(e) => setSalario(e.target.value)}
                className="input"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ink/70 mb-1">Data de admissão</span>
              <input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} className="input" />
            </label>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Adicionar"}
            </button>
            <button type="button" onClick={() => setPainelAberto(false)} className="text-sm font-semibold text-ink/60 hover:text-ink">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        {funcionarios.length === 0 ? (
          <p className="p-4 text-sm text-ink/50">Nenhum colaborador cadastrado ainda.</p>
        ) : (
          funcionarios.map((f) => (
            <div key={f.id} className="flex items-center justify-between px-4 py-3 border-b border-black/5 last:border-0">
              <div>
                <p className="text-sm font-semibold text-ink">{f.papeis?.pessoas?.nome ?? "—"}</p>
                {f.cargo && <p className="text-xs text-ink/50">{f.cargo}</p>}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-ink">{formatarMoeda(f.salario)}</span>
                <button onClick={() => remover(f.id)} className="text-xs font-semibold text-ink/40 hover:text-red-600">
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
