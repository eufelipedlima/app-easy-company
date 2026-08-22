"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { sessoesDoHistorico } from "@/lib/historico-visual";

// Carga horária padrão usada pra transformar salário/custo mensal em
// custo/hora. Referência CLT comum (44h/semana). Se precisar variar por
// pessoa ou cargo no futuro, dá pra virar uma coluna própria.
const HORAS_PADRAO_MES = 220;

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

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
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [loading, setLoading] = useState(true);
  const [incluirDespesas, setIncluirDespesas] = useState(false);

  const [receitaMensal, setReceitaMensal] = useState(0);
  const [sessoes, setSessoes] = useState<{ autorId: string; segundos: number; dataISO: string }[]>([]);
  const [mapaFuncionario, setMapaFuncionario] = useState<Map<string, { nome: string; custoHoraSimples: number }>>(new Map());
  const [custoHoraCompleto, setCustoHoraCompleto] = useState(0);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      const supabase = createClient();

      const inicioMes = new Date(ano, mes, 1).toISOString().slice(0, 10);
      const fimMes = new Date(ano, mes + 1, 0).toISOString().slice(0, 10);

      const [{ data: contratos }, { data: tarefas }, { data: posts }, { data: funcionarios }, { data: despesas }] =
        await Promise.all([
          supabase
            .from("contratos")
            .select("tipo_contrato, valor_mensal, valor_total, status, data_primeira_mensalidade, data_encerramento, data_fechamento")
            .eq("cliente_id", clienteId),
          supabase.from("tarefas").select("id").eq("cliente_id", clienteId).is("excluido_em", null),
          supabase.from("posts_conteudo").select("id").eq("cliente_id", clienteId).is("excluido_em", null),
          supabase
            .from("funcionarios")
            .select("auth_user_id, salario, papeis ( pessoas ( nome, apelido ) )")
            .not("auth_user_id", "is", null),
          supabase.from("despesas_fixas").select("valor_mensal").eq("status", "ativo"),
        ]);

      // Receita: contratos recorrentes que estavam ativos durante o mês
      // selecionado (já começaram e ainda não encerraram nessa data).
      const recMensal = (contratos ?? [])
        .filter((c) => {
          if (c.tipo_contrato !== "recorrente") return false;
          if (c.data_primeira_mensalidade && c.data_primeira_mensalidade > fimMes) return false;
          if (c.data_encerramento && c.data_encerramento < inicioMes) return false;
          if (c.status === "encerrado" && !c.data_encerramento) return false;
          return true;
        })
        .reduce((s, c) => s + (c.valor_mensal ?? 0), 0);
      setReceitaMensal(recMensal);

      // Custo/hora "empresa completa": soma de todos os salários + despesas
      // fixas ativas, dividido pelo total de horas-padrão de todo mundo —
      // uma média única aplicada a qualquer hora trabalhada, incorporando o
      // custo indireto (aluguel, sistemas, etc.), não só o salário de quem
      // fez a tarefa.
      const somaSalarios = (funcionarios ?? []).reduce((s, f) => s + (Number(f.salario) || 0), 0);
      const somaDespesas = (despesas ?? []).reduce((s, d) => s + (Number(d.valor_mensal) || 0), 0);
      const numFuncionarios = (funcionarios ?? []).length || 1;
      setCustoHoraCompleto((somaSalarios + somaDespesas) / (numFuncionarios * HORAS_PADRAO_MES));

      const mapaF = new Map<string, { nome: string; custoHoraSimples: number }>();
      for (const f of (funcionarios ?? []) as unknown as {
        auth_user_id: string;
        salario: number;
        papeis: { pessoas: { nome: string; apelido: string | null } | null } | null;
      }[]) {
        const nome = f.papeis?.pessoas?.apelido || f.papeis?.pessoas?.nome || "Colega";
        mapaF.set(f.auth_user_id, { nome, custoHoraSimples: (Number(f.salario) || 0) / HORAS_PADRAO_MES });
      }
      setMapaFuncionario(mapaF);

      // O tempo trabalhado vem do histórico das tarefas/conteúdos desse
      // cliente — é a fonte mais confiável que existe, porque toda sessão
      // de cronômetro concluída sempre gera uma linha ali, independente de
      // qual versão do sistema estava rodando no navegador de quem
      // trabalhou. Cada linha já vem com a data exata, o que permite
      // filtrar por mês.
      const idsTarefas = (tarefas ?? []).map((t) => t.id);
      const idsPosts = (posts ?? []).map((p) => p.id);
      const [{ data: histTarefas }, { data: histPosts }] = await Promise.all([
        idsTarefas.length > 0
          ? supabase.from("tarefas_historico").select("autor_id, descricao, created_at").in("tarefa_id", idsTarefas)
          : Promise.resolve({ data: [] }),
        idsPosts.length > 0
          ? supabase.from("posts_conteudo_historico").select("autor_id, descricao, created_at").in("post_id", idsPosts)
          : Promise.resolve({ data: [] }),
      ]);

      setSessoes([...sessoesDoHistorico(histTarefas ?? []), ...sessoesDoHistorico(histPosts ?? [])]);
      setLoading(false);
    }
    carregar();
  }, [clienteId, mes, ano]);

  const { totalHoras, custoEstimado, porPessoa } = useMemo(() => {
    // Comparação por objeto Date (não texto) — evita o limite do mês ficar
    // deslocado pelo fuso horário (a diferença do Brasil pro UTC).
    const inicioMesData = new Date(ano, mes, 1, 0, 0, 0);
    const fimMesData = new Date(ano, mes + 1, 1, 0, 0, 0);
    const doMes = sessoes.filter((s) => {
      const d = new Date(s.dataISO);
      return d >= inicioMesData && d < fimMesData;
    });

    const segundosPorPessoa = new Map<string, number>();
    for (const s of doMes) {
      segundosPorPessoa.set(s.autorId, (segundosPorPessoa.get(s.autorId) ?? 0) + s.segundos);
    }

    let custoTotal = 0;
    let segundosTotal = 0;
    const linhas: LinhaPessoa[] = [];
    for (const [autorId, segundos] of segundosPorPessoa) {
      segundosTotal += segundos;
      const info = mapaFuncionario.get(autorId);
      const horas = segundos / 3600;
      const custoHora = incluirDespesas ? custoHoraCompleto : info?.custoHoraSimples ?? 0;
      const custo = horas * custoHora;
      custoTotal += custo;
      linhas.push({ nome: info?.nome ?? "Alguém", horas, custo });
    }
    linhas.sort((a, b) => b.custo - a.custo);
    return { totalHoras: segundosTotal / 3600, custoEstimado: custoTotal, porPessoa: linhas };
  }, [sessoes, mapaFuncionario, custoHoraCompleto, incluirDespesas, mes, ano]);

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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
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
        <label className="flex items-center gap-2 text-xs text-ink/60 cursor-pointer">
          <input type="checkbox" checked={incluirDespesas} onChange={(e) => setIncluirDespesas(e.target.checked)} className="accent-forest" />
          Ratear despesas fixas no custo/hora (não só o salário)
        </label>
      </div>

      {receitaMensal === 0 && (
        <div className="rounded-2xl bg-amber-50 text-amber-700 text-sm px-4 py-3 mb-6">
          Esse cliente não teve contrato recorrente ativo em {MESES[mes]} — a lucratividade não pode ser calculada
          sem uma receita de referência pro período.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="rounded-2xl bg-card border border-black/5 p-4">
          <p className="text-xs text-ink/50 mb-1">Receita do mês</p>
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
          <p className="text-sm font-bold text-ink">Horas e custo por pessoa, em {MESES[mes]}</p>
          <p className="text-xs text-ink/40">Total: {formatarHoras(totalHoras)}</p>
        </div>
        {porPessoa.length === 0 ? (
          <p className="p-5 text-sm text-ink/40">Nenhuma sessão de cronômetro registrada pra esse cliente em {MESES[mes]}.</p>
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
          {incluirDespesas
            ? `Custo/hora usado: ${formatarMoeda(custoHoraCompleto)} pra todo mundo — média entre a soma de todos os salários + despesas fixas ativas, dividida pelas horas-padrão de toda a equipe (${HORAS_PADRAO_MES}h/pessoa/mês).`
            : `Custo estimado a partir do salário de cada pessoa ÷ ${HORAS_PADRAO_MES}h/mês, multiplicado pelas horas que ela registrou nesse cliente em ${MESES[mes]}.`}
        </p>
      </div>
    </div>
  );
}
