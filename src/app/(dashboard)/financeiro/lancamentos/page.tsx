"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PessoaForm } from "@/components/pessoa-form";

interface Lancamento {
  id: string;
  descricao: string | null;
  valor: number;
  tipo: "receita" | "despesa" | "transferencia";
  situacao: "pendente" | "pago";
  data_vencimento: string;
  data_quitacao: string | null;
  data_competencia: string | null;
  codigo_transacao: string | null;
  banco_id: string | null;
  plano_conta_id: string | null;
  servico_id: string | null;
  numero_parcela: number | null;
  total_parcelas: number | null;
  recorrencia_tipo: "mensal" | "semanal" | "anual" | null;
  clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
  pessoas: { nome: string } | null;
  bancos: { nome: string } | null;
  planos_conta: { nome: string } | null;
  servicos: { nome: string } | null;
}

interface PessoaOpcao {
  id: string;
  nome: string;
  tipo_pessoa: "PF" | "PJ";
}

interface Opcao {
  id: string;
  nome: string;
}

interface PlanoContaOpcao extends Opcao {
  tipo: "receita" | "despesa";
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string | null) {
  if (!data) return "—";
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

type PeriodoPreset =
  | "hoje"
  | "esta_semana"
  | "semana_passada"
  | "proxima_semana"
  | "ultimos_7"
  | "ultimos_14"
  | "este_mes"
  | "mes_passado"
  | "proximo_mes"
  | "personalizado";

const PERIODO_LABEL: Record<PeriodoPreset, string> = {
  hoje: "Hoje",
  esta_semana: "Esta semana",
  semana_passada: "Semana passada",
  proxima_semana: "Próxima semana",
  ultimos_7: "Últimos 7 dias",
  ultimos_14: "Últimos 14 dias",
  este_mes: "Este mês",
  mes_passado: "Mês passado",
  proximo_mes: "Próximo mês",
  personalizado: "Personalizado",
};

const PERIODO_ORDEM: PeriodoPreset[] = [
  "este_mes",
  "hoje",
  "esta_semana",
  "semana_passada",
  "proxima_semana",
  "ultimos_7",
  "ultimos_14",
  "mes_passado",
  "proximo_mes",
  "personalizado",
];

function calcularPeriodo(preset: PeriodoPreset): { inicio: string; fim: string } {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const inicioSemana = new Date(hoje);
  const diaSemana = (hoje.getDay() + 6) % 7; // 0 = segunda
  inicioSemana.setDate(hoje.getDate() - diaSemana);

  switch (preset) {
    case "hoje":
      return { inicio: toISODate(hoje), fim: toISODate(hoje) };
    case "esta_semana": {
      const fim = new Date(inicioSemana);
      fim.setDate(inicioSemana.getDate() + 6);
      return { inicio: toISODate(inicioSemana), fim: toISODate(fim) };
    }
    case "semana_passada": {
      const inicio = new Date(inicioSemana);
      inicio.setDate(inicioSemana.getDate() - 7);
      const fim = new Date(inicio);
      fim.setDate(inicio.getDate() + 6);
      return { inicio: toISODate(inicio), fim: toISODate(fim) };
    }
    case "proxima_semana": {
      const inicio = new Date(inicioSemana);
      inicio.setDate(inicioSemana.getDate() + 7);
      const fim = new Date(inicio);
      fim.setDate(inicio.getDate() + 6);
      return { inicio: toISODate(inicio), fim: toISODate(fim) };
    }
    case "ultimos_7": {
      const inicio = new Date(hoje);
      inicio.setDate(hoje.getDate() - 6);
      return { inicio: toISODate(inicio), fim: toISODate(hoje) };
    }
    case "ultimos_14": {
      const inicio = new Date(hoje);
      inicio.setDate(hoje.getDate() - 13);
      return { inicio: toISODate(inicio), fim: toISODate(hoje) };
    }
    case "mes_passado": {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      return { inicio: toISODate(inicio), fim: toISODate(fim) };
    }
    case "proximo_mes": {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0);
      return { inicio: toISODate(inicio), fim: toISODate(fim) };
    }
    case "este_mes":
    default: {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      return { inicio: toISODate(inicio), fim: toISODate(fim) };
    }
  }
}

function nomePessoaLancamento(l: { clientes: Lancamento["clientes"]; pessoas: Lancamento["pessoas"] }) {
  return l.clientes?.papeis?.pessoas?.nome ?? l.pessoas?.nome ?? null;
}

type Filtro = "todos" | "pendente" | "pago";

export default function LancamentosPage() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [detalhe, setDetalhe] = useState<Lancamento | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [resumoAberto, setResumoAberto] = useState(false);

  const [presetPeriodo, setPresetPeriodo] = useState<PeriodoPreset>("este_mes");
  const [periodoPersonalizado, setPeriodoPersonalizado] = useState(calcularPeriodo("este_mes"));
  const periodo = presetPeriodo === "personalizado" ? periodoPersonalizado : calcularPeriodo(presetPeriodo);

  const [buscaAvancadaAberta, setBuscaAvancadaAberta] = useState(false);
  const [bancosOpcoes, setBancosOpcoes] = useState<Opcao[]>([]);
  const [planosContaOpcoes, setPlanosContaOpcoes] = useState<Opcao[]>([]);
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroDescricao, setFiltroDescricao] = useState("");
  const [filtroPlanoContaId, setFiltroPlanoContaId] = useState("");
  const [filtroBancoId, setFiltroBancoId] = useState("");
  const [filtroValor, setFiltroValor] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"" | "receita" | "despesa" | "transferencia">("");

  function limparFiltrosAvancados() {
    setFiltroCliente("");
    setFiltroDescricao("");
    setFiltroPlanoContaId("");
    setFiltroBancoId("");
    setFiltroValor("");
    setFiltroTipo("");
  }

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("lancamentos")
      .select(
        `id, descricao, valor, tipo, situacao, data_vencimento, data_quitacao, data_competencia, codigo_transacao,
         banco_id, plano_conta_id, servico_id, numero_parcela, total_parcelas, recorrencia_tipo,
         clientes ( papeis ( pessoas ( nome ) ) ),
         pessoas ( nome ),
         bancos ( nome ),
         planos_conta ( nome ),
         servicos ( nome )`
      )
      .order("data_vencimento", { ascending: true });
    setLancamentos((data as unknown as Lancamento[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
    async function carregarOpcoes() {
      const supabase = createClient();
      const [{ data: b }, { data: p }] = await Promise.all([
        supabase.from("bancos").select("id, nome").order("nome"),
        supabase.from("planos_conta").select("id, nome").order("nome"),
      ]);
      setBancosOpcoes(b ?? []);
      setPlanosContaOpcoes(p ?? []);
    }
    carregarOpcoes();
  }, [carregar]);

  const noPeriodo = (data: string) => data >= periodo.inicio && data <= periodo.fim;

  const lancamentosDoPeriodo = lancamentos.filter((l) => noPeriodo(l.data_vencimento));
  async function remover(id: string) {
    if (!window.confirm("Excluir este lançamento? Essa ação não pode ser desfeita.")) return;
    const supabase = createClient();
    await supabase.from("lancamentos").delete().eq("id", id);
    carregar();
  }

  const filtrados = lancamentosDoPeriodo
    .filter((l) => filtro === "todos" || l.situacao === filtro)
    .filter((l) => !filtroTipo || l.tipo === filtroTipo)
    .filter(
      (l) =>
        !filtroCliente ||
        (nomePessoaLancamento(l) ?? "").toLowerCase().includes(filtroCliente.toLowerCase())
    )
    .filter((l) => !filtroDescricao || (l.descricao ?? "").toLowerCase().includes(filtroDescricao.toLowerCase()))
    .filter((l) => !filtroPlanoContaId || l.plano_conta_id === filtroPlanoContaId)
    .filter((l) => !filtroBancoId || l.banco_id === filtroBancoId)
    .filter((l) => !filtroValor || l.valor.toFixed(2).includes(filtroValor.replace(",", ".")));

  function somar(lista: Lancamento[], tipo: "receita" | "despesa") {
    return lista.filter((l) => l.tipo === tipo).reduce((soma, l) => soma + l.valor, 0);
  }

  const previsaoReceitas = somar(lancamentosDoPeriodo, "receita");
  const previsaoDespesas = somar(lancamentosDoPeriodo, "despesa");

  const realizados = lancamentosDoPeriodo.filter((l) => l.situacao === "pago");
  const realizadoReceitas = somar(realizados, "receita");
  const realizadoDespesas = somar(realizados, "despesa");

  const pendentes = lancamentosDoPeriodo.filter((l) => l.situacao === "pendente");
  const pendenteReceitas = somar(pendentes, "receita");
  const pendenteDespesas = somar(pendentes, "despesa");

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Lançamentos</h1>
          <p className="text-sm text-ink/60 mt-1">Contas a pagar e a receber da Easy Company.</p>
        </div>
        {!painelAberto && !editando && (
          <button
            onClick={() => setPainelAberto(true)}
            className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
          >
            + Novo lançamento
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <select
            value={presetPeriodo}
            onChange={(e) => {
              const preset = e.target.value as PeriodoPreset;
              setPresetPeriodo(preset);
              if (preset === "personalizado") setPeriodoPersonalizado(calcularPeriodo("este_mes"));
            }}
            className="input !w-auto"
          >
            {PERIODO_ORDEM.map((p) => (
              <option key={p} value={p}>
                {PERIODO_LABEL[p]}
              </option>
            ))}
          </select>

          {presetPeriodo === "personalizado" && (
            <>
              <input
                type="date"
                value={periodoPersonalizado.inicio}
                onChange={(e) => setPeriodoPersonalizado((p) => ({ ...p, inicio: e.target.value }))}
                className="input !w-auto"
              />
              <span className="text-ink/40 text-sm">até</span>
              <input
                type="date"
                value={periodoPersonalizado.fim}
                onChange={(e) => setPeriodoPersonalizado((p) => ({ ...p, fim: e.target.value }))}
                className="input !w-auto"
              />
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setBuscaAvancadaAberta((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold border-2 transition-colors ${
              buscaAvancadaAberta
                ? "bg-forest text-white border-forest"
                : "bg-white text-forest border-forest hover:bg-mint"
            }`}
          >
            🔍 Busca avançada
          </button>

          <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1.5 shadow-inner">
            {(["todos", "pendente", "pago"] as Filtro[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${
                  filtro === f ? "bg-ink text-white shadow-md scale-105" : "text-ink/50 hover:text-ink hover:bg-white/60"
                }`}
              >
                {f === "todos" ? "Todos" : f === "pendente" ? "Pendentes" : "Pagos"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {buscaAvancadaAberta && (
        <div className="rounded-3xl bg-ink p-6 mb-6">
          <h3 className="text-forest text-sm font-bold mb-4">Busca avançada</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <CampoEscuro label="Cliente / Fornecedor">
              <input
                value={filtroCliente}
                onChange={(e) => setFiltroCliente(e.target.value)}
                className="input-escuro"
                placeholder="Nome..."
              />
            </CampoEscuro>
            <CampoEscuro label="Descrição">
              <input
                value={filtroDescricao}
                onChange={(e) => setFiltroDescricao(e.target.value)}
                className="input-escuro"
                placeholder="Descrição..."
              />
            </CampoEscuro>
            <CampoEscuro label="Plano de conta">
              <select
                value={filtroPlanoContaId}
                onChange={(e) => setFiltroPlanoContaId(e.target.value)}
                className="input-escuro"
              >
                <option value="">Todos</option>
                {planosContaOpcoes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </CampoEscuro>
            <CampoEscuro label="Conta bancária">
              <select
                value={filtroBancoId}
                onChange={(e) => setFiltroBancoId(e.target.value)}
                className="input-escuro"
              >
                <option value="">Todos</option>
                {bancosOpcoes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nome}
                  </option>
                ))}
              </select>
            </CampoEscuro>
            <CampoEscuro label="Valor">
              <input
                value={filtroValor}
                onChange={(e) => setFiltroValor(e.target.value)}
                className="input-escuro"
                placeholder="Ex: 650,00"
              />
            </CampoEscuro>
            <CampoEscuro label="Tipo de lançamento">
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as "" | "receita" | "despesa" | "transferencia")}
                className="input-escuro"
              >
                <option value="">Todos</option>
                <option value="receita">Receitas</option>
                <option value="despesa">Despesas</option>
                <option value="transferencia">Transferências</option>
              </select>
            </CampoEscuro>
            <CampoEscuro label="Situação do lançamento">
              <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} className="input-escuro">
                <option value="todos">Todas</option>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
              </select>
            </CampoEscuro>
          </div>
          <button
            onClick={limparFiltrosAvancados}
            className="mt-4 text-sm font-semibold text-white/50 hover:text-white"
          >
            Limpar filtros
          </button>
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={() => setResumoAberto((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-forest to-ink text-white px-5 py-2.5 text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          📊 Resumo {resumoAberto ? "▲" : "▼"}
        </button>
      </div>

      {resumoAberto && (
        <div className="rounded-3xl bg-card border border-black/5 overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="w-1/4"></th>
                <th className="bg-mint/60 text-forest text-center py-3 text-sm font-bold">Receitas</th>
                <th className="bg-red-50 text-red-600 text-center py-3 text-sm font-bold">Despesas</th>
                <th className="bg-ink text-white text-center py-3 text-sm font-bold rounded-tr-3xl">Resultado</th>
              </tr>
            </thead>
            <tbody>
              <LinhaResumo
                titulo="Previsão do período"
                receitas={previsaoReceitas}
                despesas={previsaoDespesas}
              />
              <LinhaResumo
                titulo="Realizado no período"
                receitas={realizadoReceitas}
                despesas={realizadoDespesas}
              />
              <LinhaResumo
                titulo="Pendente no período"
                receitas={pendenteReceitas}
                despesas={pendenteDespesas}
                ultima
              />
            </tbody>
          </table>
          <p className="text-xs text-ink/40 px-5 py-3 border-t border-black/5">
            Período: {formatarData(periodo.inicio)} até {formatarData(periodo.fim)}
          </p>
        </div>
      )}

      {(painelAberto || editando) && (
        <div
          className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6"
          onClick={() => {
            setPainelAberto(false);
            setEditando(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-ink mb-5">
              {editando ? "Editar lançamento" : "Novo lançamento"}
            </h2>
            <LancamentoForm
              lancamentoEditando={editando}
              onSaved={() => {
                setPainelAberto(false);
                setEditando(null);
                carregar();
              }}
              onCancel={() => {
                setPainelAberto(false);
                setEditando(null);
              }}
            />
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-card border border-black/5 overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-ink/50">Carregando...</p>
        ) : filtrados.length === 0 ? (
          <p className="p-6 text-sm text-ink/50">Nenhum lançamento encontrado.</p>
        ) : (
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-ink/50 border-b border-black/5">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Vencimento</th>
                <th className="px-4 py-3 font-medium">Quitação</th>
                <th className="px-4 py-3 font-medium">Banco</th>
                <th className="px-4 py-3 font-medium">Plano de conta</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setDetalhe(l)}
                  className="border-b border-black/5 last:border-0 hover:bg-surface/60 cursor-pointer"
                >
                  <td className="px-4 py-3 font-semibold text-ink">
                    {nomePessoaLancamento(l) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {l.descricao ?? "—"}
                    {l.total_parcelas && (
                      <span className="ml-1.5 text-xs text-ink/40 font-mono">
                        {l.numero_parcela}/{l.total_parcelas}
                      </span>
                    )}
                    {l.recorrencia_tipo && (
                      <span className="ml-1.5 text-xs text-ink/40">🔁</span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 font-semibold ${
                      l.tipo === "receita" ? "text-forest" : l.tipo === "despesa" ? "text-red-600" : "text-ink/70"
                    }`}
                  >
                    {l.tipo === "despesa" ? "- " : ""}
                    {formatarMoeda(l.valor)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        l.tipo === "receita"
                          ? "bg-mint text-forest"
                          : l.tipo === "despesa"
                          ? "bg-red-50 text-red-600"
                          : "bg-black/5 text-ink/60"
                      }`}
                    >
                      {l.tipo === "receita" ? "Receita" : l.tipo === "despesa" ? "Despesa" : "Transferência"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink/70">{formatarData(l.data_vencimento)}</td>
                  <td className="px-4 py-3 text-ink/70">{formatarData(l.data_quitacao)}</td>
                  <td className="px-4 py-3 text-ink/70">{l.bancos?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-ink/70">{l.planos_conta?.nome ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        l.situacao === "pago" ? "bg-mint text-forest" : "bg-black/5 text-ink/50"
                      }`}
                    >
                      {l.situacao === "pago" ? "Pago" : "Pendente"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink/50 font-mono text-xs">{l.codigo_transacao ?? "—"}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditando(l);
                          setPainelAberto(false);
                        }}
                        className="rounded-full px-3 py-1.5 text-xs font-bold bg-forest text-white hover:bg-ink transition-colors shadow-sm"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => remover(l.id)}
                        className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-ink/40 hover:text-red-600 transition-colors"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detalhe && (
        <div
          className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6"
          onClick={() => setDetalhe(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-surface p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-mono text-xs text-ink/50">{detalhe.codigo_transacao ?? "—"}</p>
                <p className="font-bold text-ink leading-tight">
                  {nomePessoaLancamento(detalhe) ?? detalhe.descricao ?? "Lançamento"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    detalhe.situacao === "pago" ? "bg-mint text-forest" : "bg-black/5 text-ink/50"
                  }`}
                >
                  {detalhe.situacao === "pago" ? "Pago" : "Pendente"}
                </span>
                <button onClick={() => setDetalhe(null)} className="text-ink/40 hover:text-ink text-lg leading-none">
                  ✕
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-card p-4 mb-4 shadow-sm">
              <p className="text-xs text-ink/50 mb-0.5">Valor</p>
              <p
                className={`text-xl font-extrabold ${
                  detalhe.tipo === "receita" ? "text-forest" : detalhe.tipo === "despesa" ? "text-red-600" : "text-ink"
                }`}
              >
                {detalhe.tipo === "despesa" ? "- " : ""}
                {formatarMoeda(detalhe.valor)}
              </p>
              <p className="text-xs text-ink/40 mt-3 pt-3 border-t border-black/5">
                {detalhe.tipo === "receita" ? "Receita" : detalhe.tipo === "despesa" ? "Despesa" : "Transferência"}
              </p>
            </div>

            <SecaoDetalhe titulo="Datas">
              <DetalheLinha label="Vencimento" valor={formatarData(detalhe.data_vencimento)} />
              <DetalheLinha label="Competência" valor={formatarData(detalhe.data_competencia)} />
              <DetalheLinha label="Quitação" valor={formatarData(detalhe.data_quitacao)} />
            </SecaoDetalhe>

            <SecaoDetalhe titulo="Classificação">
              <DetalheLinha label="Banco" valor={detalhe.bancos?.nome ?? "—"} />
              <DetalheLinha label="Plano de conta" valor={detalhe.planos_conta?.nome ?? "—"} />
              <DetalheLinha label="Descrição" valor={detalhe.descricao ?? "—"} />
            </SecaoDetalhe>

            {(detalhe.total_parcelas || detalhe.recorrencia_tipo) && (
              <SecaoDetalhe titulo="Repetição">
                {detalhe.total_parcelas && (
                  <DetalheLinha label="Parcela" valor={`${detalhe.numero_parcela}/${detalhe.total_parcelas}`} />
                )}
                {detalhe.recorrencia_tipo && (
                  <DetalheLinha
                    label="Recorrência"
                    valor={
                      detalhe.recorrencia_tipo === "mensal"
                        ? "Mensal"
                        : detalhe.recorrencia_tipo === "semanal"
                        ? "Semanal"
                        : "Anual"
                    }
                  />
                )}
              </SecaoDetalhe>
            )}

            <button
              onClick={() => {
                remover(detalhe.id);
                setDetalhe(null);
              }}
              className="w-full rounded-full border-2 border-red-200 text-red-600 px-5 py-2.5 text-sm font-bold hover:bg-red-50 transition-colors"
            >
              Excluir lançamento
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function LinhaResumo({
  titulo,
  receitas,
  despesas,
  ultima,
}: {
  titulo: string;
  receitas: number;
  despesas: number;
  ultima?: boolean;
}) {
  const resultado = receitas - despesas;
  return (
    <tr className={ultima ? "" : "border-b border-black/5"}>
      <td className="px-5 py-3.5 text-sm font-medium text-ink/70">{titulo}</td>
      <td className="text-center py-3.5 text-sm font-bold text-forest">{formatarMoeda(receitas)}</td>
      <td className="text-center py-3.5 text-sm font-bold text-red-600">{formatarMoeda(despesas)}</td>
      <td className={`text-center py-3.5 text-sm font-bold ${resultado < 0 ? "text-red-400" : "text-mint"} bg-ink`}>
        {resultado < 0 ? "-" : ""}
        {formatarMoeda(Math.abs(resultado))}
      </td>
    </tr>
  );
}

function SecaoDetalhe({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">{titulo}</p>
      <div className="rounded-2xl bg-card p-4 shadow-sm space-y-2.5">{children}</div>
    </div>
  );
}

function DetalheLinha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <dt className="text-ink/50">{label}</dt>
      <dd className="font-semibold text-ink text-right">{valor}</dd>
    </div>
  );
}


function LancamentoForm({
  lancamentoEditando,
  onSaved,
  onCancel,
}: {
  lancamentoEditando: Lancamento | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const editando = !!lancamentoEditando;

  const [tipo, setTipo] = useState<"receita" | "despesa" | "transferencia">(lancamentoEditando?.tipo ?? "receita");

  const [pessoas, setPessoas] = useState<PessoaOpcao[]>([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<PessoaOpcao | null>(null);
  const [buscaCliente, setBuscaCliente] = useState(
    lancamentoEditando ? nomePessoaLancamento(lancamentoEditando) ?? "" : ""
  );
  const [mostrarSugCliente, setMostrarSugCliente] = useState(false);
  const [cadastrandoCliente, setCadastrandoCliente] = useState(false);

  const [bancos, setBancos] = useState<Opcao[]>([]);
  const [bancoSelecionado, setBancoSelecionado] = useState<Opcao | null>(null);
  const [buscaBanco, setBuscaBanco] = useState("");
  const [mostrarSugBanco, setMostrarSugBanco] = useState(false);

  const [planosConta, setPlanosConta] = useState<PlanoContaOpcao[]>([]);
  const [planoContaSelecionado, setPlanoContaSelecionado] = useState<PlanoContaOpcao | null>(null);
  const [buscaPlanoConta, setBuscaPlanoConta] = useState("");
  const [mostrarSugPlanoConta, setMostrarSugPlanoConta] = useState(false);

  const [servicos, setServicos] = useState<Opcao[]>([]);
  const [servicoSelecionado, setServicoSelecionado] = useState<Opcao | null>(null);
  const [buscaServico, setBuscaServico] = useState("");
  const [mostrarSugServico, setMostrarSugServico] = useState(false);

  const [descricao, setDescricao] = useState(lancamentoEditando?.descricao ?? "");
  const [valor, setValor] = useState(lancamentoEditando ? String(lancamentoEditando.valor) : "");
  const [situacao, setSituacao] = useState<"pendente" | "pago">(lancamentoEditando?.situacao ?? "pendente");
  const [dataVencimento, setDataVencimento] = useState(lancamentoEditando?.data_vencimento ?? "");
  const [dataQuitacao, setDataQuitacao] = useState(lancamentoEditando?.data_quitacao ?? "");
  const [dataCompetencia, setDataCompetencia] = useState(lancamentoEditando?.data_competencia ?? "");

  const [repeticao, setRepeticao] = useState<"nenhuma" | "parcelado" | "recorrente">("nenhuma");
  const [totalParcelas, setTotalParcelas] = useState("2");
  const [frequenciaRecorrencia, setFrequenciaRecorrencia] = useState<"mensal" | "semanal" | "anual">("mensal");
  const [quantidadeRecorrencias, setQuantidadeRecorrencias] = useState("12");

  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregarTudo() {
      const supabase = createClient();
      const [{ data: p }, { data: b }, { data: pc }, { data: s }] = await Promise.all([
        supabase.from("pessoas").select("id, nome, tipo_pessoa").order("nome"),
        supabase.from("bancos").select("id, nome").order("nome"),
        supabase.from("planos_conta").select("id, nome, tipo").order("nome"),
        supabase.from("servicos").select("id, nome").order("nome"),
      ]);
      setPessoas(p ?? []);
      setBancos(b ?? []);
      setPlanosConta((pc as PlanoContaOpcao[]) ?? []);
      setServicos(s ?? []);

      if (lancamentoEditando?.banco_id) {
        const banco = b?.find((x) => x.id === lancamentoEditando.banco_id);
        if (banco) {
          setBancoSelecionado(banco);
          setBuscaBanco(banco.nome);
        }
      }
      if (lancamentoEditando?.plano_conta_id) {
        const plano = pc?.find((x) => x.id === lancamentoEditando.plano_conta_id);
        if (plano) {
          setPlanoContaSelecionado(plano as PlanoContaOpcao);
          setBuscaPlanoConta(plano.nome);
        }
      }
      if (lancamentoEditando?.servico_id) {
        const servico = s?.find((x) => x.id === lancamentoEditando.servico_id);
        if (servico) {
          setServicoSelecionado(servico);
          setBuscaServico(servico.nome);
        }
      }
    }
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sugCliente = pessoas.filter((p) => p.nome.toLowerCase().includes(buscaCliente.toLowerCase()));
  const sugBanco = bancos.filter((b) => b.nome.toLowerCase().includes(buscaBanco.toLowerCase()));
  const sugPlanoConta = planosConta
    .filter((p) => p.tipo === tipo)
    .filter((p) => p.nome.toLowerCase().includes(buscaPlanoConta.toLowerCase()));
  const sugServico = servicos.filter((s) => s.nome.toLowerCase().includes(buscaServico.toLowerCase()));

  async function garantirClienteId(pessoaId: string): Promise<string> {
    const supabase = createClient();
    const { data: papelExistente } = await supabase
      .from("papeis")
      .select("id")
      .eq("pessoa_id", pessoaId)
      .eq("papel", "cliente")
      .maybeSingle();

    let papelId = papelExistente?.id as string | undefined;
    if (!papelId) {
      const { data: novoPapel, error } = await supabase
        .from("papeis")
        .insert({ pessoa_id: pessoaId, papel: "cliente" })
        .select("id")
        .single();
      if (error) throw error;
      papelId = novoPapel.id;
    }

    const { data: clienteExistente } = await supabase
      .from("clientes")
      .select("id")
      .eq("papel_id", papelId)
      .maybeSingle();
    if (clienteExistente?.id) return clienteExistente.id;

    const { data: novoCliente, error: clienteError } = await supabase
      .from("clientes")
      .insert({ papel_id: papelId })
      .select("id")
      .single();
    if (clienteError) throw clienteError;
    return novoCliente.id;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro(null);

    try {
      const supabase = createClient();

      let bancoFinalId = bancoSelecionado?.id ?? null;
      if (!bancoFinalId && buscaBanco.trim()) {
        const { data, error } = await supabase.from("bancos").insert({ nome: buscaBanco.trim() }).select("id").single();
        if (error) throw error;
        bancoFinalId = data.id;
      }

      let planoContaFinalId = planoContaSelecionado?.id ?? null;
      if (!planoContaFinalId && buscaPlanoConta.trim() && tipo !== "transferencia") {
        const { data, error } = await supabase
          .from("planos_conta")
          .insert({ nome: buscaPlanoConta.trim(), tipo })
          .select("id")
          .single();
        if (error) throw error;
        planoContaFinalId = data.id;
      }

      let servicoFinalId = servicoSelecionado?.id ?? null;
      if (!servicoFinalId && buscaServico.trim() && tipo === "receita") {
        const { data, error } = await supabase.from("servicos").insert({ nome: buscaServico.trim() }).select("id").single();
        if (error) throw error;
        servicoFinalId = data.id;
      }

      let clienteId: string | null = null;
      if (pessoaSelecionada && tipo === "receita") {
        clienteId = await garantirClienteId(pessoaSelecionada.id);
      }

      const payloadBase = {
        descricao: descricao || null,
        tipo,
        banco_id: bancoFinalId,
        plano_conta_id: tipo === "transferencia" ? null : planoContaFinalId,
        servico_id: tipo === "receita" ? servicoFinalId : null,
        pessoa_id: pessoaSelecionada?.id ?? null,
        ...(clienteId ? { cliente_id: clienteId } : {}),
      };

      if (editando && lancamentoEditando) {
        const payload = {
          ...payloadBase,
          valor: Number(valor),
          situacao,
          data_vencimento: dataVencimento,
          data_quitacao: situacao === "pago" ? dataQuitacao || null : null,
          data_competencia: dataCompetencia || null,
        };
        const { error } = await supabase.from("lancamentos").update(payload).eq("id", lancamentoEditando.id);
        if (error) throw error;
      } else if (repeticao === "parcelado") {
        const n = Number(totalParcelas);
        const grupoId = crypto.randomUUID();
        const linhas = Array.from({ length: n }, (_, i) => {
          const venc = new Date(dataVencimento + "T00:00:00");
          venc.setMonth(venc.getMonth() + i);
          const comp = dataCompetencia ? new Date(dataCompetencia + "T00:00:00") : null;
          if (comp) comp.setMonth(comp.getMonth() + i);
          return {
            ...payloadBase,
            valor: Number(valor),
            situacao: i === 0 ? situacao : "pendente",
            data_vencimento: venc.toISOString().slice(0, 10),
            data_quitacao: i === 0 && situacao === "pago" ? dataQuitacao || null : null,
            data_competencia: comp ? comp.toISOString().slice(0, 10) : null,
            grupo_id: grupoId,
            numero_parcela: i + 1,
            total_parcelas: n,
          };
        });
        const { error } = await supabase.from("lancamentos").insert(linhas);
        if (error) throw error;
      } else if (repeticao === "recorrente") {
        const n = Number(quantidadeRecorrencias);
        const grupoId = crypto.randomUUID();
        const linhas = Array.from({ length: n }, (_, i) => {
          const venc = new Date(dataVencimento + "T00:00:00");
          const comp = dataCompetencia ? new Date(dataCompetencia + "T00:00:00") : null;
          if (frequenciaRecorrencia === "mensal") {
            venc.setMonth(venc.getMonth() + i);
            if (comp) comp.setMonth(comp.getMonth() + i);
          } else if (frequenciaRecorrencia === "semanal") {
            venc.setDate(venc.getDate() + i * 7);
            if (comp) comp.setDate(comp.getDate() + i * 7);
          } else {
            venc.setFullYear(venc.getFullYear() + i);
            if (comp) comp.setFullYear(comp.getFullYear() + i);
          }
          return {
            ...payloadBase,
            valor: Number(valor),
            situacao: i === 0 ? situacao : "pendente",
            data_vencimento: venc.toISOString().slice(0, 10),
            data_quitacao: i === 0 && situacao === "pago" ? dataQuitacao || null : null,
            data_competencia: comp ? comp.toISOString().slice(0, 10) : null,
            grupo_id: grupoId,
            recorrencia_tipo: frequenciaRecorrencia,
          };
        });
        const { error } = await supabase.from("lancamentos").insert(linhas);
        if (error) throw error;
      } else {
        const payload = {
          ...payloadBase,
          valor: Number(valor),
          situacao,
          data_vencimento: dataVencimento,
          data_quitacao: situacao === "pago" ? dataQuitacao || null : null,
          data_competencia: dataCompetencia || null,
        };
        const { error } = await supabase.from("lancamentos").insert(payload);
        if (error) throw error;
      }

      setSaving(false);
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar lançamento.");
      setSaving(false);
    }
  }

  if (cadastrandoCliente) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setCadastrandoCliente(false)}
          className="text-sm font-semibold text-ink/50 hover:text-ink mb-4"
        >
          ← Voltar
        </button>
        <PessoaForm
          nomeInicial={buscaCliente}
          onCancel={() => setCadastrandoCliente(false)}
          onSaved={async (pessoa) => {
            const supabase = createClient();
            const { data } = await supabase.from("pessoas").select("id, nome, tipo_pessoa").order("nome");
            setPessoas(data ?? []);
            setPessoaSelecionada(data?.find((p) => p.id === pessoa.id) ?? { id: pessoa.id, nome: pessoa.nome, tipo_pessoa: "PF" });
            setBuscaCliente(pessoa.nome);
            setCadastrandoCliente(false);
          }}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-1 rounded-full bg-surface p-1 w-fit">
        <button
          type="button"
          onClick={() => setTipo("receita")}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            tipo === "receita" ? "bg-forest text-white" : "text-ink/60"
          }`}
        >
          Receita
        </button>
        <button
          type="button"
          onClick={() => setTipo("despesa")}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            tipo === "despesa" ? "bg-red-600 text-white" : "text-ink/60"
          }`}
        >
          Despesa
        </button>
        <button
          type="button"
          onClick={() => setTipo("transferencia")}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            tipo === "transferencia" ? "bg-ink text-white" : "text-ink/60"
          }`}
        >
          Transferência
        </button>
      </div>

      <div className="relative">
        <Busca
          label="Cliente / Fornecedor (opcional)"
          valor={buscaCliente}
          onChange={(v) => {
            setBuscaCliente(v);
            setPessoaSelecionada(null);
            setMostrarSugCliente(true);
          }}
          onFocus={() => setMostrarSugCliente(true)}
          placeholder="Digite o nome..."
        />
        {mostrarSugCliente && buscaCliente && !pessoaSelecionada && (
          <ListaSugestoes>
            {sugCliente.length > 0 ? (
              sugCliente.map((p) => (
                <ItemSugestao
                  key={p.id}
                  onClick={() => {
                    setPessoaSelecionada(p);
                    setBuscaCliente(p.nome);
                    setMostrarSugCliente(false);
                  }}
                >
                  {p.nome}
                </ItemSugestao>
              ))
            ) : (
              <ItemSugestao destaque onClick={() => setCadastrandoCliente(true)}>
                + Cadastrar &ldquo;{buscaCliente}&rdquo; como nova pessoa
              </ItemSugestao>
            )}
          </ListaSugestoes>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Descrição">
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input" placeholder="Ex: Mensalidade julho" />
        </Campo>
        <Campo label="Valor (R$)" required>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="input"
            placeholder="0,00"
          />
        </Campo>
        <Campo label="Data de vencimento" required>
          <input type="date" required value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="input" />
        </Campo>
        <Campo label="Data de competência">
          <input type="date" value={dataCompetencia} onChange={(e) => setDataCompetencia(e.target.value)} className="input" />
        </Campo>
        <div>
          <span className="block text-sm font-medium text-ink/70 mb-1">Situação</span>
          <div className="flex items-center gap-1 rounded-full bg-surface p-1 w-fit">
            <button
              type="button"
              onClick={() => setSituacao("pendente")}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                situacao === "pendente" ? "bg-ink text-white" : "text-ink/60"
              }`}
            >
              Pendente
            </button>
            <button
              type="button"
              onClick={() => setSituacao("pago")}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                situacao === "pago" ? "bg-forest text-white" : "text-ink/60"
              }`}
            >
              Pago
            </button>
          </div>
        </div>
        {situacao === "pago" && (
          <Campo label="Data de quitação" required>
            <input type="date" required value={dataQuitacao} onChange={(e) => setDataQuitacao(e.target.value)} className="input" />
          </Campo>
        )}
      </div>

      {!editando && (
        <div className="rounded-2xl bg-surface p-3">
          <span className="block text-sm font-medium text-ink/70 mb-2">Repetição</span>
          <div className="flex items-center gap-1 rounded-full bg-white p-1 w-fit mb-3">
            <button
              type="button"
              onClick={() => setRepeticao("nenhuma")}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                repeticao === "nenhuma" ? "bg-ink text-white" : "text-ink/60"
              }`}
            >
              Nenhuma
            </button>
            <button
              type="button"
              onClick={() => setRepeticao("parcelado")}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                repeticao === "parcelado" ? "bg-ink text-white" : "text-ink/60"
              }`}
            >
              Parcelado
            </button>
            <button
              type="button"
              onClick={() => setRepeticao("recorrente")}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                repeticao === "recorrente" ? "bg-ink text-white" : "text-ink/60"
              }`}
            >
              Recorrente
            </button>
          </div>

          {repeticao === "parcelado" && (
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Número de parcelas" required>
                <input
                  type="number"
                  min="2"
                  required
                  value={totalParcelas}
                  onChange={(e) => setTotalParcelas(e.target.value)}
                  className="input"
                />
              </Campo>
              <p className="text-xs text-ink/40 self-end pb-2">
                Gera {totalParcelas || "—"} lançamentos mensais de {formatarMoeda(Number(valor) || 0)} cada,
                a partir da data de vencimento.
              </p>
            </div>
          )}

          {repeticao === "recorrente" && (
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Frequência" required>
                <select
                  value={frequenciaRecorrencia}
                  onChange={(e) => setFrequenciaRecorrencia(e.target.value as "mensal" | "semanal" | "anual")}
                  className="input"
                >
                  <option value="mensal">Mensal</option>
                  <option value="semanal">Semanal</option>
                  <option value="anual">Anual</option>
                </select>
              </Campo>
              <Campo label="Quantidade de repetições" required>
                <input
                  type="number"
                  min="2"
                  required
                  value={quantidadeRecorrencias}
                  onChange={(e) => setQuantidadeRecorrencias(e.target.value)}
                  className="input"
                />
              </Campo>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <Busca
          label="Banco"
          valor={buscaBanco}
          onChange={(v) => {
            setBuscaBanco(v);
            setBancoSelecionado(null);
            setMostrarSugBanco(true);
          }}
          onFocus={() => setMostrarSugBanco(true)}
          placeholder="Digite o banco..."
        />
        {mostrarSugBanco && buscaBanco && !bancoSelecionado && (
          <ListaSugestoes>
            {sugBanco.length > 0 ? (
              sugBanco.map((b) => (
                <ItemSugestao
                  key={b.id}
                  onClick={() => {
                    setBancoSelecionado(b);
                    setBuscaBanco(b.nome);
                    setMostrarSugBanco(false);
                  }}
                >
                  {b.nome}
                </ItemSugestao>
              ))
            ) : (
              <ItemSugestao destaque onClick={() => setMostrarSugBanco(false)}>
                + Cadastrar &ldquo;{buscaBanco}&rdquo; como novo banco
              </ItemSugestao>
            )}
          </ListaSugestoes>
        )}
      </div>

      {tipo !== "transferencia" && (
        <div className="relative">
          <Busca
            label="Plano de conta"
            valor={buscaPlanoConta}
            onChange={(v) => {
              setBuscaPlanoConta(v);
              setPlanoContaSelecionado(null);
              setMostrarSugPlanoConta(true);
            }}
            onFocus={() => setMostrarSugPlanoConta(true)}
            placeholder="Digite o plano de conta..."
          />
          {mostrarSugPlanoConta && buscaPlanoConta && !planoContaSelecionado && (
            <ListaSugestoes>
              {sugPlanoConta.length > 0 ? (
                sugPlanoConta.map((p) => (
                  <ItemSugestao
                    key={p.id}
                    onClick={() => {
                      setPlanoContaSelecionado(p);
                      setBuscaPlanoConta(p.nome);
                      setMostrarSugPlanoConta(false);
                    }}
                  >
                    {p.nome}
                  </ItemSugestao>
                ))
              ) : (
                <ItemSugestao destaque onClick={() => setMostrarSugPlanoConta(false)}>
                  + Cadastrar &ldquo;{buscaPlanoConta}&rdquo; como novo plano de {tipo}
                </ItemSugestao>
              )}
            </ListaSugestoes>
          )}
        </div>
      )}

      {tipo === "receita" && (
        <div className="relative">
          <Busca
            label="Serviço"
            valor={buscaServico}
            onChange={(v) => {
              setBuscaServico(v);
              setServicoSelecionado(null);
              setMostrarSugServico(true);
            }}
            onFocus={() => setMostrarSugServico(true)}
            placeholder="Digite o serviço..."
          />
          {mostrarSugServico && buscaServico && !servicoSelecionado && (
            <ListaSugestoes>
              {sugServico.length > 0 ? (
                sugServico.map((s) => (
                  <ItemSugestao
                    key={s.id}
                    onClick={() => {
                      setServicoSelecionado(s);
                      setBuscaServico(s.nome);
                      setMostrarSugServico(false);
                    }}
                  >
                    {s.nome}
                  </ItemSugestao>
                ))
              ) : (
                <ItemSugestao destaque onClick={() => setMostrarSugServico(false)}>
                  + Cadastrar &ldquo;{buscaServico}&rdquo; como novo serviço
                </ItemSugestao>
              )}
            </ListaSugestoes>
          )}
        </div>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
        >
          {saving ? "Salvando..." : editando ? "Salvar alterações" : "Salvar lançamento"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-ink/60 hover:text-ink">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Busca({
  label,
  valor,
  onChange,
  onFocus,
  placeholder,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink/70 mb-1">{label}</span>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        className="input"
        placeholder={placeholder}
      />
    </label>
  );
}

function ListaSugestoes({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute z-10 mt-1 w-full rounded-xl bg-white border border-black/10 shadow-lg max-h-56 overflow-auto">
      {children}
    </div>
  );
}

function ItemSugestao({
  children,
  onClick,
  destaque,
}: {
  children: React.ReactNode;
  onClick: () => void;
  destaque?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-surface ${
        destaque ? "font-semibold text-forest" : ""
      }`}
    >
      {children}
    </button>
  );
}

function CampoEscuro({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-white/70 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Campo({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink/70 mb-1">
        {label}
        {required && <span className="text-forest"> *</span>}
      </span>
      {children}
    </label>
  );
}
