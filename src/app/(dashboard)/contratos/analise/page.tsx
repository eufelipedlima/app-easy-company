"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Users, TrendingUp, Clock, Wallet, TrendingDown, Package, Timer } from "lucide-react";

interface ContratoRecorrente {
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

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mesesDeCasa(inicio: string | null, fim: string | null) {
  if (!inicio) return 0;
  const d1 = new Date(inicio + "T00:00:00");
  const d2 = fim ? new Date(fim + "T00:00:00") : new Date();
  let meses = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  if (d2.getDate() < d1.getDate()) meses -= 1;
  return Math.max(meses, 0);
}

function diasEntre(inicio: string, fim: string) {
  const d1 = new Date(inicio + "T00:00:00");
  const d2 = new Date(fim + "T00:00:00");
  return Math.max(Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)), 0);
}

export default function AnaliseContratosPage() {
  const [recorrentes, setRecorrentes] = useState<ContratoRecorrente[]>([]);
  const [pontuais, setPontuais] = useState<ContratoPontual[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase
          .from("contratos")
          .select("status, valor_mensal, data_primeira_mensalidade, data_encerramento")
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

  const ativos = recorrentes.filter((c) => c.status === "ativo");
  const encerrados = recorrentes.filter((c) => c.status === "encerrado");

  const mrr = ativos.reduce((soma, c) => soma + (c.valor_mensal ?? 0), 0);

  const temposDeCasa = recorrentes.map((c) => mesesDeCasa(c.data_primeira_mensalidade, c.data_encerramento));
  const tempoMedioEmCasa =
    temposDeCasa.length > 0 ? temposDeCasa.reduce((a, b) => a + b, 0) / temposDeCasa.length : 0;

  const ltvs = recorrentes.map(
    (c) => mesesDeCasa(c.data_primeira_mensalidade, c.data_encerramento) * (c.valor_mensal ?? 0)
  );
  const ltvMedio = ltvs.length > 0 ? ltvs.reduce((a, b) => a + b, 0) / ltvs.length : 0;

  const churn = recorrentes.length > 0 ? (encerrados.length / recorrentes.length) * 100 : 0;

  const dadosStatusRecorrente = [
    { nome: "Ativos", total: ativos.length },
    { nome: "Encerrados", total: encerrados.length },
  ];

  const totalPontuais = pontuais.length;
  const valorTotalPontuais = pontuais.reduce((soma, c) => soma + (c.valor_total ?? 0), 0);
  const concluidosOuArquivados = pontuais.filter((c) => c.status !== "ativo" && c.data_encerramento);
  const temposConclusao = concluidosOuArquivados.map((c) =>
    diasEntre(c.data_fechamento!, c.data_encerramento!)
  );
  const tempoMedioConcluir =
    temposConclusao.length > 0 ? temposConclusao.reduce((a, b) => a + b, 0) / temposConclusao.length : 0;

  const dadosStatusPontual = [
    { nome: "Ativos", total: pontuais.filter((c) => c.status === "ativo").length },
    { nome: "Concluídos", total: pontuais.filter((c) => c.status === "concluido").length },
    { nome: "Arquivados", total: pontuais.filter((c) => c.status === "arquivado").length },
  ];

  if (loading) {
    return <p className="text-sm text-ink/50">Carregando...</p>;
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink/40 mb-4">Recorrentes</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Metrica icon={<Users size={16} />} label="Contratos ativos" valor={String(ativos.length)} />
          <Metrica icon={<Wallet size={16} />} label="MRR mensal" valor={formatarMoeda(mrr)} />
          <Metrica
            icon={<Clock size={16} />}
            label="Tempo médio em casa"
            valor={`${tempoMedioEmCasa.toFixed(1)} meses`}
          />
          <Metrica icon={<TrendingUp size={16} />} label="LTV médio" valor={formatarMoeda(ltvMedio)} />
          <Metrica icon={<TrendingDown size={16} />} label="Churn" valor={`${churn.toFixed(1)}%`} />
        </div>
        <div className="rounded-3xl bg-card border border-black/5 p-5 h-64 transition-shadow duration-200 hover:shadow-lg">
          <p className="text-sm font-semibold text-ink mb-3">Contratos por status</p>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={dadosStatusRecorrente}>
              <CartesianGrid strokeDasharray="3 3" stroke="#02170B10" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 12, fill: "#02170B99" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#02170B99" }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#E4FFEF" }} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(2,23,11,0.15)" }} />
              <Bar dataKey="total" fill="#143421" radius={[8, 8, 0, 0]} activeBar={{ fill: "#02170B" }} animationDuration={600} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink/40 mb-4">Pontuais</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Metrica icon={<Package size={16} />} label="Total de contratos" valor={String(totalPontuais)} />
          <Metrica
            icon={<Wallet size={16} />}
            label="Valor total de contratos"
            valor={formatarMoeda(valorTotalPontuais)}
          />
          <Metrica
            icon={<Timer size={16} />}
            label="Tempo médio para concluir"
            valor={`${Math.round(tempoMedioConcluir)} dias`}
          />
        </div>
        <div className="rounded-3xl bg-card border border-black/5 p-5 h-64 transition-shadow duration-200 hover:shadow-lg">
          <p className="text-sm font-semibold text-ink mb-3">Contratos por status</p>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={dadosStatusPontual}>
              <CartesianGrid strokeDasharray="3 3" stroke="#02170B10" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 12, fill: "#02170B99" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#02170B99" }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#E4FFEF" }} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(2,23,11,0.15)" }} />
              <Bar dataKey="total" fill="#143421" radius={[8, 8, 0, 0]} activeBar={{ fill: "#02170B" }} animationDuration={600} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
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
