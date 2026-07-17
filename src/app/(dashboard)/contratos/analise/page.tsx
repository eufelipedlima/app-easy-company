"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Users, TrendingUp, Clock, Wallet, TrendingDown, Package, Timer, UserPlus } from "lucide-react";

interface ContratoRecorrente {
  cliente_id: string | null;
  status: "ativo" | "encerrado";
  valor_mensal: number | null;
  data_primeira_mensalidade: string | null;
  data_encerramento: string | null;
}

interface ContratoPontual {
  status: "ativo" | "concluido" | "arquivado";
  valor_total: number | null;
  data_fechamento: string | null;
  data_encerramento: string | null;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mesesDeCasa(inicio: string | null, fim: Date) {
  if (!inicio) return 0;
  const d1 = new Date(inicio + "T00:00:00");
  let meses = (fim.getFullYear() - d1.getFullYear()) * 12 + (fim.getMonth() - d1.getMonth());
  if (fim.getDate() < d1.getDate()) meses -= 1;
  return Math.max(meses, 0);
}

function diasEntre(inicio: string, fim: string) {
  const d1 = new Date(inicio + "T00:00:00");
  const d2 = new Date(fim + "T00:00:00");
  return Math.max(Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)), 0);
}

// Métricas calculadas "como se fosse" o fim de um mês específico — pra dar o
// snapshot correto mesmo pra meses passados, e não só o estado atual. Conta por
// contrato (não por cliente único), já que nem todo cliente assinado
// necessariamente já tem um contrato registrado.
function calcularMetricas(recorrentes: ContratoRecorrente[], fimDoMes: Date, inicioDoMes: Date) {
  function ativoEm(c: ContratoRecorrente, data: Date) {
    if (!c.data_primeira_mensalidade) return false;
    const inicio = new Date(c.data_primeira_mensalidade + "T00:00:00");
    if (inicio > data) return false;
    if (c.data_encerramento) {
      const encerramento = new Date(c.data_encerramento + "T00:00:00");
      if (encerramento <= data) return false;
    }
    return true;
  }

  const ativosNoFim = recorrentes.filter((c) => ativoEm(c, fimDoMes));
  const ativosNoInicio = recorrentes.filter((c) => ativoEm(c, inicioDoMes));

  const novos = recorrentes.filter((c) => {
    if (!c.data_primeira_mensalidade) return false;
    const inicio = new Date(c.data_primeira_mensalidade + "T00:00:00");
    return inicio >= inicioDoMes && inicio <= fimDoMes;
  });

  const encerradosNoMes = recorrentes.filter((c) => {
    if (!c.data_encerramento) return false;
    const encerramento = new Date(c.data_encerramento + "T00:00:00");
    return encerramento >= inicioDoMes && encerramento <= fimDoMes;
  });

  const temposDeCasa = ativosNoFim.map((c) => mesesDeCasa(c.data_primeira_mensalidade, fimDoMes));
  const tempoMedioEmCasa = temposDeCasa.length > 0 ? temposDeCasa.reduce((a, b) => a + b, 0) / temposDeCasa.length : 0;

  const ltvs = ativosNoFim.map((c) => mesesDeCasa(c.data_primeira_mensalidade, fimDoMes) * (c.valor_mensal ?? 0));
  const ltvMedio = ltvs.length > 0 ? ltvs.reduce((a, b) => a + b, 0) / ltvs.length : 0;

  const churn = ativosNoInicio.length > 0 ? (encerradosNoMes.length / ativosNoInicio.length) * 100 : 0;

  return {
    contratosAtivos: ativosNoFim.length,
    novosContratos: novos.length,
    tempoMedioEmCasa,
    ltvMedio,
    churn,
  };
}

function calcularMetricasPontuais(pontuais: ContratoPontual[], fimDoMes: Date, inicioDoMes: Date) {
  const emAndamento = pontuais.filter((c) => {
    if (!c.data_fechamento) return false;
    const inicio = new Date(c.data_fechamento + "T00:00:00");
    if (inicio > fimDoMes) return false;
    if (c.data_encerramento) {
      const encerramento = new Date(c.data_encerramento + "T00:00:00");
      if (encerramento <= fimDoMes) return false;
    }
    return true;
  });

  const novos = pontuais.filter((c) => {
    if (!c.data_fechamento) return false;
    const d = new Date(c.data_fechamento + "T00:00:00");
    return d >= inicioDoMes && d <= fimDoMes;
  });

  const totalAteAgora = pontuais.filter((c) => {
    if (!c.data_fechamento) return false;
    const d = new Date(c.data_fechamento + "T00:00:00");
    return d <= fimDoMes;
  });

  const concluidosNoMes = pontuais.filter((c) => {
    if (!c.data_encerramento || !c.data_fechamento) return false;
    const d = new Date(c.data_encerramento + "T00:00:00");
    return d >= inicioDoMes && d <= fimDoMes;
  });
  const temposConclusaoMes = concluidosNoMes.map((c) => diasEntre(c.data_fechamento!, c.data_encerramento!));
  const tempoMedioConcluirMes =
    temposConclusaoMes.length > 0 ? temposConclusaoMes.reduce((a, b) => a + b, 0) / temposConclusaoMes.length : 0;

  return {
    emAndamento: emAndamento.length,
    novosContratos: novos.length,
    valorNovosContratos: novos.reduce((s, c) => s + (c.valor_total ?? 0), 0),
    totalContratos: totalAteAgora.length,
    valorTotalContratos: totalAteAgora.reduce((s, c) => s + (c.valor_total ?? 0), 0),
    tempoMedioConcluir: tempoMedioConcluirMes,
  };
}


export default function AnaliseContratosPage() {
  const hoje = new Date();
  const [recorrentes, setRecorrentes] = useState<ContratoRecorrente[]>([]);
  const [pontuais, setPontuais] = useState<ContratoPontual[]>([]);
  const [loading, setLoading] = useState(true);
  const [modo, setModo] = useState<"mensal" | "anual">("mensal");
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase
          .from("contratos")
          .select("cliente_id, status, valor_mensal, data_primeira_mensalidade, data_encerramento")
          .eq("tipo_contrato", "recorrente"),
        supabase
          .from("contratos")
          .select("status, valor_total, data_fechamento, data_encerramento")
          .eq("tipo_contrato", "pontual"),
      ]);
      setRecorrentes((r as unknown as ContratoRecorrente[]) ?? []);
      setPontuais((p as unknown as ContratoPontual[]) ?? []);
      setLoading(false);
    }
    carregar();
  }, []);

  if (loading) {
    return <p className="text-sm text-ink/50">Carregando...</p>;
  }

  const fimDoMesSelecionado = new Date(ano, mes + 1, 0);
  const inicioDoMesSelecionado = new Date(ano, mes, 1);

  const metricas =
    modo === "mensal"
      ? calcularMetricas(recorrentes, fimDoMesSelecionado, inicioDoMesSelecionado)
      : calcularMetricas(recorrentes, new Date(ano, 11, 31), new Date(ano, 0, 1));

  // Série mensal pro gráfico de crescimento: últimos 6 meses (modo mensal, terminando
  // no mês escolhido) ou os 12 meses do ano escolhido (modo anual)
  const serie = (
    modo === "mensal"
      ? Array.from({ length: 6 }, (_, i) => {
          const d = new Date(ano, mes - 5 + i, 1);
          return { ano: d.getFullYear(), mes: d.getMonth() };
        })
      : Array.from({ length: 12 }, (_, i) => ({ ano, mes: i }))
  ).map(({ ano: a, mes: m }) => {
    const fim = new Date(a, m + 1, 0);
    const inicio = new Date(a, m, 1);
    const met = calcularMetricas(recorrentes, fim, inicio);
    return {
      label: `${MESES[m].slice(0, 3)}/${String(a).slice(2)}`,
      contratosAtivos: met.contratosAtivos,
      ltvMedio: Math.round(met.ltvMedio),
      churn: Number(met.churn.toFixed(1)),
    };
  });

  const metricasPontuais =
    modo === "mensal"
      ? calcularMetricasPontuais(pontuais, fimDoMesSelecionado, inicioDoMesSelecionado)
      : calcularMetricasPontuais(pontuais, new Date(ano, 11, 31), new Date(ano, 0, 1));

  const seriePontuais = (
    modo === "mensal"
      ? Array.from({ length: 6 }, (_, i) => {
          const d = new Date(ano, mes - 5 + i, 1);
          return { ano: d.getFullYear(), mes: d.getMonth() };
        })
      : Array.from({ length: 12 }, (_, i) => ({ ano, mes: i }))
  ).map(({ ano: a, mes: m }) => {
    const fim = new Date(a, m + 1, 0);
    const inicio = new Date(a, m, 1);
    const met = calcularMetricasPontuais(pontuais, fim, inicio);
    return {
      label: `${MESES[m].slice(0, 3)}/${String(a).slice(2)}`,
      novosContratos: met.novosContratos,
      valorNovosContratos: Math.round(met.valorNovosContratos),
      totalContratos: met.totalContratos,
    };
  });

  return (
    <div className="space-y-10">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink/40">Recorrentes</h2>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1">
              <button
                onClick={() => setModo("mensal")}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  modo === "mensal" ? "bg-ink text-white" : "text-ink/60"
                }`}
              >
                Mensal
              </button>
              <button
                onClick={() => setModo("anual")}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  modo === "anual" ? "bg-ink text-white" : "text-ink/60"
                }`}
              >
                Anual
              </button>
            </div>
            {modo === "mensal" && (
              <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="input py-1.5 !w-auto">
                {MESES.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>
            )}
            <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="input py-1.5 !w-auto">
              {Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - 3 + i).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Metrica icon={<Users size={16} />} label="Contratos ativos" valor={String(metricas.contratosAtivos)} />
          <Metrica icon={<UserPlus size={16} />} label="Novos contratos" valor={String(metricas.novosContratos)} />
          <Metrica
            icon={<Clock size={16} />}
            label="Tempo de casa"
            valor={`${metricas.tempoMedioEmCasa.toFixed(1)} meses`}
          />
          <Metrica icon={<TrendingUp size={16} />} label="LTV médio" valor={formatarMoeda(metricas.ltvMedio)} />
          <Metrica icon={<TrendingDown size={16} />} label="Churn" valor={`${metricas.churn.toFixed(1)}%`} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GraficoCrescimento titulo="Contratos ativos por mês" dataKey="contratosAtivos" dados={serie} cor="#143421" />
          <GraficoCrescimento titulo="LTV médio por mês" dataKey="ltvMedio" dados={serie} cor="#02170B" formatoMoeda />
          <GraficoCrescimento titulo="Churn por mês (%)" dataKey="churn" dados={serie} cor="#DC2626" sufixo="%" />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink/40 mb-4">Pontuais</h2>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Metrica icon={<Clock size={16} />} label="Contratos em andamento" valor={String(metricasPontuais.emAndamento)} />
          <Metrica icon={<UserPlus size={16} />} label="Novos contratos" valor={String(metricasPontuais.novosContratos)} />
          <Metrica
            icon={<Wallet size={16} />}
            label="Valor de novos contratos"
            valor={formatarMoeda(metricasPontuais.valorNovosContratos)}
          />
          <Metrica icon={<Package size={16} />} label="Total de contratos" valor={String(metricasPontuais.totalContratos)} />
          <Metrica
            icon={<Wallet size={16} />}
            label="Valor total de contratos"
            valor={formatarMoeda(metricasPontuais.valorTotalContratos)}
          />
          <Metrica
            icon={<Timer size={16} />}
            label="Tempo médio para concluir"
            valor={`${Math.round(metricasPontuais.tempoMedioConcluir)} dias`}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GraficoCrescimento titulo="Novos contratos por mês" dataKey="novosContratos" dados={seriePontuais} cor="#143421" />
          <GraficoCrescimento
            titulo="Valor de novos contratos por mês"
            dataKey="valorNovosContratos"
            dados={seriePontuais}
            cor="#02170B"
            formatoMoeda
          />
          <GraficoCrescimento titulo="Total de contratos (acumulado)" dataKey="totalContratos" dados={seriePontuais} cor="#4A7C59" />
        </div>
      </section>
    </div>
  );
}

function GraficoCrescimento({
  titulo,
  dataKey,
  dados,
  cor,
  formatoMoeda,
  sufixo,
}: {
  titulo: string;
  dataKey: string;
  dados: Record<string, string | number>[];
  cor: string;
  formatoMoeda?: boolean;
  sufixo?: string;
}) {
  return (
    <div className="rounded-3xl bg-card border border-black/5 p-5 h-56 transition-shadow duration-200 hover:shadow-lg">
      <p className="text-sm font-semibold text-ink mb-3">{titulo}</p>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={dados}>
          <CartesianGrid strokeDasharray="3 3" stroke="#02170B10" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#02170B99" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "#02170B99" }}
            axisLine={false}
            tickLine={false}
            width={formatoMoeda ? 56 : 32}
            tickFormatter={(v) => (formatoMoeda ? formatarMoeda(Number(v)) : `${v}${sufixo ?? ""}`)}
          />
          <Tooltip
            formatter={(v) => (formatoMoeda ? formatarMoeda(Number(v)) : `${v}${sufixo ?? ""}`)}
            contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(2,23,11,0.15)" }}
          />
          <Line type="monotone" dataKey={dataKey} stroke={cor} strokeWidth={2.5} dot={{ r: 3 }} animationDuration={600} />
        </LineChart>
      </ResponsiveContainer>
    </div>
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
