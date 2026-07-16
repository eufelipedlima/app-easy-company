"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, Wallet, AlertTriangle, Clock } from "lucide-react";

interface LancamentoAtraso {
  id: string;
  descricao: string | null;
  valor: number;
  tipo: "receita" | "despesa" | "transferencia";
  data_vencimento: string;
  clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
  pessoas: { nome: string } | null;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string) {
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
}

function nomePessoa(l: LancamentoAtraso) {
  return l.clientes?.papeis?.pessoas?.nome ?? l.pessoas?.nome ?? "—";
}

function diasEmAtraso(dataVencimento: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataVencimento + "T00:00:00");
  return Math.max(Math.round((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)), 0);
}

export default function InadimplenciaPage() {
  const [lancamentos, setLancamentos] = useState<LancamentoAtraso[]>([]);
  const [pagamentosPorLancamento, setPagamentosPorLancamento] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const hoje = new Date().toISOString().slice(0, 10);

    const { data: l } = await supabase
      .from("lancamentos")
      .select(
        `id, descricao, valor, tipo, data_vencimento,
         clientes ( papeis ( pessoas ( nome ) ) ),
         pessoas ( nome )`
      )
      .eq("situacao", "pendente")
      .neq("tipo", "transferencia")
      .lt("data_vencimento", hoje)
      .order("data_vencimento", { ascending: true });

    setLancamentos((l as unknown as LancamentoAtraso[]) ?? []);

    const { data: pagamentos } = await supabase.from("lancamento_pagamentos").select("lancamento_id, valor");
    const soma: Record<string, number> = {};
    (pagamentos ?? []).forEach((p) => {
      soma[p.lancamento_id] = (soma[p.lancamento_id] ?? 0) + p.valor;
    });
    setPagamentosPorLancamento(soma);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function valorRestante(l: LancamentoAtraso) {
    return Math.max(l.valor - (pagamentosPorLancamento[l.id] ?? 0), 0);
  }

  async function marcarComoPago(id: string) {
    const supabase = createClient();
    const hoje = new Date().toISOString().slice(0, 10);
    await supabase.from("lancamentos").update({ situacao: "pago", data_quitacao: hoje }).eq("id", id);
    carregar();
  }

  const receitasAtraso = lancamentos.filter((l) => l.tipo === "receita" && valorRestante(l) > 0);
  const despesasAtraso = lancamentos.filter((l) => l.tipo === "despesa" && valorRestante(l) > 0);

  const clientesInadimplentes = new Set(receitasAtraso.map((l) => nomePessoa(l))).size;
  const valorInadimplente = receitasAtraso.reduce((s, l) => s + valorRestante(l), 0);
  const contasEmAtraso = despesasAtraso.length;

  const todosAtrasados = [...receitasAtraso, ...despesasAtraso];
  const mediaAtrasoDias =
    todosAtrasados.length > 0
      ? todosAtrasados.reduce((s, l) => s + diasEmAtraso(l.data_vencimento), 0) / todosAtrasados.length
      : 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-ink mb-1">Inadimplência</h1>
        <p className="text-sm text-ink/60">Lançamentos vencidos e ainda não pagos.</p>
      </div>

      {loading ? (
        <p className="text-sm text-ink/50">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Metrica icon={<Users size={16} />} label="Clientes inadimplentes" valor={String(clientesInadimplentes)} />
            <Metrica icon={<Wallet size={16} />} label="Valor inadimplente" valor={formatarMoeda(valorInadimplente)} destaque="ruim" />
            <Metrica icon={<AlertTriangle size={16} />} label="Contas da agência em atraso" valor={String(contasEmAtraso)} />
            <Metrica icon={<Clock size={16} />} label="Média de atraso" valor={`${mediaAtrasoDias.toFixed(0)} dias`} />
          </div>

          <section className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink/40 mb-3">
              Receitas em atraso ({receitasAtraso.length})
            </h2>
            <TabelaAtraso lancamentos={receitasAtraso} valorRestante={valorRestante} onMarcarPago={marcarComoPago} tipo="receita" />
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink/40 mb-3">
              Despesas em atraso ({despesasAtraso.length})
            </h2>
            <TabelaAtraso lancamentos={despesasAtraso} valorRestante={valorRestante} onMarcarPago={marcarComoPago} tipo="despesa" />
          </section>
        </>
      )}
    </main>
  );
}

function TabelaAtraso({
  lancamentos,
  valorRestante,
  onMarcarPago,
  tipo,
}: {
  lancamentos: LancamentoAtraso[];
  valorRestante: (l: LancamentoAtraso) => number;
  onMarcarPago: (id: string) => void;
  tipo: "receita" | "despesa";
}) {
  if (lancamentos.length === 0) {
    return (
      <div className="rounded-3xl bg-card border border-black/5 p-6">
        <p className="text-sm text-ink/50">Nenhuma {tipo === "receita" ? "receita" : "despesa"} em atraso. 🎉</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink/50 border-b border-black/5">
            <th className="px-4 py-3 font-medium">{tipo === "receita" ? "Cliente" : "Fornecedor"}</th>
            <th className="px-4 py-3 font-medium">Descrição</th>
            <th className="px-4 py-3 font-medium">Vencimento</th>
            <th className="px-4 py-3 font-medium">Dias em atraso</th>
            <th className="px-4 py-3 font-medium">Valor restante</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {lancamentos.map((l) => (
            <tr key={l.id} className="border-b border-black/5 last:border-0 hover:bg-surface/60">
              <td className="px-4 py-3 font-semibold text-ink">{nomePessoa(l)}</td>
              <td className="px-4 py-3 text-ink/70">{l.descricao ?? "—"}</td>
              <td className="px-4 py-3 text-ink/70">{formatarData(l.data_vencimento)}</td>
              <td className="px-4 py-3">
                <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-50 text-red-600">
                  {diasEmAtraso(l.data_vencimento)} dias
                </span>
              </td>
              <td className={`px-4 py-3 font-semibold ${tipo === "receita" ? "text-forest" : "text-red-600"}`}>
                {formatarMoeda(valorRestante(l))}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onMarcarPago(l.id)}
                  className="rounded-full px-3 py-1.5 text-xs font-bold bg-forest text-white hover:bg-ink transition-colors"
                >
                  Marcar como pago
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metrica({
  icon,
  label,
  valor,
  destaque,
}: {
  icon: React.ReactNode;
  label: string;
  valor: string;
  destaque?: "ruim";
}) {
  return (
    <div className="group rounded-2xl bg-card border border-black/5 p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-forest/20">
      <div
        className={`inline-flex items-center justify-center h-9 w-9 rounded-xl mb-3 transition-transform duration-200 group-hover:scale-110 ${
          destaque === "ruim" ? "bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white" : "bg-mint text-forest group-hover:bg-forest group-hover:text-white"
        }`}
      >
        {icon}
      </div>
      <p className={`text-xl font-extrabold leading-tight ${destaque === "ruim" ? "text-red-600" : "text-ink"}`}>{valor}</p>
      <p className="text-xs text-ink/50 mt-1">{label}</p>
    </div>
  );
}
