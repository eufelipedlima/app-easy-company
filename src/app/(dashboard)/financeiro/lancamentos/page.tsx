"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";
import { PessoaForm } from "@/components/pessoa-form";
import { LancamentoForm, nomePessoaLancamento, type Lancamento, type Opcao } from "@/components/lancamento-form";




interface Pagamento {
  id: string;
  data_pagamento: string;
  banco_id: string | null;
  valor: number;
  taxa: number | null;
  desconto: number | null;
  bancos: { nome: string } | null;
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
  | "ontem"
  | "amanha"
  | "esta_semana"
  | "proxima_semana"
  | "ultimos_7"
  | "ultimos_14"
  | "este_mes"
  | "mes_passado"
  | "proximo_mes"
  | "personalizado";

const PERIODO_LABEL: Record<PeriodoPreset, string> = {
  mes_passado: "Mês passado",
  ultimos_14: "Últimos 14 dias",
  ultimos_7: "Últimos 7 dias",
  ontem: "Ontem",
  hoje: "Hoje",
  amanha: "Amanhã",
  esta_semana: "Essa semana",
  este_mes: "Este mês",
  proxima_semana: "Próxima semana",
  proximo_mes: "Próximo mês",
  personalizado: "Personalizado",
};

const PERIODO_ORDEM: PeriodoPreset[] = [
  "mes_passado",
  "ultimos_14",
  "ultimos_7",
  "ontem",
  "hoje",
  "amanha",
  "esta_semana",
  "este_mes",
  "proxima_semana",
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
    case "ontem": {
      const ontem = new Date(hoje);
      ontem.setDate(hoje.getDate() - 1);
      return { inicio: toISODate(ontem), fim: toISODate(ontem) };
    }
    case "amanha": {
      const amanha = new Date(hoje);
      amanha.setDate(hoje.getDate() + 1);
      return { inicio: toISODate(amanha), fim: toISODate(amanha) };
    }
    case "esta_semana": {
      const fim = new Date(inicioSemana);
      fim.setDate(inicioSemana.getDate() + 6);
      return { inicio: toISODate(inicioSemana), fim: toISODate(fim) };
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


function pixLancamento(l: { clientes: Lancamento["clientes"]; pessoas: Lancamento["pessoas"] }) {
  return l.clientes?.papeis?.pessoas?.pix ?? l.pessoas?.pix ?? null;
}

function renderCelulaLancamento(key: string, l: Lancamento, valorPago: number, valorRestante: number) {
  switch (key) {
    case "cliente":
      return <span className="font-semibold text-ink">{nomePessoaLancamento(l) ?? "—"}</span>;
    case "descricao":
      return (
        <span className="text-ink/70">
          {l.descricao ?? "—"}
          {l.total_parcelas && (
            <span className="ml-1.5 text-xs text-ink/40 font-mono">
              {l.numero_parcela}/{l.total_parcelas}
            </span>
          )}
          {l.recorrencia_tipo && <span className="ml-1.5 text-xs text-ink/40">🔁</span>}
        </span>
      );
    case "valor":
      return (
        <span
          className={`font-semibold ${
            l.tipo === "receita" ? "text-forest" : l.tipo === "despesa" ? "text-red-600" : "text-ink/70"
          }`}
        >
          {l.tipo === "despesa" ? "- " : ""}
          {formatarMoeda(l.valor)}
        </span>
      );
    case "valor_pago":
      return <span className="text-ink/70">{formatarMoeda(valorPago)}</span>;
    case "valor_restante":
      return (
        <span className={valorRestante > 0 ? "font-semibold text-red-600" : "text-ink/40"}>
          {formatarMoeda(valorRestante)}
        </span>
      );
    case "tipo":
      return (
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
      );
    case "vencimento":
      return <span className="text-ink/70">{formatarData(l.data_vencimento)}</span>;
    case "quitacao":
      return <span className="text-ink/70">{formatarData(l.data_quitacao)}</span>;
    case "banco":
      return <span className="text-ink/70">{l.bancos?.nome ?? "—"}</span>;
    case "plano_conta":
      return <span className="text-ink/70">{l.planos_conta?.nome ?? "—"}</span>;
    case "situacao":
      return (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            l.situacao === "pago" ? "bg-mint text-forest" : "bg-black/5 text-ink/50"
          }`}
        >
          {l.situacao === "pago" ? "Pago" : "Pendente"}
        </span>
      );
    case "codigo":
      return <span className="text-ink/50 font-mono text-xs">{l.codigo_transacao ?? "—"}</span>;
    default:
      return null;
  }
}

type Filtro = "todos" | "pendente" | "pago";

interface ColunaDef {
  key: string;
  label: string;
}

const COLUNAS_DISPONIVEIS: ColunaDef[] = [
  { key: "cliente", label: "Cliente" },
  { key: "descricao", label: "Descrição" },
  { key: "valor", label: "Valor" },
  { key: "valor_pago", label: "Valor pago" },
  { key: "valor_restante", label: "Valor restante" },
  { key: "tipo", label: "Tipo" },
  { key: "vencimento", label: "Vencimento" },
  { key: "quitacao", label: "Quitação" },
  { key: "banco", label: "Banco" },
  { key: "plano_conta", label: "Plano de conta" },
  { key: "situacao", label: "Situação" },
  { key: "codigo", label: "Código" },
];

const COLUNAS_PADRAO = COLUNAS_DISPONIVEIS.map((c) => ({ key: c.key, visivel: true }));

const LINHAS_POR_PAGINA_OPCOES = [10, 25, 50, 100];

export default function LancamentosPage() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [pagamentosPorLancamento, setPagamentosPorLancamento] = useState<Record<string, number>>({});

  const [colunas, setColunas] = useState<{ key: string; visivel: boolean }[]>(COLUNAS_PADRAO);
  const [painelColunasAberto, setPainelColunasAberto] = useState(false);
  const [linhasPorPagina, setLinhasPorPagina] = useState(10);
  const [paginaAtual, setPaginaAtual] = useState(1);

  useEffect(() => {
    const salvo = window.localStorage.getItem("lancamentos_colunas");
    if (salvo) {
      try {
        setColunas(JSON.parse(salvo));
      } catch {
        // ignora e mantém padrão
      }
    }
    const salvoLinhas = window.localStorage.getItem("lancamentos_linhas_por_pagina");
    if (salvoLinhas) setLinhasPorPagina(Number(salvoLinhas));
  }, []);

  function atualizarColunas(novas: { key: string; visivel: boolean }[]) {
    setColunas(novas);
    window.localStorage.setItem("lancamentos_colunas", JSON.stringify(novas));
  }

  function alternarVisibilidade(key: string) {
    atualizarColunas(colunas.map((c) => (c.key === key ? { ...c, visivel: !c.visivel } : c)));
  }

  function moverColuna(key: string, direcao: -1 | 1) {
    const indice = colunas.findIndex((c) => c.key === key);
    const novoIndice = indice + direcao;
    if (novoIndice < 0 || novoIndice >= colunas.length) return;
    const novas = [...colunas];
    [novas[indice], novas[novoIndice]] = [novas[novoIndice], novas[indice]];
    atualizarColunas(novas);
  }

  function mudarLinhasPorPagina(n: number) {
    setLinhasPorPagina(n);
    setPaginaAtual(1);
    window.localStorage.setItem("lancamentos_linhas_por_pagina", String(n));
  }
  const [loading, setLoading] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [escopoEdicao, setEscopoEdicao] = useState<"unico" | "grupo">("unico");
  const [perguntaEscopo, setPerguntaEscopo] = useState<{ acao: "editar" | "excluir"; lancamento: Lancamento } | null>(
    null
  );
  const [detalhe, setDetalhe] = useState<Lancamento | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [bancosOpcoesPagamento, setBancosOpcoesPagamento] = useState<Opcao[]>([]);
  const [painelPagamentoAberto, setPainelPagamentoAberto] = useState(false);
  const [dataPagamentoNovo, setDataPagamentoNovo] = useState("");
  const [bancoPagamentoNovo, setBancoPagamentoNovo] = useState("");
  const [valorPagamentoNovo, setValorPagamentoNovo] = useState("");
  const [taxaPagamentoNovo, setTaxaPagamentoNovo] = useState("");
  const [descontoPagamentoNovo, setDescontoPagamentoNovo] = useState("");
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);

  useEffect(() => {
    if (!detalhe) {
      setPagamentos([]);
      return;
    }
    async function carregarPagamentos() {
      const supabase = createClient();
      const [{ data: p }, { data: b }] = await Promise.all([
        supabase
          .from("lancamento_pagamentos")
          .select("id, data_pagamento, banco_id, valor, taxa, desconto, bancos ( nome )")
          .eq("lancamento_id", detalhe!.id)
          .order("data_pagamento", { ascending: false }),
        supabase.from("bancos").select("id, nome").eq("ativo", true).order("nome"),
      ]);
      setPagamentos((p as unknown as Pagamento[]) ?? []);
      setBancosOpcoesPagamento(b ?? []);
    }
    carregarPagamentos();
  }, [detalhe]);

  const valorPagoTotal = pagamentos.reduce((s, p) => s + p.valor, 0);

  async function registrarPagamento(e: React.FormEvent) {
    e.preventDefault();
    if (!detalhe || !dataPagamentoNovo || !valorPagamentoNovo) return;
    setSalvandoPagamento(true);
    const supabase = createClient();

    await supabase.from("lancamento_pagamentos").insert({
      lancamento_id: detalhe.id,
      data_pagamento: dataPagamentoNovo,
      banco_id: bancoPagamentoNovo || null,
      valor: Number(valorPagamentoNovo),
      taxa: taxaPagamentoNovo ? Number(taxaPagamentoNovo) : null,
      desconto: descontoPagamentoNovo ? Number(descontoPagamentoNovo) : null,
    });

    const novoTotalPago = valorPagoTotal + Number(valorPagamentoNovo);
    if (novoTotalPago >= detalhe.valor) {
      await supabase
        .from("lancamentos")
        .update({ situacao: "pago", data_quitacao: dataPagamentoNovo })
        .eq("id", detalhe.id);
    }

    setDataPagamentoNovo("");
    setBancoPagamentoNovo("");
    setValorPagamentoNovo("");
    setTaxaPagamentoNovo("");
    setDescontoPagamentoNovo("");
    setPainelPagamentoAberto(false);
    setSalvandoPagamento(false);

    const { data: p } = await supabase
      .from("lancamento_pagamentos")
      .select("id, data_pagamento, banco_id, valor, taxa, desconto, bancos ( nome )")
      .eq("lancamento_id", detalhe.id)
      .order("data_pagamento", { ascending: false });
    setPagamentos((p as unknown as Pagamento[]) ?? []);
    carregar();
  }

  async function removerPagamento(id: string) {
    if (!detalhe) return;
    if (!window.confirm("Excluir este registro de pagamento?")) return;
    const supabase = createClient();
    await supabase.from("lancamento_pagamentos").delete().eq("id", id);
    const { data: p } = await supabase
      .from("lancamento_pagamentos")
      .select("id, data_pagamento, banco_id, valor, taxa, desconto, bancos ( nome )")
      .eq("lancamento_id", detalhe.id)
      .order("data_pagamento", { ascending: false });
    setPagamentos((p as unknown as Pagamento[]) ?? []);
  }
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

  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErroCarregamento(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("lancamentos")
      .select(
        `id, descricao, valor, tipo, situacao, data_vencimento, data_quitacao, data_competencia, codigo_transacao,
         banco_id, banco_destino_id, plano_conta_id, servico_id, numero_parcela, total_parcelas, recorrencia_tipo, grupo_id,
         clientes ( papeis ( pessoas ( nome, pix ) ) ),
         pessoas ( nome, pix ),
         bancos:banco_id ( nome ),
         bancos_destino:banco_destino_id ( nome ),
         planos_conta ( nome ),
         servicos ( nome )`
      )
      .order("data_vencimento", { ascending: true });
    if (error) {
      console.error("Erro ao carregar lançamentos:", error);
      setErroCarregamento(error.message);
    }
    setLancamentos((data as unknown as Lancamento[]) ?? []);

    const { data: pagamentos } = await supabase.from("lancamento_pagamentos").select("lancamento_id, valor");
    const somaPorLancamento: Record<string, number> = {};
    (pagamentos ?? []).forEach((p) => {
      somaPorLancamento[p.lancamento_id] = (somaPorLancamento[p.lancamento_id] ?? 0) + p.valor;
    });
    setPagamentosPorLancamento(somaPorLancamento);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
    async function carregarOpcoes() {
      const supabase = createClient();
      const [{ data: b }, { data: p }] = await Promise.all([
        supabase.from("bancos").select("id, nome").eq("ativo", true).order("nome"),
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

  async function removerGrupo(l: Lancamento) {
    const supabase = createClient();
    await supabase
      .from("lancamentos")
      .delete()
      .eq("grupo_id", l.grupo_id)
      .eq("situacao", "pendente")
      .gte("data_vencimento", l.data_vencimento);
    carregar();
  }

  function clicarEditar(l: Lancamento) {
    if (l.grupo_id) {
      setPerguntaEscopo({ acao: "editar", lancamento: l });
    } else {
      setEscopoEdicao("unico");
      setEditando(l);
      setPainelAberto(false);
    }
  }

  function clicarExcluir(l: Lancamento) {
    if (l.grupo_id) {
      setPerguntaEscopo({ acao: "excluir", lancamento: l });
    } else {
      remover(l.id);
    }
  }

  function confirmarEscopo(escolha: "unico" | "grupo") {
    if (!perguntaEscopo) return;
    const { acao, lancamento } = perguntaEscopo;
    setPerguntaEscopo(null);

    if (acao === "excluir") {
      if (escolha === "unico") {
        remover(lancamento.id);
      } else {
        if (!window.confirm("Excluir este e todos os lançamentos pendentes futuros dessa série?")) return;
        removerGrupo(lancamento);
      }
    } else {
      setEscopoEdicao(escolha);
      setEditando(lancamento);
      setPainelAberto(false);
    }
  }

  const filtrados = lancamentosDoPeriodo
    .filter((l) => filtro === "todos" || l.situacao === filtro)
    .filter((l) => !filtroTipo || l.tipo === filtroTipo)
    .filter(
      (l) =>
        !filtroCliente ||
        normalizar(nomePessoaLancamento(l) ?? "").includes(normalizar(filtroCliente))
    )
    .filter((l) => !filtroDescricao || normalizar(l.descricao ?? "").includes(normalizar(filtroDescricao)))
    .filter((l) => !filtroPlanoContaId || l.plano_conta_id === filtroPlanoContaId)
    .filter((l) => !filtroBancoId || l.banco_id === filtroBancoId)
    .filter((l) => !filtroValor || l.valor.toFixed(2).includes(filtroValor.replace(",", ".")));

  function valorPagoDe(l: Lancamento) {
    if (l.situacao === "pago") return l.valor;
    return pagamentosPorLancamento[l.id] ?? 0;
  }

  function valorRestanteDe(l: Lancamento) {
    return Math.max(l.valor - valorPagoDe(l), 0);
  }

  const totalPaginas = Math.max(Math.ceil(filtrados.length / linhasPorPagina), 1);
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const paginados = filtrados.slice((paginaSegura - 1) * linhasPorPagina, paginaSegura * linhasPorPagina);

  useEffect(() => {
    setPaginaAtual(1);
  }, [filtro, presetPeriodo, periodoPersonalizado.inicio, periodoPersonalizado.fim, filtroTipo, filtroCliente, filtroDescricao, filtroPlanoContaId, filtroBancoId, filtroValor]);

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
            onClick={() => {
              setEscopoEdicao("unico");
              setPainelAberto(true);
            }}
            className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
          >
            + Novo lançamento
          </button>
        )}
      </div>

      {erroCarregamento && (
        <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">
          <p className="font-semibold">Erro ao carregar os lançamentos:</p>
          <p className="font-mono text-xs mt-1">{erroCarregamento}</p>
        </div>
      )}

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

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setResumoAberto((v) => !v)}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-forest to-ink text-white px-4 py-2.5 text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            📊 Resumo {resumoAberto ? "▲" : "▼"}
          </button>

          <div className="relative">
            <button
              onClick={() => setPainelColunasAberto((v) => !v)}
              className="rounded-full border-2 border-ink/15 text-ink px-4 py-2.5 text-sm font-bold hover:bg-surface transition-colors"
            >
              ⚙ Colunas
            </button>
            {painelColunasAberto && (
              <div
                className="absolute right-0 z-10 mt-2 w-64 rounded-2xl bg-white border border-black/10 shadow-lg p-2"
                onMouseLeave={() => setPainelColunasAberto(false)}
              >
                {colunas.map((c, i) => {
                  const def = COLUNAS_DISPONIVEIS.find((d) => d.key === c.key);
                  if (!def) return null;
                  return (
                    <div key={c.key} className="flex items-center justify-between px-2 py-1.5 text-sm hover:bg-surface rounded-lg">
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={c.visivel}
                          onChange={() => alternarVisibilidade(c.key)}
                          className="h-3.5 w-3.5 rounded accent-forest"
                        />
                        <span className={c.visivel ? "text-ink" : "text-ink/40"}>{def.label}</span>
                      </label>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => moverColuna(c.key, -1)}
                          disabled={i === 0}
                          className="text-ink/40 hover:text-ink disabled:opacity-20 px-1"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moverColuna(c.key, 1)}
                          disabled={i === colunas.length - 1}
                          className="text-ink/40 hover:text-ink disabled:opacity-20 px-1"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  );
                })}
                <label className="flex items-center justify-between gap-2 px-2 py-2 mt-1 border-t border-black/5 text-sm">
                  <span className="text-ink/70">Linhas por página</span>
                  <select
                    value={linhasPorPagina}
                    onChange={(e) => mudarLinhasPorPagina(Number(e.target.value))}
                    className="input py-1 text-xs w-20"
                  >
                    {LINHAS_POR_PAGINA_OPCOES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

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
            <h2 className="text-lg font-bold text-ink mb-1">
              {editando ? "Editar lançamento" : "Novo lançamento"}
            </h2>
            {editando?.grupo_id && (
              <p className="text-xs text-ink/40 mb-4">
                {escopoEdicao === "grupo"
                  ? "Alterando este e os próximos lançamentos pendentes da série."
                  : "Alterando apenas este lançamento."}
              </p>
            )}
            {!editando?.grupo_id && <div className="mb-5" />}
            <LancamentoForm
              lancamentoEditando={editando}
              escopoEdicao={escopoEdicao}
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

      {perguntaEscopo && (
        <div
          className="fixed inset-0 z-30 bg-ink/50 flex items-center justify-center p-6"
          onClick={() => setPerguntaEscopo(null)}
        >
          <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-ink mb-2">
              {perguntaEscopo.acao === "editar" ? "Editar lançamento" : "Excluir lançamento"}
            </h3>
            <p className="text-sm text-ink/60 mb-5">
              Esse lançamento faz parte de um parcelamento ou recorrência. O que você quer fazer?
            </p>
            <div className="space-y-2">
              <button
                onClick={() => confirmarEscopo("unico")}
                className="w-full rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
              >
                Apenas este
              </button>
              <button
                onClick={() => confirmarEscopo("grupo")}
                className="w-full rounded-full border-2 border-ink/20 text-ink px-5 py-2.5 text-sm font-semibold hover:bg-surface transition-colors"
              >
                Este e os próximos
              </button>
              <button
                onClick={() => setPerguntaEscopo(null)}
                className="w-full text-sm font-semibold text-ink/50 hover:text-ink py-2"
              >
                Cancelar
              </button>
            </div>
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
                {colunas
                  .filter((c) => c.visivel)
                  .map((c) => (
                    <th key={c.key} className="px-4 py-3 font-medium">
                      {COLUNAS_DISPONIVEIS.find((d) => d.key === c.key)?.label}
                    </th>
                  ))}
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {paginados.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setDetalhe(l)}
                  className="border-b border-black/5 last:border-0 hover:bg-surface/60 cursor-pointer"
                >
                  {colunas
                    .filter((c) => c.visivel)
                    .map((c) => (
                      <td key={c.key} className="px-4 py-3">
                        {renderCelulaLancamento(c.key, l, valorPagoDe(l), valorRestanteDe(l))}
                      </td>
                    ))}
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => clicarEditar(l)}
                        className="rounded-full px-3 py-1.5 text-xs font-bold bg-forest text-white hover:bg-ink transition-colors shadow-sm"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => clicarExcluir(l)}
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

      {filtrados.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-ink/50">
          <div className="flex items-center gap-4">
            <p>
              Mostrando {(paginaSegura - 1) * linhasPorPagina + 1}–
              {Math.min(paginaSegura * linhasPorPagina, filtrados.length)} de {filtrados.length}
            </p>
            <label className="flex items-center gap-2 text-xs">
              Linhas
              <select
                value={linhasPorPagina}
                onChange={(e) => mudarLinhasPorPagina(Number(e.target.value))}
                className="input py-1 text-xs w-16"
              >
                {LINHAS_POR_PAGINA_OPCOES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPaginaAtual((p) => Math.max(p - 1, 1))}
              disabled={paginaSegura === 1}
              className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-surface disabled:opacity-30"
            >
              ← Anterior
            </button>
            <span className="px-2 text-xs">
              Página {paginaSegura} de {totalPaginas}
            </span>
            <button
              onClick={() => setPaginaAtual((p) => Math.min(p + 1, totalPaginas))}
              disabled={paginaSegura === totalPaginas}
              className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-surface disabled:opacity-30"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}

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

            {detalhe.tipo === "despesa" && pixLancamento(detalhe) && (
              <div className="rounded-2xl bg-card p-4 mb-4 shadow-sm flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-ink/50 mb-0.5">Chave PIX</p>
                  <p className="text-sm font-semibold text-ink truncate">{pixLancamento(detalhe)}</p>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(pixLancamento(detalhe) ?? "")}
                  className="shrink-0 rounded-full bg-forest text-white px-3 py-1.5 text-xs font-bold hover:bg-ink transition-colors"
                >
                  Copiar
                </button>
              </div>
            )}

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

            {detalhe.tipo !== "transferencia" && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink/40">Pagamentos</p>
                  {!painelPagamentoAberto && (
                    <button
                      onClick={() => {
                        setDataPagamentoNovo(new Date().toISOString().slice(0, 10));
                        setValorPagamentoNovo(String(Math.max(detalhe.valor - valorPagoTotal, 0)));
                        setPainelPagamentoAberto(true);
                      }}
                      className="text-xs font-bold text-forest hover:text-ink"
                    >
                      + Registrar pagamento
                    </button>
                  )}
                </div>

                <div className="rounded-2xl bg-card p-4 shadow-sm space-y-3">
                  <div className="grid grid-cols-2 gap-3 pb-2 border-b border-black/5">
                    <div>
                      <p className="text-xs text-ink/40">Valor pago</p>
                      <p className="text-sm font-bold text-forest">{formatarMoeda(valorPagoTotal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink/40">Valor restante</p>
                      <p className={`text-sm font-bold ${detalhe.valor - valorPagoTotal > 0 ? "text-red-600" : "text-ink/40"}`}>
                        {formatarMoeda(Math.max(detalhe.valor - valorPagoTotal, 0))}
                      </p>
                    </div>
                  </div>

                  {pagamentos.length === 0 ? (
                    <p className="text-sm text-ink/40">Nenhum pagamento registrado ainda.</p>
                  ) : (
                    pagamentos.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-sm border-b border-black/5 last:border-0 pb-2 last:pb-0">
                        <div>
                          <p className="text-ink">{formatarData(p.data_pagamento)} · {p.bancos?.nome ?? "—"}</p>
                          {(p.taxa || p.desconto) && (
                            <p className="text-xs text-ink/40">
                              {p.taxa ? `Taxa: ${formatarMoeda(p.taxa)}` : ""}
                              {p.taxa && p.desconto ? " · " : ""}
                              {p.desconto ? `Desconto: ${formatarMoeda(p.desconto)}` : ""}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink">{formatarMoeda(p.valor)}</span>
                          <button onClick={() => removerPagamento(p.id)} className="text-xs text-ink/30 hover:text-red-600">
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  {painelPagamentoAberto && (
                    <form onSubmit={registrarPagamento} className="space-y-2 pt-2 border-t border-black/5">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          required
                          value={dataPagamentoNovo}
                          onChange={(e) => setDataPagamentoNovo(e.target.value)}
                          className="input text-sm"
                        />
                        <select
                          value={bancoPagamentoNovo}
                          onChange={(e) => setBancoPagamentoNovo(e.target.value)}
                          className="input text-sm"
                        >
                          <option value="">Banco...</option>
                          {bancosOpcoesPagamento.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.nome}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder="Valor pago"
                          value={valorPagamentoNovo}
                          onChange={(e) => setValorPagamentoNovo(e.target.value)}
                          className="input text-sm"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Taxa (opcional)"
                          value={taxaPagamentoNovo}
                          onChange={(e) => setTaxaPagamentoNovo(e.target.value)}
                          className="input text-sm"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Desconto (opcional)"
                          value={descontoPagamentoNovo}
                          onChange={(e) => setDescontoPagamentoNovo(e.target.value)}
                          className="input text-sm col-span-2"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="submit"
                          disabled={salvandoPagamento}
                          className="rounded-full bg-forest text-white px-4 py-1.5 text-xs font-bold hover:bg-ink transition-colors disabled:opacity-50"
                        >
                          {salvandoPagamento ? "Salvando..." : "Salvar pagamento"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPainelPagamentoAberto(false)}
                          className="text-xs font-semibold text-ink/50 hover:text-ink"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}

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
                setDetalhe(null);
                clicarExcluir(detalhe);
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



function CampoEscuro({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-white/70 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

