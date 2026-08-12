"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Categoria {
  id: string;
  nome: string;
  grupo: string;
  ordem: number;
}

interface PlanoConta {
  id: string;
  nome: string;
  tipo: "receita" | "despesa";
  dre_categoria_id: string | null;
}

interface LancamentoDRE {
  valor: number;
  tipo: "receita" | "despesa" | "transferencia";
  situacao: "pendente" | "pago";
  plano_conta_id: string | null;
  data_competencia: string | null;
  data_quitacao: string | null;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const GRUPOS_ORDEM = [
  "receita_bruta",
  "deducoes",
  "custos_vendas",
  "despesas_vendas",
  "despesas_administrativas",
  "despesas_financeiras",
  "receitas_financeiras",
  "outras_receitas",
  "outras_despesas",
  "ir_csll",
] as const;

const GRUPO_LABEL: Record<string, string> = {
  receita_bruta: "Receita Operacional Bruta",
  deducoes: "Deduções e Impostos",
  custos_vendas: "Custos de Vendas",
  despesas_vendas: "Despesas com Vendas",
  despesas_administrativas: "Despesas Administrativas",
  despesas_financeiras: "Despesas Financeiras",
  receitas_financeiras: "Receitas Financeiras",
  outras_receitas: "Outras Receitas",
  outras_despesas: "Outras Despesas",
  ir_csll: "IR/CSLL",
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatarPercentual(valor: number, base: number) {
  if (!base) return "0,00%";
  return `${((valor / base) * 100).toFixed(2).replace(".", ",")}%`;
}

export default function DREPage() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [regime, setRegime] = useState<"competencia" | "caixa">("competencia");

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [planosConta, setPlanosConta] = useState<PlanoConta[]>([]);
  const [lancamentos, setLancamentos] = useState<LancamentoDRE[]>([]);
  const [loading, setLoading] = useState(true);
  const [painelCategoriasAberto, setPainelCategoriasAberto] = useState(false);

  const inicio = toISODate(new Date(ano, mes, 1));
  const fim = toISODate(new Date(ano, mes + 1, 0));

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: c }, { data: p }, { data: l }] = await Promise.all([
      supabase.from("dre_categorias").select("id, nome, grupo, ordem").order("grupo").order("ordem"),
      supabase.from("planos_conta").select("id, nome, tipo, dre_categoria_id"),
      supabase
        .from("lancamentos")
        .select("valor, tipo, situacao, plano_conta_id, data_competencia, data_quitacao")
        .neq("tipo", "transferencia"),
    ]);
    setCategorias((c as Categoria[]) ?? []);
    setPlanosConta((p as PlanoConta[]) ?? []);
    setLancamentos((l as LancamentoDRE[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Filtra lançamentos do período, pelo regime escolhido
  const lancamentosDoPeriodo = lancamentos.filter((l) => {
    if (regime === "caixa") {
      if (l.situacao !== "pago" || !l.data_quitacao) return false;
      return l.data_quitacao >= inicio && l.data_quitacao <= fim;
    }
    if (!l.data_competencia) return false;
    return l.data_competencia >= inicio && l.data_competencia <= fim;
  });

  const somaPorPlanoConta: Record<string, number> = {};
  for (const l of lancamentosDoPeriodo) {
    if (!l.plano_conta_id) continue;
    somaPorPlanoConta[l.plano_conta_id] = (somaPorPlanoConta[l.plano_conta_id] ?? 0) + l.valor;
  }

  function planosDaCategoria(categoriaId: string) {
    return planosConta.filter((p) => p.dre_categoria_id === categoriaId);
  }

  function somaCategoria(categoriaId: string) {
    return planosDaCategoria(categoriaId).reduce((s, p) => s + (somaPorPlanoConta[p.id] ?? 0), 0);
  }

  function categoriasDoGrupo(grupo: string) {
    return categorias.filter((c) => c.grupo === grupo);
  }

  function somaGrupo(grupo: string) {
    return categoriasDoGrupo(grupo).reduce((s, c) => s + somaCategoria(c.id), 0);
  }

  const planosSemCategoria = planosConta.filter((p) => !p.dre_categoria_id && (somaPorPlanoConta[p.id] ?? 0) !== 0);
  const totalSemCategoria = planosSemCategoria.reduce((s, p) => s + (somaPorPlanoConta[p.id] ?? 0), 0);

  const receitaBruta = somaGrupo("receita_bruta");
  const deducoes = somaGrupo("deducoes");
  const receitaLiquida = receitaBruta - deducoes;
  const custos = somaGrupo("custos_vendas");
  const resultadoBruto = receitaLiquida - custos;
  const despesasVendas = somaGrupo("despesas_vendas");
  const despesasAdministrativas = somaGrupo("despesas_administrativas");
  const despesasFinanceiras = somaGrupo("despesas_financeiras");
  const receitasFinanceiras = somaGrupo("receitas_financeiras");
  const resultadoOperacional =
    resultadoBruto - despesasVendas - despesasAdministrativas - despesasFinanceiras + receitasFinanceiras;
  const outrasReceitas = somaGrupo("outras_receitas");
  const outrasDespesas = somaGrupo("outras_despesas");
  const irCsll = somaGrupo("ir_csll");
  const resultadoLiquido = resultadoOperacional + outrasReceitas - outrasDespesas - irCsll;

  const base = receitaBruta || 1;

  return (
    <main className="w-full px-6 sm:px-8 lg:px-10 py-10 print:py-0 print:px-0">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-extrabold text-ink mb-1">DRE Gerencial</h1>
          <p className="text-sm text-ink/60">Demonstrativo de resultado do exercício.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPainelCategoriasAberto(true)}
            className="rounded-full border-2 border-ink/15 text-ink px-4 py-2 text-sm font-semibold hover:bg-surface transition-colors"
          >
            Gerenciar categorias
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-full bg-ink text-white px-4 py-2 text-sm font-semibold hover:bg-forest transition-colors"
          >
            Exportar / Imprimir PDF
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6 print:hidden">
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="input py-1.5 w-auto">
          {MESES.map((m, i) => (
            <option key={m} value={i}>
              {m}
            </option>
          ))}
        </select>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="input py-1.5 w-auto">
          {Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - 3 + i).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1">
          <button
            onClick={() => setRegime("competencia")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              regime === "competencia" ? "bg-ink text-white" : "text-ink/60"
            }`}
          >
            Competência
          </button>
          <button
            onClick={() => setRegime("caixa")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              regime === "caixa" ? "bg-ink text-white" : "text-ink/60"
            }`}
          >
            Caixa
          </button>
        </div>
      </div>

      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">DRE Gerencial — {MESES[mes]} de {ano}</h1>
        <p className="text-xs text-ink/50">
          Regime de {regime === "competencia" ? "competência" : "caixa"} · Gerado em {new Date().toLocaleString("pt-BR")}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-ink/50">Carregando...</p>
      ) : (
        <div className="rounded-3xl bg-card border border-black/5 overflow-hidden print:border-0 print:rounded-none">
          <table className="w-full text-sm">
            <tbody>
              <LinhaGrupo label="(+) Receita Operacional Bruta" valor={receitaBruta} base={base} destaque />
              <BlocoCategoria grupo="receita_bruta" categorias={categoriasDoGrupo("receita_bruta")} somaCategoria={somaCategoria} planosDaCategoria={planosDaCategoria} somaPorPlanoConta={somaPorPlanoConta} base={base} />

              <LinhaGrupo label="(-) Deduções e Impostos" valor={deducoes} base={base} />
              <BlocoCategoria grupo="deducoes" categorias={categoriasDoGrupo("deducoes")} somaCategoria={somaCategoria} planosDaCategoria={planosDaCategoria} somaPorPlanoConta={somaPorPlanoConta} base={base} />

              <LinhaGrupo label="(=) Receita Operacional Líquida" valor={receitaLiquida} base={base} destaque subtotal />

              <LinhaGrupo label="(-) Custos de Vendas" valor={custos} base={base} />
              <BlocoCategoria grupo="custos_vendas" categorias={categoriasDoGrupo("custos_vendas")} somaCategoria={somaCategoria} planosDaCategoria={planosDaCategoria} somaPorPlanoConta={somaPorPlanoConta} base={base} />

              <LinhaGrupo label="(=) Resultado Operacional Bruto" valor={resultadoBruto} base={base} destaque subtotal />

              <LinhaGrupo label="(-) Despesas com Vendas" valor={despesasVendas} base={base} />
              <BlocoCategoria grupo="despesas_vendas" categorias={categoriasDoGrupo("despesas_vendas")} somaCategoria={somaCategoria} planosDaCategoria={planosDaCategoria} somaPorPlanoConta={somaPorPlanoConta} base={base} />

              <LinhaGrupo label="(-) Despesas Administrativas" valor={despesasAdministrativas} base={base} />
              <BlocoCategoria grupo="despesas_administrativas" categorias={categoriasDoGrupo("despesas_administrativas")} somaCategoria={somaCategoria} planosDaCategoria={planosDaCategoria} somaPorPlanoConta={somaPorPlanoConta} base={base} />

              <LinhaGrupo label="(-) Despesas Financeiras" valor={despesasFinanceiras} base={base} />
              <BlocoCategoria grupo="despesas_financeiras" categorias={categoriasDoGrupo("despesas_financeiras")} somaCategoria={somaCategoria} planosDaCategoria={planosDaCategoria} somaPorPlanoConta={somaPorPlanoConta} base={base} />

              <LinhaGrupo label="(+) Receitas Financeiras" valor={receitasFinanceiras} base={base} />
              <BlocoCategoria grupo="receitas_financeiras" categorias={categoriasDoGrupo("receitas_financeiras")} somaCategoria={somaCategoria} planosDaCategoria={planosDaCategoria} somaPorPlanoConta={somaPorPlanoConta} base={base} />

              <LinhaGrupo label="(=) Resultado Operacional" valor={resultadoOperacional} base={base} destaque subtotal />

              <LinhaGrupo label="(+) Outras Receitas" valor={outrasReceitas} base={base} />
              <BlocoCategoria grupo="outras_receitas" categorias={categoriasDoGrupo("outras_receitas")} somaCategoria={somaCategoria} planosDaCategoria={planosDaCategoria} somaPorPlanoConta={somaPorPlanoConta} base={base} />

              <LinhaGrupo label="(-) Outras Despesas" valor={outrasDespesas} base={base} />
              <BlocoCategoria grupo="outras_despesas" categorias={categoriasDoGrupo("outras_despesas")} somaCategoria={somaCategoria} planosDaCategoria={planosDaCategoria} somaPorPlanoConta={somaPorPlanoConta} base={base} />

              <LinhaGrupo label="(-) IR/CSLL" valor={irCsll} base={base} />
              <BlocoCategoria grupo="ir_csll" categorias={categoriasDoGrupo("ir_csll")} somaCategoria={somaCategoria} planosDaCategoria={planosDaCategoria} somaPorPlanoConta={somaPorPlanoConta} base={base} />

              <tr className="bg-ink text-white">
                <td className="px-4 py-3 font-bold">(=) Resultado Líquido do Exercício</td>
                <td className="px-4 py-3 font-bold text-right">{formatarMoeda(resultadoLiquido)}</td>
                <td className="px-4 py-3 font-bold text-right w-20">{formatarPercentual(resultadoLiquido, base)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!loading && planosSemCategoria.length > 0 && (
        <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 print:hidden">
          <p className="text-sm font-semibold text-amber-800 mb-2">
            ⚠️ {formatarMoeda(totalSemCategoria)} em planos de conta sem categoria de DRE neste período (não entram
            no cálculo acima):
          </p>
          <ul className="text-xs text-amber-700 space-y-0.5">
            {planosSemCategoria.map((p) => (
              <li key={p.id}>
                {p.nome} — {formatarMoeda(somaPorPlanoConta[p.id] ?? 0)}
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-700 mt-2">
            Vá em Configurações → Planos de conta e escolha uma categoria pra cada um.
          </p>
        </div>
      )}

      {painelCategoriasAberto && (
        <PainelCategorias categorias={categorias} onClose={() => setPainelCategoriasAberto(false)} onChange={carregar} />
      )}
    </main>
  );
}

function LinhaGrupo({
  label,
  valor,
  base,
  destaque,
  subtotal,
}: {
  label: string;
  valor: number;
  base: number;
  destaque?: boolean;
  subtotal?: boolean;
}) {
  return (
    <tr className={destaque ? (subtotal ? "bg-surface" : "bg-ink text-white") : "border-t border-black/5"}>
      <td className={`px-4 py-2.5 ${destaque ? "font-bold" : "font-semibold text-ink/80"}`}>{label}</td>
      <td className={`px-4 py-2.5 text-right ${destaque ? "font-bold" : "font-semibold"}`}>{formatarMoeda(valor)}</td>
      <td className={`px-4 py-2.5 text-right w-20 ${destaque ? "font-bold" : "text-ink/50"}`}>
        {formatarPercentual(valor, base)}
      </td>
    </tr>
  );
}

function BlocoCategoria({
  categorias,
  somaCategoria,
  planosDaCategoria,
  somaPorPlanoConta,
  base,
}: {
  grupo: string;
  categorias: Categoria[];
  somaCategoria: (id: string) => number;
  planosDaCategoria: (id: string) => PlanoConta[];
  somaPorPlanoConta: Record<string, number>;
  base: number;
}) {
  return (
    <>
      {categorias.map((cat) => {
        const total = somaCategoria(cat.id);
        const planos = planosDaCategoria(cat.id).filter((p) => (somaPorPlanoConta[p.id] ?? 0) !== 0);
        if (total === 0 && planos.length === 0) return null;
        return (
          <Fragment key={cat.id}>
            <tr className="text-ink/70">
              <td className="px-4 py-1.5 pl-8">{cat.nome}</td>
              <td className="px-4 py-1.5 text-right">{formatarMoeda(total)}</td>
              <td className="px-4 py-1.5 text-right w-20 text-xs text-ink/40">{formatarPercentual(total, base)}</td>
            </tr>
            {planos.map((p) => (
              <tr key={p.id} className="text-ink/50 text-xs">
                <td className="px-4 py-1 pl-14">{p.nome}</td>
                <td className="px-4 py-1 text-right">{formatarMoeda(somaPorPlanoConta[p.id] ?? 0)}</td>
                <td className="px-4 py-1 text-right w-20">{formatarPercentual(somaPorPlanoConta[p.id] ?? 0, base)}</td>
              </tr>
            ))}
          </Fragment>
        );
      })}
    </>
  );
}

function PainelCategorias({
  categorias,
  onClose,
  onChange,
}: {
  categorias: Categoria[];
  onClose: () => void;
  onChange: () => void;
}) {
  const [novoNome, setNovoNome] = useState<Record<string, string>>({});
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");

  async function adicionar(grupo: string) {
    const nome = (novoNome[grupo] ?? "").trim();
    if (!nome) return;
    const supabase = createClient();
    const maxOrdem = Math.max(0, ...categorias.filter((c) => c.grupo === grupo).map((c) => c.ordem));
    await supabase.from("dre_categorias").insert({ nome, grupo, ordem: maxOrdem + 1 });
    setNovoNome((s) => ({ ...s, [grupo]: "" }));
    onChange();
  }

  async function salvarEdicao(id: string) {
    if (!nomeEditado.trim()) return;
    const supabase = createClient();
    await supabase.from("dre_categorias").update({ nome: nomeEditado.trim() }).eq("id", id);
    setEditandoId(null);
    onChange();
  }

  async function remover(id: string) {
    if (!window.confirm("Excluir esta categoria? Planos de conta ligados a ela ficam sem categoria.")) return;
    const supabase = createClient();
    await supabase.from("dre_categorias").delete().eq("id", id);
    onChange();
  }

  async function mover(cat: Categoria, direcao: -1 | 1) {
    const doGrupo = categorias.filter((c) => c.grupo === cat.grupo).sort((a, b) => a.ordem - b.ordem);
    const indice = doGrupo.findIndex((c) => c.id === cat.id);
    const alvo = doGrupo[indice + direcao];
    if (!alvo) return;
    const supabase = createClient();
    await supabase.from("dre_categorias").update({ ordem: alvo.ordem }).eq("id", cat.id);
    await supabase.from("dre_categorias").update({ ordem: cat.ordem }).eq("id", alvo.id);
    onChange();
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-3xl bg-surface p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-ink">Categorias do DRE</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-lg leading-none">
            ✕
          </button>
        </div>

        <p className="text-xs text-ink/50 mb-5">
          Os blocos (Receita Bruta, Despesas Administrativas, etc.) são fixos, seguindo a estrutura
          contábil padrão. Dentro de cada um, crie, renomeie, reordene ou remova as categorias como
          quiser.
        </p>

        <div className="space-y-5">
          {GRUPOS_ORDEM.map((grupo) => {
            const doGrupo = categorias.filter((c) => c.grupo === grupo).sort((a, b) => a.ordem - b.ordem);
            return (
              <div key={grupo} className="rounded-2xl bg-card p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">{GRUPO_LABEL[grupo]}</p>
                <div className="space-y-1 mb-3">
                  {doGrupo.map((cat, i) => (
                    <div key={cat.id} className="flex items-center justify-between gap-2 text-sm">
                      {editandoId === cat.id ? (
                        <input
                          autoFocus
                          value={nomeEditado}
                          onChange={(e) => setNomeEditado(e.target.value)}
                          onBlur={() => salvarEdicao(cat.id)}
                          onKeyDown={(e) => e.key === "Enter" && salvarEdicao(cat.id)}
                          className="input text-sm py-1"
                        />
                      ) : (
                        <span className="text-ink flex-1">{cat.nome}</span>
                      )}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => mover(cat, -1)} disabled={i === 0} className="text-ink/30 hover:text-ink disabled:opacity-20 px-1">
                          ↑
                        </button>
                        <button onClick={() => mover(cat, 1)} disabled={i === doGrupo.length - 1} className="text-ink/30 hover:text-ink disabled:opacity-20 px-1">
                          ↓
                        </button>
                        <button
                          onClick={() => {
                            setEditandoId(cat.id);
                            setNomeEditado(cat.nome);
                          }}
                          className="text-xs text-ink/40 hover:text-ink px-1"
                        >
                          Editar
                        </button>
                        <button onClick={() => remover(cat.id)} className="text-xs text-ink/40 hover:text-red-600 px-1">
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={novoNome[grupo] ?? ""}
                    onChange={(e) => setNovoNome((s) => ({ ...s, [grupo]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && adicionar(grupo)}
                    className="input text-sm py-1.5"
                    placeholder="Nova categoria..."
                  />
                  <button
                    onClick={() => adicionar(grupo)}
                    className="shrink-0 rounded-full bg-forest text-white px-3 text-xs font-bold hover:bg-ink transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
