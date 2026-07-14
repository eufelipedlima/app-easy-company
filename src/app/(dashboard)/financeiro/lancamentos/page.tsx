"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PessoaForm } from "@/components/pessoa-form";

interface Lancamento {
  id: string;
  descricao: string | null;
  valor: number;
  tipo: "receita" | "despesa";
  situacao: "pendente" | "pago";
  data_vencimento: string;
  data_quitacao: string | null;
  codigo_transacao: string | null;
  banco_id: string | null;
  plano_conta_id: string | null;
  clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
  bancos: { nome: string } | null;
  planos_conta: { nome: string } | null;
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

type Filtro = "todos" | "pendente" | "pago";

export default function LancamentosPage() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [detalhe, setDetalhe] = useState<Lancamento | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");

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
  const [filtroTipo, setFiltroTipo] = useState<"" | "receita" | "despesa">("");

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
        `id, descricao, valor, tipo, situacao, data_vencimento, data_quitacao, codigo_transacao,
         banco_id, plano_conta_id,
         clientes ( papeis ( pessoas ( nome ) ) ),
         bancos ( nome ),
         planos_conta ( nome )`
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
  const filtrados = lancamentosDoPeriodo
    .filter((l) => filtro === "todos" || l.situacao === filtro)
    .filter((l) => !filtroTipo || l.tipo === filtroTipo)
    .filter(
      (l) =>
        !filtroCliente ||
        (l.clientes?.papeis?.pessoas?.nome ?? "").toLowerCase().includes(filtroCliente.toLowerCase())
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
            className="input w-auto"
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
                className="input w-auto"
              />
              <span className="text-ink/40 text-sm">até</span>
              <input
                type="date"
                value={periodoPersonalizado.fim}
                onChange={(e) => setPeriodoPersonalizado((p) => ({ ...p, fim: e.target.value }))}
                className="input w-auto"
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
                onChange={(e) => setFiltroTipo(e.target.value as "" | "receita" | "despesa")}
                className="input-escuro"
              >
                <option value="">Todos</option>
                <option value="receita">Receitas</option>
                <option value="despesa">Despesas</option>
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

      {(painelAberto || editando) && (
        <div className="mb-8 rounded-3xl bg-card border border-black/5 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-ink mb-6">
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
                    {l.clientes?.papeis?.pessoas?.nome ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-ink/70">{l.descricao ?? "—"}</td>
                  <td className={`px-4 py-3 font-semibold ${l.tipo === "receita" ? "text-forest" : "text-red-600"}`}>
                    {l.tipo === "despesa" ? "- " : ""}
                    {formatarMoeda(l.valor)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        l.tipo === "receita" ? "bg-mint text-forest" : "bg-red-50 text-red-600"
                      }`}
                    >
                      {l.tipo === "receita" ? "Receita" : "Despesa"}
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
                    <button
                      onClick={() => {
                        setEditando(l);
                        setPainelAberto(false);
                      }}
                      className="rounded-full px-3 py-1.5 text-xs font-bold bg-forest text-white hover:bg-ink transition-colors shadow-sm"
                    >
                      Editar
                    </button>
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
                  {detalhe.clientes?.papeis?.pessoas?.nome ?? detalhe.descricao ?? "Lançamento"}
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
              <p className={`text-xl font-extrabold ${detalhe.tipo === "receita" ? "text-forest" : "text-red-600"}`}>
                {detalhe.tipo === "despesa" ? "- " : ""}
                {formatarMoeda(detalhe.valor)}
              </p>
              <p className="text-xs text-ink/40 mt-3 pt-3 border-t border-black/5">
                {detalhe.tipo === "receita" ? "Receita" : "Despesa"}
              </p>
            </div>

            <SecaoDetalhe titulo="Datas">
              <DetalheLinha label="Vencimento" valor={formatarData(detalhe.data_vencimento)} />
              <DetalheLinha label="Quitação" valor={formatarData(detalhe.data_quitacao)} />
            </SecaoDetalhe>

            <SecaoDetalhe titulo="Classificação">
              <DetalheLinha label="Banco" valor={detalhe.bancos?.nome ?? "—"} />
              <DetalheLinha label="Plano de conta" valor={detalhe.planos_conta?.nome ?? "—"} />
              <DetalheLinha label="Descrição" valor={detalhe.descricao ?? "—"} />
            </SecaoDetalhe>
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

  const [tipo, setTipo] = useState<"receita" | "despesa">(lancamentoEditando?.tipo ?? "receita");
  const [pessoas, setPessoas] = useState<PessoaOpcao[]>([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<PessoaOpcao | null>(null);
  const [buscaCliente, setBuscaCliente] = useState(
    lancamentoEditando?.clientes?.papeis?.pessoas?.nome ?? ""
  );
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [cadastrandoCliente, setCadastrandoCliente] = useState(false);

  const [bancos, setBancos] = useState<Opcao[]>([]);
  const [bancoId, setBancoId] = useState(lancamentoEditando?.banco_id ?? "");
  const [novoBanco, setNovoBanco] = useState(false);
  const [nomeNovoBanco, setNomeNovoBanco] = useState("");

  const [planosConta, setPlanosConta] = useState<PlanoContaOpcao[]>([]);
  const [planoContaId, setPlanoContaId] = useState(lancamentoEditando?.plano_conta_id ?? "");
  const [novoPlanoConta, setNovoPlanoConta] = useState(false);
  const [nomeNovoPlanoConta, setNomeNovoPlanoConta] = useState("");

  const [descricao, setDescricao] = useState(lancamentoEditando?.descricao ?? "");
  const [valor, setValor] = useState(lancamentoEditando ? String(lancamentoEditando.valor) : "");
  const [situacao, setSituacao] = useState<"pendente" | "pago">(lancamentoEditando?.situacao ?? "pendente");
  const [dataVencimento, setDataVencimento] = useState(lancamentoEditando?.data_vencimento ?? "");
  const [dataQuitacao, setDataQuitacao] = useState(lancamentoEditando?.data_quitacao ?? "");
  const [codigoTransacao, setCodigoTransacao] = useState(lancamentoEditando?.codigo_transacao ?? "");

  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregarPessoas();
    carregarBancos();
    carregarPlanosConta();
  }, []);

  async function carregarPessoas() {
    const supabase = createClient();
    const { data } = await supabase.from("pessoas").select("id, nome, tipo_pessoa").order("nome");
    setPessoas(data ?? []);
  }

  async function carregarBancos() {
    const supabase = createClient();
    const { data } = await supabase.from("bancos").select("id, nome").order("nome");
    setBancos(data ?? []);
  }

  async function carregarPlanosConta() {
    const supabase = createClient();
    const { data } = await supabase.from("planos_conta").select("id, nome, tipo").order("nome");
    setPlanosConta((data as PlanoContaOpcao[]) ?? []);
  }

  const sugestoes = pessoas.filter((p) => p.nome.toLowerCase().includes(buscaCliente.toLowerCase()));

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

      let bancoFinalId = bancoId || null;
      if (novoBanco && nomeNovoBanco.trim()) {
        const { data, error } = await supabase.from("bancos").insert({ nome: nomeNovoBanco.trim() }).select("id").single();
        if (error) throw error;
        bancoFinalId = data.id;
      }

      let planoContaFinalId = planoContaId || null;
      if (novoPlanoConta && nomeNovoPlanoConta.trim()) {
        const { data, error } = await supabase
          .from("planos_conta")
          .insert({ nome: nomeNovoPlanoConta.trim(), tipo })
          .select("id")
          .single();
        if (error) throw error;
        planoContaFinalId = data.id;
      }

      let clienteId: string | null = null;
      if (pessoaSelecionada) {
        clienteId = await garantirClienteId(pessoaSelecionada.id);
      }

      const payload = {
        descricao: descricao || null,
        valor: Number(valor),
        tipo,
        situacao,
        data_vencimento: dataVencimento,
        data_quitacao: situacao === "pago" ? dataQuitacao || null : null,
        banco_id: bancoFinalId,
        plano_conta_id: planoContaFinalId,
        codigo_transacao: codigoTransacao || null,
        ...(clienteId ? { cliente_id: clienteId } : {}),
      };

      if (editando && lancamentoEditando) {
        const { error } = await supabase.from("lancamentos").update(payload).eq("id", lancamentoEditando.id);
        if (error) throw error;
      } else {
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
          ← Voltar para o lançamento
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-2xl bg-surface p-4">
        <p className="text-sm font-bold text-ink flex items-center gap-2 mb-3">
          <span className="text-forest">🔀</span> Tipo
        </p>
        <div className="flex items-center gap-2 rounded-full bg-white p-1 w-fit">
          <button
            type="button"
            onClick={() => setTipo("receita")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              tipo === "receita" ? "bg-forest text-white" : "text-ink/60"
            }`}
          >
            Receita
          </button>
          <button
            type="button"
            onClick={() => setTipo("despesa")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              tipo === "despesa" ? "bg-red-600 text-white" : "text-ink/60"
            }`}
          >
            Despesa
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-surface p-4">
        <p className="text-sm font-bold text-ink flex items-center gap-2 mb-3">
          <span className="text-forest">👤</span> Cliente <span className="text-xs font-normal text-ink/40">(opcional)</span>
        </p>
        <div className="relative">
          <input
            value={buscaCliente}
            onChange={(e) => {
              setBuscaCliente(e.target.value);
              setPessoaSelecionada(null);
              setMostrarSugestoes(true);
            }}
            onFocus={() => setMostrarSugestoes(true)}
            className="input"
            placeholder="Digite o nome do cliente..."
          />
          {mostrarSugestoes && buscaCliente && !pessoaSelecionada && (
            <div className="absolute z-10 mt-1 w-full rounded-xl bg-white border border-black/10 shadow-lg max-h-56 overflow-auto">
              {sugestoes.length > 0 ? (
                sugestoes.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPessoaSelecionada(p);
                      setBuscaCliente(p.nome);
                      setMostrarSugestoes(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface"
                  >
                    {p.nome} <span className="text-xs text-ink/40">({p.tipo_pessoa})</span>
                  </button>
                ))
              ) : (
                <button
                  type="button"
                  onClick={() => setCadastrandoCliente(true)}
                  className="w-full text-left px-4 py-2.5 text-sm font-semibold text-forest hover:bg-surface"
                >
                  + Cadastrar &ldquo;{buscaCliente}&rdquo; como novo cliente
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-surface p-4">
        <p className="text-sm font-bold text-ink flex items-center gap-2 mb-3">
          <span className="text-forest">💰</span> Valores e datas
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <input
              type="date"
              required
              value={dataVencimento}
              onChange={(e) => setDataVencimento(e.target.value)}
              className="input"
            />
          </Campo>
          <Campo label="Situação" required>
            <select value={situacao} onChange={(e) => setSituacao(e.target.value as "pendente" | "pago")} className="input">
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
            </select>
          </Campo>
          {situacao === "pago" && (
            <Campo label="Data de quitação" required>
              <input
                type="date"
                required
                value={dataQuitacao}
                onChange={(e) => setDataQuitacao(e.target.value)}
                className="input"
              />
            </Campo>
          )}
          <Campo label="Código da transação">
            <input
              value={codigoTransacao}
              onChange={(e) => setCodigoTransacao(e.target.value)}
              className="input"
              placeholder="Opcional"
            />
          </Campo>
        </div>
      </div>

      <div className="rounded-2xl bg-surface p-4">
        <p className="text-sm font-bold text-ink flex items-center gap-2 mb-3">
          <span className="text-forest">🏷️</span> Classificação
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Banco">
            {!novoBanco ? (
              <div className="flex gap-2">
                <select value={bancoId} onChange={(e) => setBancoId(e.target.value)} className="input">
                  <option value="">Selecione...</option>
                  {bancos.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nome}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => setNovoBanco(true)} className="shrink-0 text-xs font-semibold text-forest whitespace-nowrap">
                  + Novo
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={nomeNovoBanco}
                  onChange={(e) => setNomeNovoBanco(e.target.value)}
                  className="input"
                  placeholder="Nome do banco"
                />
                <button
                  type="button"
                  onClick={() => {
                    setNovoBanco(false);
                    setNomeNovoBanco("");
                  }}
                  className="shrink-0 text-xs font-semibold text-ink/50 whitespace-nowrap"
                >
                  Cancelar
                </button>
              </div>
            )}
          </Campo>

          <Campo label="Plano de conta">
            {!novoPlanoConta ? (
              <div className="flex gap-2">
                <select value={planoContaId} onChange={(e) => setPlanoContaId(e.target.value)} className="input">
                  <option value="">Selecione...</option>
                  {planosConta
                    .filter((p) => p.tipo === tipo)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => setNovoPlanoConta(true)}
                  className="shrink-0 text-xs font-semibold text-forest whitespace-nowrap"
                >
                  + Novo
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={nomeNovoPlanoConta}
                  onChange={(e) => setNomeNovoPlanoConta(e.target.value)}
                  className="input"
                  placeholder={`Nova conta de ${tipo}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setNovoPlanoConta(false);
                    setNomeNovoPlanoConta("");
                  }}
                  className="shrink-0 text-xs font-semibold text-ink/50 whitespace-nowrap"
                >
                  Cancelar
                </button>
              </div>
            )}
            <span className="block text-xs text-ink/40 mt-1">
              Mostrando apenas contas de {tipo === "receita" ? "receita" : "despesa"}.
            </span>
          </Campo>
        </div>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex items-center gap-3 pt-2">
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
