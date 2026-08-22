"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

const HORAS_PADRAO_MES = 220;

function formatarMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

interface LinhaCliente {
  id: string;
  nome: string;
  receitaMensal: number;
  custoEstimado: number;
  lucro: number;
  margem: number | null;
  horas: number;
}

export default function LucratividadeGeralPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [temAcesso, setTemAcesso] = useState<boolean | null>(null);
  const [linhas, setLinhas] = useState<LinhaCliente[]>([]);
  const [ordem, setOrdem] = useState<"lucro" | "margem" | "receita">("lucro");

  useEffect(() => {
    async function carregarPermissao() {
      const supabase = createClient();
      const { data: nivel } = await supabase.rpc("meu_nivel_acesso", { area_slug: "financeiro" });
      setTemAcesso(nivel !== "nenhum");
    }
    carregarPermissao();
  }, []);

  useEffect(() => {
    if (temAcesso !== true) return;
    async function carregar() {
      setLoading(true);
      const supabase = createClient();

      const [{ data: clientes }, { data: contratos }, { data: tarefas }, { data: posts }, { data: funcionarios }] = await Promise.all([
        supabase.from("clientes").select("id, papeis ( pessoas ( nome ) )").eq("ativo_central_clientes", true),
        supabase.from("contratos").select("cliente_id, tipo_contrato, valor_mensal, status"),
        supabase.from("tarefas").select("id, cliente_id, tempo_total_segundos").is("excluido_em", null).not("cliente_id", "is", null),
        supabase.from("posts_conteudo").select("id, cliente_id, tempo_total_segundos").is("excluido_em", null).not("cliente_id", "is", null),
        supabase
          .from("funcionarios")
          .select("auth_user_id, salario")
          .not("auth_user_id", "is", null),
      ]);

      const nomesCliente = new Map<string, string>();
      for (const c of (clientes ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[]) {
        nomesCliente.set(c.id, c.papeis?.pessoas?.nome ?? "—");
      }

      const receitaPorCliente = new Map<string, number>();
      for (const c of contratos ?? []) {
        if (c.status !== "ativo" || c.tipo_contrato !== "recorrente" || !c.cliente_id) continue;
        receitaPorCliente.set(c.cliente_id, (receitaPorCliente.get(c.cliente_id) ?? 0) + (c.valor_mensal ?? 0));
      }

      const clienteDaTarefa = new Map<string, string>();
      const horasPorCliente = new Map<string, number>();
      for (const t of tarefas ?? []) {
        if (!t.cliente_id) continue;
        clienteDaTarefa.set(t.id, t.cliente_id);
        horasPorCliente.set(t.cliente_id, (horasPorCliente.get(t.cliente_id) ?? 0) + (t.tempo_total_segundos ?? 0) / 3600);
      }
      const clienteDoPost = new Map<string, string>();
      for (const p of posts ?? []) {
        if (!p.cliente_id) continue;
        clienteDoPost.set(p.id, p.cliente_id);
        horasPorCliente.set(p.cliente_id, (horasPorCliente.get(p.cliente_id) ?? 0) + (p.tempo_total_segundos ?? 0) / 3600);
      }

      const custoHoraPorFuncionario = new Map<string, number>();
      for (const f of (funcionarios ?? []) as { auth_user_id: string; salario: number }[]) {
        custoHoraPorFuncionario.set(f.auth_user_id, (f.salario ?? 0) / HORAS_PADRAO_MES);
      }

      const idsTarefas = (tarefas ?? []).map((t) => t.id);
      const idsPosts = (posts ?? []).map((p) => p.id);
      const [{ data: sessoesTarefas }, { data: sessoesPosts }] = await Promise.all([
        idsTarefas.length > 0
          ? supabase.from("tarefas_tempo_sessoes").select("tarefa_id, funcionario_auth_id, segundos_acumulados").in("tarefa_id", idsTarefas)
          : Promise.resolve({ data: [] as { tarefa_id: string; funcionario_auth_id: string; segundos_acumulados: number }[] }),
        idsPosts.length > 0
          ? supabase.from("posts_conteudo_tempo_sessoes").select("post_id, funcionario_auth_id, segundos_acumulados").in("post_id", idsPosts)
          : Promise.resolve({ data: [] as { post_id: string; funcionario_auth_id: string; segundos_acumulados: number }[] }),
      ]);

      const custoPorCliente = new Map<string, number>();
      for (const s of sessoesTarefas ?? []) {
        const clienteId = clienteDaTarefa.get(s.tarefa_id);
        if (!clienteId) continue;
        const custoHora = custoHoraPorFuncionario.get(s.funcionario_auth_id) ?? 0;
        custoPorCliente.set(clienteId, (custoPorCliente.get(clienteId) ?? 0) + (s.segundos_acumulados / 3600) * custoHora);
      }
      for (const s of sessoesPosts ?? []) {
        const clienteId = clienteDoPost.get(s.post_id);
        if (!clienteId) continue;
        const custoHora = custoHoraPorFuncionario.get(s.funcionario_auth_id) ?? 0;
        custoPorCliente.set(clienteId, (custoPorCliente.get(clienteId) ?? 0) + (s.segundos_acumulados / 3600) * custoHora);
      }

      const todosOsIds = new Set([...nomesCliente.keys(), ...receitaPorCliente.keys(), ...horasPorCliente.keys()]);
      const resultado: LinhaCliente[] = Array.from(todosOsIds)
        .filter((id) => nomesCliente.has(id))
        .map((id) => {
          const receitaMensal = receitaPorCliente.get(id) ?? 0;
          const custoEstimado = custoPorCliente.get(id) ?? 0;
          const lucro = receitaMensal - custoEstimado;
          return {
            id,
            nome: nomesCliente.get(id) ?? "—",
            receitaMensal,
            custoEstimado,
            lucro,
            margem: receitaMensal > 0 ? (lucro / receitaMensal) * 100 : null,
            horas: horasPorCliente.get(id) ?? 0,
          };
        })
        .filter((l) => l.receitaMensal > 0 || l.horas > 0);

      setLinhas(resultado);
      setLoading(false);
    }
    carregar();
  }, [temAcesso]);

  if (temAcesso === false) {
    return (
      <main className="w-full px-6 sm:px-8 lg:px-10 py-16 flex flex-col items-center justify-center text-center">
        <span className="text-4xl mb-3">🔒</span>
        <h1 className="text-lg font-bold text-ink mb-1">Você não tem acesso a essa página</h1>
        <p className="text-sm text-ink/50">
          Volte pra{" "}
          <a href="/central-clientes" className="text-forest font-semibold hover:underline">
            Central de Clientes
          </a>
          .
        </p>
      </main>
    );
  }

  if (temAcesso === null || loading) {
    return (
      <main className="w-full px-6 sm:px-8 lg:px-10 py-10">
        <p className="text-sm text-ink/40">Calculando lucratividade de todos os clientes...</p>
      </main>
    );
  }

  const linhasOrdenadas = [...linhas].sort((a, b) => {
    if (ordem === "margem") return (b.margem ?? -Infinity) - (a.margem ?? -Infinity);
    if (ordem === "receita") return b.receitaMensal - a.receitaMensal;
    return b.lucro - a.lucro;
  });

  const receitaTotal = linhas.reduce((s, l) => s + l.receitaMensal, 0);
  const custoTotal = linhas.reduce((s, l) => s + l.custoEstimado, 0);
  const lucroTotal = receitaTotal - custoTotal;

  return (
    <main className="w-full px-6 sm:px-8 lg:px-10 py-10">
      <button onClick={() => router.push("/central-clientes")} className="text-sm font-semibold text-ink/50 hover:text-ink mb-4">
        ← Central de Clientes
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-ink mb-1">Lucratividade por Cliente</h1>
        <p className="text-sm text-ink/60">Receita recorrente ativa comparada ao custo estimado das horas trabalhadas.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-2xl bg-card border border-black/5 p-4">
          <p className="text-xs text-ink/50 mb-1">Receita mensal total</p>
          <p className="text-xl font-extrabold text-ink">{formatarMoeda(receitaTotal)}</p>
        </div>
        <div className="rounded-2xl bg-card border border-black/5 p-4">
          <p className="text-xs text-ink/50 mb-1">Custo estimado total</p>
          <p className="text-xl font-extrabold text-red-600">{formatarMoeda(custoTotal)}</p>
        </div>
        <div className="rounded-2xl bg-card border border-black/5 p-4">
          <p className="text-xs text-ink/50 mb-1">Lucro estimado total</p>
          <p className={`text-xl font-extrabold ${lucroTotal >= 0 ? "text-forest" : "text-red-600"}`}>{formatarMoeda(lucroTotal)}</p>
        </div>
      </div>

      {linhasOrdenadas.length === 0 ? (
        <p className="text-sm text-ink/40">Nenhum cliente com receita ou horas registradas ainda.</p>
      ) : (
        <>
          <div className="rounded-2xl bg-card border border-black/5 p-5 mb-6">
            <p className="text-sm font-bold text-ink mb-4">Lucro estimado, por cliente</p>
            <ResponsiveContainer width="100%" height={Math.max(linhasOrdenadas.length * 34, 100)}>
              <BarChart data={linhasOrdenadas.map((l) => ({ nome: l.nome, valor: l.lucro }))} layout="vertical" margin={{ left: 0, right: 30 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 12, fill: "#02170B99" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                <Bar dataKey="valor" radius={[0, 8, 8, 0]} barSize={18}>
                  {linhasOrdenadas.map((l, i) => (
                    <Cell key={i} fill={l.lucro >= 0 ? "#143421" : "#dc2626"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl bg-card border border-black/5 overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_120px_120px_90px] gap-2 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink/40 bg-surface/60">
              <span>Cliente</span>
              <button onClick={() => setOrdem("receita")} className={`text-right ${ordem === "receita" ? "text-ink" : ""}`}>
                Receita ↓
              </button>
              <span className="text-right">Custo</span>
              <button onClick={() => setOrdem("lucro")} className={`text-right ${ordem === "lucro" ? "text-ink" : ""}`}>
                Lucro ↓
              </button>
              <button onClick={() => setOrdem("margem")} className={`text-right ${ordem === "margem" ? "text-ink" : ""}`}>
                Margem ↓
              </button>
            </div>
            {linhasOrdenadas.map((l) => (
              <button
                key={l.id}
                onClick={() => router.push(`/central-clientes/${l.id}`)}
                className="w-full grid grid-cols-[1fr_120px_120px_120px_90px] gap-2 items-center px-5 py-3 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors text-left"
              >
                <span className="text-sm font-bold text-ink truncate">{l.nome}</span>
                <span className="text-sm text-ink/70 text-right">{formatarMoeda(l.receitaMensal)}</span>
                <span className="text-sm text-red-600/80 text-right">{formatarMoeda(l.custoEstimado)}</span>
                <span className={`text-sm font-semibold text-right ${l.lucro >= 0 ? "text-forest" : "text-red-600"}`}>
                  {formatarMoeda(l.lucro)}
                </span>
                <span className="text-sm text-ink/50 text-right">{l.margem !== null ? `${l.margem.toFixed(0)}%` : "—"}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <p className="text-[11px] text-ink/30 mt-4">
        Custo estimado a partir do salário de cada pessoa ÷ {HORAS_PADRAO_MES}h/mês, multiplicado pelas horas
        registradas em cada cliente. Contratos pontuais/avulsos não entram nesse cálculo de margem mensal.
      </p>
    </main>
  );
}
