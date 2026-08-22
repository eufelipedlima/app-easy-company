"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { sessoesDoHistorico } from "@/lib/historico-visual";

const HORAS_PADRAO_MES = 220;
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

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
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [loading, setLoading] = useState(true);
  const [temAcesso, setTemAcesso] = useState<boolean | null>(null);
  const [ordem, setOrdem] = useState<"lucro" | "margem" | "receita">("lucro");
  const [incluirDespesas, setIncluirDespesas] = useState(false);

  const [nomesCliente, setNomesCliente] = useState<Map<string, string>>(new Map());
  const [receitaPorCliente, setReceitaPorCliente] = useState<Map<string, number>>(new Map());
  const [clienteDaTarefa, setClienteDaTarefa] = useState<Map<string, string>>(new Map());
  const [clienteDoPost, setClienteDoPost] = useState<Map<string, string>>(new Map());
  const [historicoTarefas, setHistoricoTarefas] = useState<{ tarefa_id: string; autor_id: string | null; descricao: string; created_at: string }[]>([]);
  const [historicoPosts, setHistoricoPosts] = useState<{ post_id: string; autor_id: string | null; descricao: string; created_at: string }[]>([]);
  const [custoHoraSimplesPorFuncionario, setCustoHoraSimplesPorFuncionario] = useState<Map<string, number>>(new Map());
  const [custoHoraCompleto, setCustoHoraCompleto] = useState(0);

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

      const inicioMes = new Date(ano, mes, 1).toISOString().slice(0, 10);
      const fimMes = new Date(ano, mes + 1, 0).toISOString().slice(0, 10);

      const [{ data: clientes }, { data: contratos }, { data: tarefas }, { data: posts }, { data: funcionarios }, { data: despesas }] =
        await Promise.all([
          supabase.from("clientes").select("id, papeis ( pessoas ( nome ) )").eq("ativo_central_clientes", true),
          supabase
            .from("contratos")
            .select("cliente_id, tipo_contrato, valor_mensal, status, data_primeira_mensalidade, data_encerramento"),
          supabase.from("tarefas").select("id, cliente_id").is("excluido_em", null).not("cliente_id", "is", null),
          supabase.from("posts_conteudo").select("id, cliente_id").is("excluido_em", null).not("cliente_id", "is", null),
          supabase.from("funcionarios").select("auth_user_id, salario").not("auth_user_id", "is", null),
          supabase.from("despesas_fixas").select("valor_mensal").eq("status", "ativo"),
        ]);

      const mapaNomes = new Map<string, string>();
      for (const c of (clientes ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[]) {
        mapaNomes.set(c.id, c.papeis?.pessoas?.nome ?? "—");
      }
      setNomesCliente(mapaNomes);

      const mapaReceita = new Map<string, number>();
      for (const c of contratos ?? []) {
        if (c.tipo_contrato !== "recorrente" || !c.cliente_id) continue;
        if (c.data_primeira_mensalidade && c.data_primeira_mensalidade > fimMes) continue;
        if (c.data_encerramento && c.data_encerramento < inicioMes) continue;
        if (c.status === "encerrado" && !c.data_encerramento) continue;
        mapaReceita.set(c.cliente_id, (mapaReceita.get(c.cliente_id) ?? 0) + (c.valor_mensal ?? 0));
      }
      setReceitaPorCliente(mapaReceita);

      const mapaTarefa = new Map<string, string>();
      for (const t of tarefas ?? []) if (t.cliente_id) mapaTarefa.set(t.id, t.cliente_id);
      setClienteDaTarefa(mapaTarefa);
      const mapaPost = new Map<string, string>();
      for (const p of posts ?? []) if (p.cliente_id) mapaPost.set(p.id, p.cliente_id);
      setClienteDoPost(mapaPost);

      const mapaCustoSimples = new Map<string, number>();
      for (const f of (funcionarios ?? []) as { auth_user_id: string; salario: number }[]) {
        mapaCustoSimples.set(f.auth_user_id, (Number(f.salario) || 0) / HORAS_PADRAO_MES);
      }
      setCustoHoraSimplesPorFuncionario(mapaCustoSimples);

      const somaSalarios = (funcionarios ?? []).reduce((s, f) => s + (Number(f.salario) || 0), 0);
      const somaDespesas = (despesas ?? []).reduce((s, d) => s + (Number(d.valor_mensal) || 0), 0);
      const numFuncionarios = (funcionarios ?? []).length || 1;
      setCustoHoraCompleto((somaSalarios + somaDespesas) / (numFuncionarios * HORAS_PADRAO_MES));

      const idsTarefas = (tarefas ?? []).map((t) => t.id);
      const idsPosts = (posts ?? []).map((p) => p.id);
      const [{ data: histT }, { data: histP }] = await Promise.all([
        idsTarefas.length > 0
          ? supabase.from("tarefas_historico").select("tarefa_id, autor_id, descricao, created_at").in("tarefa_id", idsTarefas)
          : Promise.resolve({ data: [] }),
        idsPosts.length > 0
          ? supabase.from("posts_conteudo_historico").select("post_id, autor_id, descricao, created_at").in("post_id", idsPosts)
          : Promise.resolve({ data: [] }),
      ]);
      setHistoricoTarefas((histT ?? []) as typeof historicoTarefas);
      setHistoricoPosts((histP ?? []) as typeof historicoPosts);

      setLoading(false);
    }
    carregar();
  }, [temAcesso, mes, ano]);

  const linhas: LinhaCliente[] = useMemo(() => {
    // Comparação por objeto Date (não texto) — evita o limite do mês ficar
    // deslocado pelo fuso horário (a diferença do Brasil pro UTC).
    const inicioMesData = new Date(ano, mes, 1, 0, 0, 0);
    const fimMesData = new Date(ano, mes + 1, 1, 0, 0, 0);
    const noMes = (dataISO: string) => {
      const d = new Date(dataISO);
      return d >= inicioMesData && d < fimMesData;
    };

    const horasPorCliente = new Map<string, number>();
    const custoPorCliente = new Map<string, number>();

    for (const h of historicoTarefas) {
      const clienteId = clienteDaTarefa.get(h.tarefa_id);
      if (!clienteId) continue;
      if (!noMes(h.created_at)) continue;
      const [sessao] = sessoesDoHistorico([h]);
      if (!sessao) continue;
      const horas = sessao.segundos / 3600;
      horasPorCliente.set(clienteId, (horasPorCliente.get(clienteId) ?? 0) + horas);
      const custoHora = incluirDespesas ? custoHoraCompleto : custoHoraSimplesPorFuncionario.get(sessao.autorId) ?? 0;
      custoPorCliente.set(clienteId, (custoPorCliente.get(clienteId) ?? 0) + horas * custoHora);
    }
    for (const h of historicoPosts) {
      const clienteId = clienteDoPost.get(h.post_id);
      if (!clienteId) continue;
      if (!noMes(h.created_at)) continue;
      const [sessao] = sessoesDoHistorico([h]);
      if (!sessao) continue;
      const horas = sessao.segundos / 3600;
      horasPorCliente.set(clienteId, (horasPorCliente.get(clienteId) ?? 0) + horas);
      const custoHora = incluirDespesas ? custoHoraCompleto : custoHoraSimplesPorFuncionario.get(sessao.autorId) ?? 0;
      custoPorCliente.set(clienteId, (custoPorCliente.get(clienteId) ?? 0) + horas * custoHora);
    }

    const todosOsIds = new Set([...nomesCliente.keys(), ...receitaPorCliente.keys(), ...horasPorCliente.keys()]);
    return Array.from(todosOsIds)
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
  }, [
    historicoTarefas,
    historicoPosts,
    clienteDaTarefa,
    clienteDoPost,
    nomesCliente,
    receitaPorCliente,
    custoHoraSimplesPorFuncionario,
    custoHoraCompleto,
    incluirDespesas,
    mes,
    ano,
  ]);

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

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink mb-1">Lucratividade por Cliente</h1>
          <p className="text-sm text-ink/60">Receita recorrente ativa comparada ao custo estimado das horas trabalhadas.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const d = new Date(ano, mes - 1, 1);
              setMes(d.getMonth());
              setAno(d.getFullYear());
            }}
            className="rounded-full h-8 w-8 flex items-center justify-center hover:bg-surface text-ink/50"
          >
            ←
          </button>
          <p className="text-sm font-bold text-ink w-32 text-center">
            {MESES[mes]} {ano}
          </p>
          <button
            onClick={() => {
              const d = new Date(ano, mes + 1, 1);
              setMes(d.getMonth());
              setAno(d.getFullYear());
            }}
            disabled={ano === hoje.getFullYear() && mes === hoje.getMonth()}
            className="rounded-full h-8 w-8 flex items-center justify-center hover:bg-surface text-ink/50 disabled:opacity-20"
          >
            →
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-ink/60 cursor-pointer mb-6 w-fit">
        <input type="checkbox" checked={incluirDespesas} onChange={(e) => setIncluirDespesas(e.target.checked)} className="accent-forest" />
        Ratear despesas fixas no custo/hora (não só o salário de cada pessoa)
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-2xl bg-card border border-black/5 p-4">
          <p className="text-xs text-ink/50 mb-1">Receita do mês</p>
          <p className="text-xl font-extrabold text-ink">{formatarMoeda(receitaTotal)}</p>
        </div>
        <div className="rounded-2xl bg-card border border-black/5 p-4">
          <p className="text-xs text-ink/50 mb-1">Custo estimado</p>
          <p className="text-xl font-extrabold text-red-600">{formatarMoeda(custoTotal)}</p>
        </div>
        <div className="rounded-2xl bg-card border border-black/5 p-4">
          <p className="text-xs text-ink/50 mb-1">Lucro estimado</p>
          <p className={`text-xl font-extrabold ${lucroTotal >= 0 ? "text-forest" : "text-red-600"}`}>{formatarMoeda(lucroTotal)}</p>
        </div>
      </div>

      {linhasOrdenadas.length === 0 ? (
        <p className="text-sm text-ink/40">Nenhum cliente com receita ou horas registradas em {MESES[mes]}.</p>
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
        {incluirDespesas
          ? `Custo/hora usado: ${formatarMoeda(custoHoraCompleto)} pra todo mundo — média entre a soma de todos os salários + despesas fixas ativas, dividida pelas horas-padrão de toda a equipe (${HORAS_PADRAO_MES}h/pessoa/mês).`
          : `Custo estimado a partir do salário de cada pessoa ÷ ${HORAS_PADRAO_MES}h/mês, multiplicado pelas horas registradas em cada cliente no mês selecionado. Contratos pontuais/avulsos não entram nesse cálculo.`}
      </p>
    </main>
  );
}
