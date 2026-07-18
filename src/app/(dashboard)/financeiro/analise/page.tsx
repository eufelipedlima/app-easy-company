"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
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
  data_vencimento: string;
  data_quitacao: string | null;
  data_competencia: string | null;
  cliente_id: string | null;
  servicos: { nome: string } | null;
}

interface Funcionario {
  id: string;
  salario: number;
}

interface Beneficio {
  funcionario_id: string;
  valor: number;
  tipo_valor: "mensal" | "diario";
}

function diasUteisNoMes(ano: number, mes: number) {
  let count = 0;
  const data = new Date(ano, mes, 1);
  while (data.getMonth() === mes) {
    const dia = data.getDay();
    if (dia !== 0 && dia !== 6) count++;
    data.setDate(data.getDate() + 1);
  }
  return count;
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
  const [beneficios, setBeneficios] = useState<Beneficio[]>([]);
  const [loading, setLoading] = useState(true);

  const hoje = new Date();
  const [modo, setModo] = useState<"mensal" | "anual">("mensal");
  const [regime, setRegime] = useState<"pago" | "vencimento" | "competencia">("pago");
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const carregar = useMemo(
    () => async () => {
      setLoading(true);
      const supabase = createClient();
      const [{ data: lanc }, { data: func }] = await Promise.all([
        supabase
          .from("lancamentos")
          .select("valor, tipo, situacao, data_vencimento, data_quitacao, data_competencia, cliente_id, servicos ( nome )"),
        supabase.from("funcionarios").select("id, salario").eq("ativo", true),
      ]);
      setLancamentos((lanc as unknown as LancamentoResumo[]) ?? []);
      const listaFunc = (func as unknown as Funcionario[]) ?? [];
      setFuncionarios(listaFunc);

      if (listaFunc.length > 0) {
        const { data: ben } = await supabase
          .from("funcionario_beneficios")
          .select("funcionario_id, valor, tipo_valor")
          .in("funcionario_id", listaFunc.map((f) => f.id));
        setBeneficios((ben as unknown as Beneficio[]) ?? []);
      } else {
        setBeneficios([]);
      }
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

  function dataDoRegime(l: LancamentoResumo): string | null {
    if (regime === "pago") return l.situacao === "pago" ? l.data_quitacao : null;
    if (regime === "vencimento") return l.data_vencimento;
    return l.data_competencia;
  }

  const lancamentosNoPeriodo = lancamentos.filter((l) => noPeriodo(dataDoRegime(l)));
  const pagosNoPeriodo = lancamentosNoPeriodo;
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
    const doMes = lancamentos.filter((l) => {
      const data = dataDoRegime(l);
      return !!data && data >= inicio && data <= fim;
    });
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

  const mesReferencia = modo === "mensal" ? mes : hoje.getMonth();
  const diasUteisReferencia = diasUteisNoMes(ano, mesReferencia);
  const totalFolha =
    funcionarios.reduce((s, f) => s + f.salario + f.salario * 0.08, 0) +
    beneficios.reduce(
      (s, b) => s + (b.tipo_valor === "diario" ? b.valor * diasUteisReferencia : b.valor),
      0
    );
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

      <div className="flex flex-wrap items-center gap-2 mb-8">
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
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="input !w-auto text-sm py-2"
          >
            {MESES.map((nome, i) => (
              <option key={nome} value={i}>
                {nome.slice(0, 3)}
                {i === hoje.getMonth() && ano === hoje.getFullYear() ? " (atual)" : ""}
              </option>
            ))}
          </select>
        )}

        <select
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
          className="input !w-auto text-sm py-2"
        >
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <div className="inline-flex items-center rounded-full bg-surface p-1 shadow-inner ml-auto">
          <button
            onClick={() => setRegime("pago")}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              regime === "pago" ? "bg-ink text-white" : "text-ink/50"
            }`}
          >
            Pagos
          </button>
          <button
            onClick={() => setRegime("vencimento")}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              regime === "vencimento" ? "bg-ink text-white" : "text-ink/50"
            }`}
          >
            Vencimento
          </button>
          <button
            onClick={() => setRegime("competencia")}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              regime === "competencia" ? "bg-ink text-white" : "text-ink/50"
            }`}
          >
            Competência
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Metrica icon={<Wallet size={16} />} label="Faturamento" valor={formatarMoeda(faturamento)} />
        <Metrica icon={<ArrowDownCircle size={16} />} label="Custo total" valor={formatarMoeda(custoTotal)} />
        <Metrica icon={<Percent size={16} />} label="Margem de lucro" valor={`${margemLucro.toFixed(1)}%`} />
        <Metrica icon={<TrendingUp size={16} />} label="Ticket médio" valor={formatarMoeda(ticketMedio)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-3xl bg-card border border-black/5 p-5 h-72 transition-shadow duration-200 hover:shadow-lg">
          <p className="text-sm font-semibold text-ink mb-3">Evolução de faturamento e despesa</p>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={dadosEvolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="#02170B10" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 12, fill: "#02170B99" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#02170B99" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => formatarMoeda(Number(v))} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(2,23,11,0.15)" }} cursor={{ fill: "#E4FFEF", opacity: 0.4 }} />
              <Line type="monotone" dataKey="Faturamento" stroke="#143421" strokeWidth={3} dot={{ r: 3, fill: "#143421" }} activeDot={{ r: 6 }} animationDuration={700} />
              <Line type="monotone" dataKey="Despesa" stroke="#dc2626" strokeWidth={3} dot={{ r: 3, fill: "#dc2626" }} activeDot={{ r: 6 }} animationDuration={700} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-3xl bg-card border border-black/5 p-5 h-72 transition-shadow duration-200 hover:shadow-lg">
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
                <Tooltip formatter={(v) => formatarMoeda(Number(v))} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(2,23,11,0.15)" }} cursor={{ fill: "#E4FFEF", opacity: 0.4 }} />
                <Bar dataKey="valor" fill="#143421" radius={[0, 8, 8, 0]} activeBar={{ fill: "#02170B" }} animationDuration={600} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <FolhaDePagamento
        totalColaboradores={funcionarios.length}
        totalFolha={totalFolha}
        mediaFolha={mediaFolha}
      />
    </main>
  );
}

function Metrica({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: string }) {
  return (
    <div className="group rounded-2xl bg-card border border-black/5 p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-forest/20">
      <div className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-mint text-forest mb-3 transition-transform duration-200 group-hover:scale-110 group-hover:bg-forest group-hover:text-white">
        {icon}
      </div>
      <p className="text-xl font-extrabold text-ink leading-tight">{valor}</p>
      <p className="text-xs text-ink/50 mt-1">{label}</p>
    </div>
  );
}

function FolhaDePagamento({
  totalColaboradores,
  totalFolha,
  mediaFolha,
}: {
  totalColaboradores: number;
  totalFolha: number;
  mediaFolha: number;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink/40">Folha de pagamento</h2>
        <Link
          href="/pessoas/funcionarios"
          className="rounded-full bg-ink text-white px-4 py-2 text-xs font-bold hover:bg-forest transition-colors"
        >
          Gerenciar em Pessoas →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Metrica icon={<Users size={16} />} label="Colaboradores" valor={String(totalColaboradores)} />
        <Metrica icon={<Wallet size={16} />} label="Valor total (salário + FGTS + benefícios)" valor={formatarMoeda(totalFolha)} />
        <Metrica icon={<TrendingUp size={16} />} label="Média por colaborador" valor={formatarMoeda(mediaFolha)} />
      </div>
    </section>
  );
}
