"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

// Carga horária padrão usada pra transformar salário mensal em custo/hora.
// Referência CLT comum (44h/semana). Se um dia isso precisar variar por
// pessoa ou cargo, dá pra virar uma coluna na tabela de funcionários.
const HORAS_PADRAO_MES = 220;

function formatarMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarHoras(h: number) {
  const horas = Math.floor(h);
  const min = Math.round((h - horas) * 60);
  if (horas === 0) return `${min}min`;
  return `${horas}h ${String(min).padStart(2, "0")}min`;
}

interface LinhaPessoa {
  nome: string;
  horas: number;
  custo: number;
}

export function AbaLucratividadeCliente({ clienteId }: { clienteId: string }) {
  const [loading, setLoading] = useState(true);
  const [receitaMensal, setReceitaMensal] = useState(0);
  const [receitaPontualAtiva, setReceitaPontualAtiva] = useState(0);
  const [custoEstimado, setCustoEstimado] = useState(0);
  const [totalHoras, setTotalHoras] = useState(0);
  const [porPessoa, setPorPessoa] = useState<LinhaPessoa[]>([]);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      const supabase = createClient();

      const [{ data: contratos }, { data: tarefas }, { data: posts }, { data: funcionarios }] = await Promise.all([
        supabase.from("contratos").select("tipo_contrato, valor_mensal, valor_total, status").eq("cliente_id", clienteId),
        supabase.from("tarefas").select("id, tempo_total_segundos").eq("cliente_id", clienteId).is("excluido_em", null),
        supabase.from("posts_conteudo").select("id, tempo_total_segundos").eq("cliente_id", clienteId).is("excluido_em", null),
        supabase
          .from("funcionarios")
          .select("auth_user_id, salario, papeis ( pessoas ( nome, apelido ) )")
          .not("auth_user_id", "is", null),
      ]);

      const contratosAtivos = (contratos ?? []).filter((c) => c.status === "ativo");
      const recMensal = contratosAtivos
        .filter((c) => c.tipo_contrato === "recorrente")
        .reduce((s, c) => s + (c.valor_mensal ?? 0), 0);
      const recPontual = contratosAtivos
        .filter((c) => c.tipo_contrato === "pontual")
        .reduce((s, c) => s + (c.valor_total ?? 0), 0);
      setReceitaMensal(recMensal);
      setReceitaPontualAtiva(recPontual);

      const idsTarefas = (tarefas ?? []).map((t) => t.id);
      const idsPosts = (posts ?? []).map((p) => p.id);
      const segundosTotal =
        (tarefas ?? []).reduce((s, t) => s + (t.tempo_total_segundos ?? 0), 0) +
        (posts ?? []).reduce((s, p) => s + (p.tempo_total_segundos ?? 0), 0);
      setTotalHoras(segundosTotal / 3600);

      const [{ data: sessoesTarefas }, { data: sessoesPosts }] = await Promise.all([
        idsTarefas.length > 0
          ? supabase.from("tarefas_tempo_sessoes").select("funcionario_auth_id, segundos_acumulados").in("tarefa_id", idsTarefas)
          : Promise.resolve({ data: [] as { funcionario_auth_id: string; segundos_acumulados: number }[] }),
        idsPosts.length > 0
          ? supabase.from("posts_conteudo_tempo_sessoes").select("funcionario_auth_id, segundos_acumulados").in("post_id", idsPosts)
          : Promise.resolve({ data: [] as { funcionario_auth_id: string; segundos_acumulados: number }[] }),
      ]);

      const mapaFuncionario = new Map<string, { nome: string; custoHora: number }>();
      for (const f of (funcionarios ?? []) as unknown as {
        auth_user_id: string;
        salario: number;
        papeis: { pessoas: { nome: string; apelido: string | null } | null } | null;
      }[]) {
        const nome = f.papeis?.pessoas?.apelido || f.papeis?.pessoas?.nome || "Colega";
        mapaFuncionario.set(f.auth_user_id, { nome, custoHora: (f.salario ?? 0) / HORAS_PADRAO_MES });
      }

      const segundosPorPessoa = new Map<string, number>();
      for (const s of [...(sessoesTarefas ?? []), ...(sessoesPosts ?? [])]) {
        segundosPorPessoa.set(s.funcionario_auth_id, (segundosPorPessoa.get(s.funcionario_auth_id) ?? 0) + s.segundos_acumulados);
      }

      let custoTotal = 0;
      const linhas: LinhaPessoa[] = [];
      for (const [authId, segundos] of segundosPorPessoa) {
        const info = mapaFuncionario.get(authId);
        const horas = segundos / 3600;
        const custo = horas * (info?.custoHora ?? 0);
        custoTotal += custo;
        linhas.push({ nome: info?.nome ?? "Alguém", horas, custo });
      }
      linhas.sort((a, b) => b.custo - a.custo);
      setPorPessoa(linhas);
      setCustoEstimado(custoTotal);
      setLoading(false);
    }
    carregar();
  }, [clienteId]);

  if (loading) {
    return <p className="text-sm text-ink/40 py-8">Calculando lucratividade...</p>;
  }

  const lucro = receitaMensal - custoEstimado;
  const margem = receitaMensal > 0 ? (lucro / receitaMensal) * 100 : null;
  const dadosGrafico = [
    { nome: "Receita mensal", valor: receitaMensal, cor: "#143421" },
    { nome: "Custo estimado", valor: custoEstimado, cor: "#dc2626" },
  ];

  return (
    <div>
      {receitaMensal === 0 && receitaPontualAtiva === 0 && (
        <div className="rounded-2xl bg-amber-50 text-amber-700 text-sm px-4 py-3 mb-6">
          Esse cliente não tem contrato ativo com valor cadastrado — a lucratividade não pode ser calculada sem uma
          receita de referência.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="rounded-2xl bg-card border border-black/5 p-4">
          <p className="text-xs text-ink/50 mb-1">Receita mensal</p>
          <p className="text-xl font-extrabold text-ink">{formatarMoeda(receitaMensal)}</p>
        </div>
        <div className="rounded-2xl bg-card border border-black/5 p-4">
          <p className="text-xs text-ink/50 mb-1">Custo estimado</p>
          <p className="text-xl font-extrabold text-red-600">{formatarMoeda(custoEstimado)}</p>
        </div>
        <div className="rounded-2xl bg-card border border-black/5 p-4">
          <p className="text-xs text-ink/50 mb-1">Lucro estimado</p>
          <p className={`text-xl font-extrabold ${lucro >= 0 ? "text-forest" : "text-red-600"}`}>{formatarMoeda(lucro)}</p>
        </div>
        <div className="rounded-2xl bg-card border border-black/5 p-4">
          <p className="text-xs text-ink/50 mb-1">Margem</p>
          <p className={`text-xl font-extrabold ${margem !== null && margem >= 0 ? "text-forest" : "text-red-600"}`}>
            {margem !== null ? `${margem.toFixed(0)}%` : "—"}
          </p>
        </div>
      </div>

      {receitaPontualAtiva > 0 && (
        <p className="text-xs text-ink/40 mb-6">
          + {formatarMoeda(receitaPontualAtiva)} em contrato(s) pontual/avulso ativo(s) — não incluído na margem
          mensal acima, já que não é receita recorrente.
        </p>
      )}

      <div className="rounded-2xl bg-card border border-black/5 p-5 mb-6">
        <p className="text-sm font-bold text-ink mb-4">Receita x Custo</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={dadosGrafico} layout="vertical" margin={{ left: 0, right: 20 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 12, fill: "#02170B99" }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
            <Bar dataKey="valor" radius={[0, 8, 8, 0]} barSize={28}>
              {dadosGrafico.map((d, i) => (
                <Cell key={i} fill={d.cor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl bg-card border border-black/5 overflow-hidden">
        <div className="px-5 py-3 border-b border-black/5 flex items-center justify-between">
          <p className="text-sm font-bold text-ink">Horas e custo por pessoa</p>
          <p className="text-xs text-ink/40">Total: {formatarHoras(totalHoras)}</p>
        </div>
        {porPessoa.length === 0 ? (
          <p className="p-5 text-sm text-ink/40">Nenhuma sessão de cronômetro registrada pra esse cliente ainda.</p>
        ) : (
          porPessoa.map((p) => (
            <div key={p.nome} className="flex items-center justify-between px-5 py-3 border-b border-black/5 last:border-0 text-sm">
              <span className="text-ink/80">{p.nome}</span>
              <span className="flex items-center gap-4">
                <span className="text-ink/40">{formatarHoras(p.horas)}</span>
                <span className="font-semibold text-ink w-24 text-right">{formatarMoeda(p.custo)}</span>
              </span>
            </div>
          ))
        )}
        <p className="px-5 py-2.5 text-[11px] text-ink/30 bg-surface/40">
          Custo estimado a partir do salário de cada pessoa ÷ {HORAS_PADRAO_MES}h/mês, multiplicado pelas horas
          registradas nas tarefas/conteúdos desse cliente. Sessões de cronômetro muito antigas podem não estar
          totalmente refletidas aqui — o total de horas acima é sempre exato, o custo por pessoa é uma estimativa.
        </p>
      </div>
    </div>
  );
}
