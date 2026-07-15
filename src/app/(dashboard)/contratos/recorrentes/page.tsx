"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PessoaForm } from "@/components/pessoa-form";

interface Contrato {
  id: string;
  numero_contrato: string | null;
  status: "ativo" | "encerrado";
  forma_pagamento: string | null;
  valor_mensal: number | null;
  valor_entrada: number | null;
  data_pagamento_entrada: string | null;
  data_primeira_mensalidade: string | null;
  data_encerramento: string | null;
  tempo_inicial_meses: number | null;
  servico_id: string | null;
  banco_id: string | null;
  plano_conta_id: string | null;
  descricao: string | null;
  comentarios_extras: string | null;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  ultima_verificacao_parcelas: string | null;
  eh_migracao: boolean;
  valor_pago_historico: number | null;
  data_proxima_cobranca: string | null;
  clientes: {
    papeis: {
      pessoas: {
        nome: string;
        razao_social: string | null;
        documento: string;
        email: string | null;
      } | null;
    } | null;
  } | null;
  servicos: { nome: string } | null;
  bancos: { nome: string } | null;
  planos_conta: { nome: string } | null;
}

interface PessoaOpcao {
  id: string;
  nome: string;
  tipo_pessoa: "PF" | "PJ";
}

interface Servico {
  id: string;
  nome: string;
}

interface Opcao {
  id: string;
  nome: string;
}

interface PlanoConta extends Opcao {
  tipo: "receita" | "despesa";
}

const FORMAS_PAGAMENTO = ["Pix", "Cartão de crédito"];
const OPCOES_TEMPO_INICIAL = [3, 6, 9, 12];

function formatarMoeda(valor: number | null) {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string | null) {
  if (!data) return "—";
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
}

function mesesDeCasa(inicio: string | null, fim: string | null) {
  if (!inicio) return 0;
  const d1 = new Date(inicio + "T00:00:00");
  const d2 = fim ? new Date(fim + "T00:00:00") : new Date();
  let meses = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  if (d2.getDate() < d1.getDate()) meses -= 1;
  return Math.max(meses, 0);
}

type Filtro = "todos" | "ativo" | "encerrado";

export default function ContratosRecorrentesPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);
  const [editando, setEditando] = useState<Contrato | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("ativo");
  const [detalhe, setDetalhe] = useState<Contrato | null>(null);
  const [totalPagoReal, setTotalPagoReal] = useState<number | null>(null);

  useEffect(() => {
    if (!detalhe) {
      setTotalPagoReal(null);
      return;
    }
    async function carregarTotalPago() {
      const supabase = createClient();
      const { data } = await supabase
        .from("lancamentos")
        .select("valor")
        .eq("contrato_id", detalhe!.id)
        .eq("situacao", "pago");
      const somaPago = (data ?? []).reduce((s, l) => s + l.valor, 0);
      setTotalPagoReal((detalhe!.valor_pago_historico ?? 0) + somaPago);
    }
    carregarTotalPago();
  }, [detalhe]);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("contratos")
      .select(
        `id, numero_contrato, status, forma_pagamento, valor_mensal, valor_entrada, data_pagamento_entrada, data_primeira_mensalidade,
         data_encerramento, tempo_inicial_meses, servico_id, banco_id, plano_conta_id, descricao, comentarios_extras,
         arquivo_path, arquivo_nome, ultima_verificacao_parcelas, eh_migracao, valor_pago_historico, data_proxima_cobranca,
         clientes ( papeis ( pessoas ( nome, razao_social, documento, email ) ) ),
         servicos ( nome ),
         bancos ( nome ),
         planos_conta ( nome )`
      )
      .eq("tipo_contrato", "recorrente")
      .order("created_at", { ascending: false });
    const lista = (data as unknown as Contrato[]) ?? [];
    setContratos(lista);
    setLoading(false);
    garantirParcelasFuturas(lista);
  }, []);

  // Mantém sempre pelo menos 3 meses de mensalidade gerados à frente pra cada contrato
  // ativo; quando cai abaixo disso, completa de novo até 12 meses à frente. Só verifica
  // uma vez por mês por contrato (guarda a data da última verificação no próprio
  // contrato), pra não fazer essa checagem toda vez que a tela é aberta.
  async function garantirParcelasFuturas(lista: Contrato[]) {
    const supabase = createClient();
    const hoje = new Date();
    const limiteMinimo = new Date(hoje);
    limiteMinimo.setMonth(limiteMinimo.getMonth() + 3);
    const alvoFinal = new Date(hoje);
    alvoFinal.setMonth(alvoFinal.getMonth() + 12);

    const trintaDiasAtras = new Date(hoje);
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    for (const c of lista.filter((c) => c.status === "ativo")) {
      if (c.ultima_verificacao_parcelas && new Date(c.ultima_verificacao_parcelas) > trintaDiasAtras) {
        continue; // já verificado nos últimos 30 dias
      }

      const { data: ultimos } = await supabase
        .from("lancamentos")
        .select("data_vencimento, grupo_id, cliente_id, pessoa_id, descricao")
        .eq("contrato_id", c.id)
        .eq("recorrencia_tipo", "mensal")
        .order("data_vencimento", { ascending: false })
        .limit(1);

      const ultimo = ultimos?.[0];
      if (!ultimo) continue; // contrato sem lançamentos gerados ainda (ex: criado antes dessa função existir)

      const maxData = new Date(ultimo.data_vencimento + "T00:00:00");
      if (maxData < limiteMinimo) {
        const linhas: Record<string, unknown>[] = [];
        const cursor = new Date(maxData);
        while (cursor < alvoFinal) {
          cursor.setMonth(cursor.getMonth() + 1);
          linhas.push({
            contrato_id: c.id,
            cliente_id: ultimo.cliente_id,
            pessoa_id: ultimo.pessoa_id,
            tipo: "receita",
            situacao: "pendente",
            descricao: ultimo.descricao,
            valor: c.valor_mensal,
            data_vencimento: cursor.toISOString().slice(0, 10),
            servico_id: c.servico_id,
            banco_id: c.banco_id,
            plano_conta_id: c.plano_conta_id,
            grupo_id: ultimo.grupo_id,
            recorrencia_tipo: "mensal",
          });
        }
        if (linhas.length > 0) {
          await supabase.from("lancamentos").insert(linhas);
        }
      }

      await supabase
        .from("contratos")
        .update({ ultima_verificacao_parcelas: hoje.toISOString() })
        .eq("id", c.id);
    }
  }

  useEffect(() => {
    carregar();
  }, [carregar]);

  const contratosFiltrados = contratos.filter((c) => filtro === "todos" || c.status === filtro);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1.5 shadow-inner">
          {(["ativo", "encerrado", "todos"] as Filtro[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${
                filtro === f
                  ? "bg-ink text-white shadow-md scale-105"
                  : "text-ink/50 hover:text-ink hover:bg-white/60"
              }`}
            >
              {f === "ativo" ? "Ativos" : f === "encerrado" ? "Encerrados" : "Todos"}
            </button>
          ))}
        </div>
        {!painelAberto && !editando && (
          <button
            onClick={() => setPainelAberto(true)}
            className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
          >
            + Novo contrato recorrente
          </button>
        )}
      </div>

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
              {editando ? "Editar contrato" : "Cadastrar contrato recorrente"}
            </h2>
            <ContratoRecorrenteForm
              contratoEditando={editando}
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

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-ink/50">Carregando...</p>
        ) : contratosFiltrados.length === 0 ? (
          <p className="p-6 text-sm text-ink/50">Nenhum contrato encontrado.</p>
        ) : (
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-16" />
              <col className="w-48" />
              <col className="w-40" />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr className="text-left text-ink/50 border-b border-black/5">
                <th className="px-3 py-3 font-medium">Nº</th>
                <th className="px-3 py-3 font-medium">Cliente</th>
                <th className="px-3 py-3 font-medium">Serviço</th>
                <th className="px-3 py-3 font-medium">Início</th>
                <th className="px-3 py-3 font-medium">Valor</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {contratosFiltrados.map((c) => {
                return (
                  <tr
                    key={c.id}
                    onClick={() => setDetalhe(c)}
                    className="border-b border-black/5 last:border-0 hover:bg-surface/60 cursor-pointer"
                  >
                    <td className="px-3 py-3 text-ink/50 font-mono text-xs truncate">
                      {c.numero_contrato ?? "—"}
                    </td>
                    <td className="px-3 py-3 font-semibold text-ink truncate">
                      {c.clientes?.papeis?.pessoas?.nome ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-ink/70 truncate">{c.servicos?.nome ?? "—"}</td>
                    <td className="px-3 py-3 text-ink/70">{formatarData(c.data_primeira_mensalidade)}</td>
                    <td className="px-3 py-3 text-ink/70">{formatarMoeda(c.valor_mensal)}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          c.status === "ativo" ? "bg-mint text-forest" : "bg-black/5 text-ink/50"
                        }`}
                      >
                        {c.status === "ativo" ? "Ativo" : "Encerrado"}
                      </span>
                    </td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setEditando(c);
                          setPainelAberto(false);
                        }}
                        title="Editar contrato"
                        className="rounded-full px-3 py-1.5 text-xs font-bold bg-forest text-white hover:bg-ink transition-colors shadow-sm"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
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
            {(() => {
              const meses = mesesDeCasa(detalhe.data_primeira_mensalidade, detalhe.data_encerramento);
              const ltv = meses * (detalhe.valor_mensal ?? 0);
              const dataRenovacao = detalhe.data_primeira_mensalidade
                ? (() => {
                    const d = new Date(detalhe.data_primeira_mensalidade + "T00:00:00");
                    d.setMonth(d.getMonth() + (detalhe.tempo_inicial_meses ?? 3));
                    return d.toLocaleDateString("pt-BR");
                  })()
                : "—";
              const pessoa = detalhe.clientes?.papeis?.pessoas;

              return (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-2xl bg-mint flex items-center justify-center text-forest font-bold text-sm">
                        {(pessoa?.nome ?? "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-mono text-xs text-ink/50">{detalhe.numero_contrato ?? "—"}</p>
                        <p className="font-bold text-ink leading-tight">{pessoa?.nome ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          detalhe.status === "ativo" ? "bg-mint text-forest" : "bg-black/5 text-ink/50"
                        }`}
                      >
                        {detalhe.status === "ativo" ? "Ativo" : "Encerrado"}
                      </span>
                      <button onClick={() => setDetalhe(null)} className="text-ink/40 hover:text-ink text-lg leading-none">
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-card p-4 mb-4 shadow-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-ink/50 mb-0.5">Valor mensal</p>
                        <p className="text-xl font-extrabold text-forest">{formatarMoeda(detalhe.valor_mensal)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink/50 mb-0.5">LTV atual (estimado)</p>
                        <p className="text-xl font-extrabold text-ink">{formatarMoeda(ltv)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink/50 mb-0.5">Total pago (real)</p>
                        <p className="text-lg font-bold text-forest">
                          {totalPagoReal != null ? formatarMoeda(totalPagoReal) : "…"}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-ink/40 mt-3 pt-3 border-t border-black/5">
                      Recorrente · {meses} {meses === 1 ? "mês" : "meses"} de casa
                      {detalhe.eh_migracao && " · cliente migrado"}
                    </p>
                  </div>

                  <SecaoDetalhe titulo="Cliente">
                    <DetalheLinha label={pessoa?.razao_social ? "Razão social" : "Nome"} valor={pessoa?.nome ?? "—"} />
                    <DetalheLinha label="Documento" valor={pessoa?.documento ?? "—"} />
                    <DetalheLinha label="E-mail" valor={pessoa?.email ?? "—"} />
                  </SecaoDetalhe>

                  <SecaoDetalhe titulo="Período">
                    {detalhe.valor_entrada != null && (
                      <DetalheLinha label="Entrada" valor={formatarMoeda(detalhe.valor_entrada)} />
                    )}
                    {detalhe.data_pagamento_entrada && (
                      <DetalheLinha label="Pagamento da entrada" valor={formatarData(detalhe.data_pagamento_entrada)} />
                    )}
                    <DetalheLinha label="Início" valor={formatarData(detalhe.data_primeira_mensalidade)} />
                    <DetalheLinha label="Compromisso mínimo" valor={`${detalhe.tempo_inicial_meses ?? "—"} meses`} />
                    <DetalheLinha label="Renovação automática" valor={dataRenovacao} />
                    {detalhe.status === "encerrado" && (
                      <DetalheLinha label="Encerramento" valor={formatarData(detalhe.data_encerramento)} />
                    )}
                  </SecaoDetalhe>

                  <SecaoDetalhe titulo="Pagamento">
                    <DetalheLinha label="Serviço" valor={detalhe.servicos?.nome ?? "—"} />
                    <DetalheLinha label="Forma de pagamento" valor={detalhe.forma_pagamento ?? "—"} />
                  </SecaoDetalhe>

                  {(detalhe.descricao || detalhe.comentarios_extras) && (
                    <SecaoDetalhe titulo="Observações">
                      {detalhe.descricao && (
                        <div>
                          <p className="text-xs text-ink/50 mb-1">Contratado pelo cliente</p>
                          <p className="text-sm text-ink whitespace-pre-wrap">{detalhe.descricao}</p>
                        </div>
                      )}
                      {detalhe.comentarios_extras && (
                        <div>
                          <p className="text-xs text-ink/50 mb-1">Comentários extras</p>
                          <p className="text-sm text-ink whitespace-pre-wrap">{detalhe.comentarios_extras}</p>
                        </div>
                      )}
                    </SecaoDetalhe>
                  )}

                  {detalhe.arquivo_path && (
                    <SecaoDetalhe titulo="Arquivo">
                      <button
                        onClick={async () => {
                          const supabase = createClient();
                          const { data } = await supabase.storage
                            .from("contratos")
                            .createSignedUrl(detalhe.arquivo_path!, 60);
                          if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                        }}
                        className="text-sm font-semibold text-forest hover:underline"
                      >
                        📄 {detalhe.arquivo_nome ?? "Ver arquivo do contrato"}
                      </button>
                    </SecaoDetalhe>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
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

function ContratoRecorrenteForm({
  contratoEditando,
  onSaved,
  onCancel,
}: {
  contratoEditando: Contrato | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const editando = !!contratoEditando;

  const [pessoas, setPessoas] = useState<PessoaOpcao[]>([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<PessoaOpcao | null>(null);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [cadastrandoCliente, setCadastrandoCliente] = useState(false);

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [servicoSelecionado, setServicoSelecionado] = useState<Servico | null>(
    contratoEditando?.servico_id && contratoEditando.servicos
      ? { id: contratoEditando.servico_id, nome: contratoEditando.servicos.nome }
      : null
  );
  const [buscaServico, setBuscaServico] = useState(contratoEditando?.servicos?.nome ?? "");
  const [mostrarSugestoesServico, setMostrarSugestoesServico] = useState(false);

  const [bancos, setBancos] = useState<Opcao[]>([]);
  const [bancoSelecionado, setBancoSelecionado] = useState<Opcao | null>(
    contratoEditando?.banco_id && contratoEditando.bancos
      ? { id: contratoEditando.banco_id, nome: contratoEditando.bancos.nome }
      : null
  );
  const [buscaBanco, setBuscaBanco] = useState(contratoEditando?.bancos?.nome ?? "");
  const [mostrarSugestoesBanco, setMostrarSugestoesBanco] = useState(false);

  const [planosConta, setPlanosConta] = useState<PlanoConta[]>([]);
  const [planoContaSelecionado, setPlanoContaSelecionado] = useState<PlanoConta | null>(
    contratoEditando?.plano_conta_id && contratoEditando.planos_conta
      ? { id: contratoEditando.plano_conta_id, nome: contratoEditando.planos_conta.nome, tipo: "receita" }
      : null
  );
  const [buscaPlanoConta, setBuscaPlanoConta] = useState(contratoEditando?.planos_conta?.nome ?? "");
  const [mostrarSugestoesPlanoConta, setMostrarSugestoesPlanoConta] = useState(false);

  const [numeroContrato, setNumeroContrato] = useState(contratoEditando?.numero_contrato ?? "");
  const [formaPagamento, setFormaPagamento] = useState(
    contratoEditando?.forma_pagamento ?? FORMAS_PAGAMENTO[0]
  );
  const [valorMensal, setValorMensal] = useState(
    contratoEditando?.valor_mensal != null ? String(contratoEditando.valor_mensal) : ""
  );
  const [valorEntrada, setValorEntrada] = useState(
    contratoEditando?.valor_entrada != null ? String(contratoEditando.valor_entrada) : ""
  );
  const [dataPagamentoEntrada, setDataPagamentoEntrada] = useState(
    contratoEditando?.data_pagamento_entrada ?? ""
  );
  const [dataPrimeiraMensalidade, setDataPrimeiraMensalidade] = useState(
    contratoEditando?.data_primeira_mensalidade ?? ""
  );
  const [tempoInicial, setTempoInicial] = useState(contratoEditando?.tempo_inicial_meses ?? 3);
  const [status, setStatus] = useState<"ativo" | "encerrado">(contratoEditando?.status ?? "ativo");
  const [dataEncerramento, setDataEncerramento] = useState(contratoEditando?.data_encerramento ?? "");

  const [ehMigracao, setEhMigracao] = useState(contratoEditando?.eh_migracao ?? false);
  const [valorPagoHistorico, setValorPagoHistorico] = useState(
    contratoEditando?.valor_pago_historico != null ? String(contratoEditando.valor_pago_historico) : ""
  );
  const [dataProximaCobranca, setDataProximaCobranca] = useState(
    contratoEditando?.data_proxima_cobranca ?? ""
  );

  const [descricao, setDescricao] = useState(contratoEditando?.descricao ?? "");
  const [comentariosExtras, setComentariosExtras] = useState(contratoEditando?.comentarios_extras ?? "");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arrastandoArquivo, setArrastandoArquivo] = useState(false);
  const [maisOpcoesAberto, setMaisOpcoesAberto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregarPessoas();
    carregarServicos();
    carregarBancos();
    carregarPlanosConta();
    if (editando) {
      setBuscaCliente(contratoEditando?.clientes?.papeis?.pessoas?.nome ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarPessoas() {
    const supabase = createClient();
    const { data } = await supabase.from("pessoas").select("id, nome, tipo_pessoa").order("nome");
    setPessoas(data ?? []);
  }

  async function carregarServicos() {
    const supabase = createClient();
    const { data } = await supabase.from("servicos").select("id, nome").order("nome");
    setServicos(data ?? []);
  }

  async function carregarBancos() {
    const supabase = createClient();
    const { data } = await supabase.from("bancos").select("id, nome").eq("ativo", true).order("nome");
    setBancos(data ?? []);
  }

  async function carregarPlanosConta() {
    const supabase = createClient();
    const { data } = await supabase.from("planos_conta").select("id, nome, tipo").order("nome");
    setPlanosConta((data as PlanoConta[]) ?? []);
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

  async function enviarArquivo(contratoId: string, arquivo: File) {
    const supabase = createClient();
    const path = `${contratoId}/${arquivo.name}`;
    const { error: uploadError } = await supabase.storage
      .from("contratos")
      .upload(path, arquivo, { upsert: true });
    if (uploadError) throw uploadError;

    await supabase
      .from("contratos")
      .update({ arquivo_path: path, arquivo_nome: arquivo.name })
      .eq("id", contratoId);
  }

  function handleArquivoSelecionado(file: File | undefined | null) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setErro("Apenas arquivos PDF são aceitos.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErro("O arquivo deve ter no máximo 10MB.");
      return;
    }
    setErro(null);
    setArquivo(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editando && !pessoaSelecionada) {
      setErro("Selecione um cliente.");
      return;
    }
    if (!editando && ehMigracao && !dataProximaCobranca) {
      setErro("Informe a data da próxima cobrança.");
      return;
    }
    setSaving(true);
    setErro(null);

    try {
      const supabase = createClient();

      let servicoFinalId = servicoSelecionado?.id ?? null;
      if (!servicoFinalId && buscaServico.trim()) {
        const { data: srv, error: srvError } = await supabase
          .from("servicos")
          .insert({ nome: buscaServico.trim() })
          .select("id")
          .single();
        if (srvError) throw srvError;
        servicoFinalId = srv.id;
      }

      let bancoFinalId = bancoSelecionado?.id ?? null;
      if (!bancoFinalId && buscaBanco.trim()) {
        const { data: bco, error: bcoError } = await supabase
          .from("bancos")
          .insert({ nome: buscaBanco.trim() })
          .select("id")
          .single();
        if (bcoError) throw bcoError;
        bancoFinalId = bco.id;
      }

      let planoContaFinalId = planoContaSelecionado?.id ?? null;
      if (!planoContaFinalId && buscaPlanoConta.trim()) {
        const { data: pc, error: pcError } = await supabase
          .from("planos_conta")
          .insert({ nome: buscaPlanoConta.trim(), tipo: "receita" })
          .select("id")
          .single();
        if (pcError) throw pcError;
        planoContaFinalId = pc.id;
      }

      const nomeServicoParaDescricao = buscaServico.trim();

      if (editando && contratoEditando) {
        const { error } = await supabase
          .from("contratos")
          .update({
            forma_pagamento: formaPagamento,
            servico_id: servicoFinalId,
            valor_mensal: Number(valorMensal),
            valor_entrada: valorEntrada ? Number(valorEntrada) : null,
            data_pagamento_entrada: dataPagamentoEntrada || null,
            data_primeira_mensalidade: dataPrimeiraMensalidade,
            tempo_inicial_meses: tempoInicial,
            numero_contrato: numeroContrato.trim() || null,
            banco_id: bancoFinalId,
            plano_conta_id: planoContaFinalId,
            status,
            data_encerramento: status === "encerrado" ? dataEncerramento || null : null,
            descricao: descricao || null,
            comentarios_extras: comentariosExtras || null,
            eh_migracao: ehMigracao,
            valor_pago_historico: ehMigracao && valorPagoHistorico ? Number(valorPagoHistorico) : null,
            data_proxima_cobranca: ehMigracao ? dataProximaCobranca || null : null,
          })
          .eq("id", contratoEditando.id);
        if (error) throw error;

        if (arquivo) {
          await enviarArquivo(contratoEditando.id, arquivo);
        }

        // Ao encerrar, remove as parcelas futuras ainda pendentes (mantém o que já foi pago)
        if (status === "encerrado" && dataEncerramento) {
          await supabase
            .from("lancamentos")
            .delete()
            .eq("contrato_id", contratoEditando.id)
            .eq("situacao", "pendente")
            .gte("data_vencimento", dataEncerramento);
        }
      } else {
        const clienteId = await garantirClienteId(pessoaSelecionada!.id);
        const { data: novoContrato, error } = await supabase
          .from("contratos")
          .insert({
            cliente_id: clienteId,
            tipo_contrato: "recorrente",
            forma_pagamento: formaPagamento,
            servico_id: servicoFinalId,
            valor_mensal: Number(valorMensal),
            valor_entrada: valorEntrada ? Number(valorEntrada) : null,
            data_pagamento_entrada: dataPagamentoEntrada || null,
            data_primeira_mensalidade: dataPrimeiraMensalidade,
            tempo_inicial_meses: tempoInicial,
            descricao: descricao || null,
            comentarios_extras: comentariosExtras || null,
            banco_id: bancoFinalId,
            plano_conta_id: planoContaFinalId,
            eh_migracao: ehMigracao,
            valor_pago_historico: ehMigracao && valorPagoHistorico ? Number(valorPagoHistorico) : null,
            data_proxima_cobranca: ehMigracao ? dataProximaCobranca || null : null,
            ...(numeroContrato.trim() ? { numero_contrato: numeroContrato.trim() } : {}),
          })
          .select("id")
          .single();
        if (error) throw error;

        if (arquivo && novoContrato) {
          await enviarArquivo(novoContrato.id, arquivo);
        }

        // Gera os lançamentos automaticamente. Em contratos normais: entrada (se houver) +
        // 12 meses de mensalidade a partir da data da primeira mensalidade. Em contratos
        // de migração (cliente já existente antes do sistema): sem entrada, e a partir da
        // "data da próxima cobrança" em vez da data histórica de início.
        if (novoContrato) {
          const linhas: Record<string, unknown>[] = [];
          const nomeCliente = pessoaSelecionada!.nome;
          const descricaoPadrao = nomeServicoParaDescricao
            ? `${nomeCliente} — ${nomeServicoParaDescricao}`
            : nomeCliente;

          if (!ehMigracao && valorEntrada && Number(valorEntrada) > 0) {
            linhas.push({
              contrato_id: novoContrato.id,
              cliente_id: clienteId,
              pessoa_id: pessoaSelecionada!.id,
              tipo: "receita",
              situacao: "pendente",
              descricao: `${descricaoPadrao} (entrada)`,
              valor: Number(valorEntrada),
              data_vencimento: dataPagamentoEntrada || dataPrimeiraMensalidade,
              servico_id: servicoFinalId,
              banco_id: bancoFinalId,
              plano_conta_id: planoContaFinalId,
            });
          }

          const dataAncora = ehMigracao ? dataProximaCobranca : dataPrimeiraMensalidade;
          const grupoId = crypto.randomUUID();
          const MESES_GERADOS = 12;
          for (let i = 0; i < MESES_GERADOS; i++) {
            const venc = new Date(dataAncora + "T00:00:00");
            venc.setMonth(venc.getMonth() + i);
            linhas.push({
              contrato_id: novoContrato.id,
              cliente_id: clienteId,
              pessoa_id: pessoaSelecionada!.id,
              tipo: "receita",
              situacao: "pendente",
              descricao: `${descricaoPadrao} 🔁`,
              valor: Number(valorMensal),
              data_vencimento: venc.toISOString().slice(0, 10),
              servico_id: servicoFinalId,
              grupo_id: grupoId,
              recorrencia_tipo: "mensal",
              banco_id: bancoFinalId,
              plano_conta_id: planoContaFinalId,
            });
          }

          const { error: lancError } = await supabase.from("lancamentos").insert(linhas);
          if (lancError) throw lancError;
        }
      }

      setSaving(false);
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar contrato.");
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
          ← Voltar para o contrato
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
      <div className="relative">
        <span className="block text-sm font-medium text-ink/70 mb-1">
          Cliente<span className="text-forest"> *</span>
        </span>
        <input
          disabled={editando}
          value={buscaCliente}
          onChange={(e) => {
            setBuscaCliente(e.target.value);
            setPessoaSelecionada(null);
            setMostrarSugestoes(true);
          }}
          onFocus={() => !editando && setMostrarSugestoes(true)}
          className="input disabled:opacity-60"
          placeholder="Digite o nome do cliente..."
        />
        {!editando && mostrarSugestoes && buscaCliente && !pessoaSelecionada && (
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

      {!editando && (
        <div className="rounded-2xl bg-surface p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={ehMigracao}
              onChange={(e) => setEhMigracao(e.target.checked)}
              className="h-4 w-4 rounded accent-forest"
            />
            Contrato já existente (cliente antigo, migração pro sistema)
          </label>

          {ehMigracao && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Campo label="Data da próxima cobrança" required>
                <input
                  type="date"
                  required
                  value={dataProximaCobranca}
                  onChange={(e) => setDataProximaCobranca(e.target.value)}
                  className="input"
                />
                <span className="block text-xs text-ink/40 mt-1">
                  As mensalidades serão lançadas a partir daqui, não da data de início real.
                </span>
              </Campo>
              <Campo label="Valor já pago antes de entrar no sistema (R$)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorPagoHistorico}
                  onChange={(e) => setValorPagoHistorico(e.target.value)}
                  className="input"
                  placeholder="Opcional"
                />
                <span className="block text-xs text-ink/40 mt-1">
                  Só pra cálculo de LTV/total pago — não gera lançamento nenhum.
                </span>
              </Campo>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <span className="block text-sm font-medium text-ink/70 mb-1">Serviço</span>
          <input
            value={buscaServico}
            onChange={(e) => {
              setBuscaServico(e.target.value);
              setServicoSelecionado(null);
              setMostrarSugestoesServico(true);
            }}
            onFocus={() => setMostrarSugestoesServico(true)}
            className="input"
            placeholder="Digite o serviço..."
          />
          {mostrarSugestoesServico && buscaServico && !servicoSelecionado && (
            <div className="absolute z-10 mt-1 w-full rounded-xl bg-white border border-black/10 shadow-lg max-h-56 overflow-auto">
              {servicos.filter((s) => s.nome.toLowerCase().includes(buscaServico.toLowerCase())).length > 0 ? (
                servicos
                  .filter((s) => s.nome.toLowerCase().includes(buscaServico.toLowerCase()))
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setServicoSelecionado(s);
                        setBuscaServico(s.nome);
                        setMostrarSugestoesServico(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface"
                    >
                      {s.nome}
                    </button>
                  ))
              ) : (
                <button
                  type="button"
                  onClick={() => setMostrarSugestoesServico(false)}
                  className="w-full text-left px-4 py-2.5 text-sm font-semibold text-forest hover:bg-surface"
                >
                  + Cadastrar &ldquo;{buscaServico}&rdquo; como novo serviço
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <span className="block text-sm font-medium text-ink/70 mb-1">Banco</span>
          <input
            value={buscaBanco}
            onChange={(e) => {
              setBuscaBanco(e.target.value);
              setBancoSelecionado(null);
              setMostrarSugestoesBanco(true);
            }}
            onFocus={() => setMostrarSugestoesBanco(true)}
            className="input"
            placeholder="Digite o banco..."
          />
          {mostrarSugestoesBanco && buscaBanco && !bancoSelecionado && (
            <div className="absolute z-10 mt-1 w-full rounded-xl bg-white border border-black/10 shadow-lg max-h-56 overflow-auto">
              {bancos.filter((b) => b.nome.toLowerCase().includes(buscaBanco.toLowerCase())).length > 0 ? (
                bancos
                  .filter((b) => b.nome.toLowerCase().includes(buscaBanco.toLowerCase()))
                  .map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setBancoSelecionado(b);
                        setBuscaBanco(b.nome);
                        setMostrarSugestoesBanco(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface"
                    >
                      {b.nome}
                    </button>
                  ))
              ) : (
                <button
                  type="button"
                  onClick={() => setMostrarSugestoesBanco(false)}
                  className="w-full text-left px-4 py-2.5 text-sm font-semibold text-forest hover:bg-surface"
                >
                  + Cadastrar &ldquo;{buscaBanco}&rdquo; como novo banco
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <span className="block text-sm font-medium text-ink/70 mb-1">Plano de conta</span>
          <input
            value={buscaPlanoConta}
            onChange={(e) => {
              setBuscaPlanoConta(e.target.value);
              setPlanoContaSelecionado(null);
              setMostrarSugestoesPlanoConta(true);
            }}
            onFocus={() => setMostrarSugestoesPlanoConta(true)}
            className="input"
            placeholder="Digite o plano de conta..."
          />
          {mostrarSugestoesPlanoConta && buscaPlanoConta && !planoContaSelecionado && (
            <div className="absolute z-10 mt-1 w-full rounded-xl bg-white border border-black/10 shadow-lg max-h-56 overflow-auto">
              {planosConta.filter((p) => p.tipo === "receita" && p.nome.toLowerCase().includes(buscaPlanoConta.toLowerCase())).length > 0 ? (
                planosConta
                  .filter((p) => p.tipo === "receita" && p.nome.toLowerCase().includes(buscaPlanoConta.toLowerCase()))
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPlanoContaSelecionado(p);
                        setBuscaPlanoConta(p.nome);
                        setMostrarSugestoesPlanoConta(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface"
                    >
                      {p.nome}
                    </button>
                  ))
              ) : (
                <button
                  type="button"
                  onClick={() => setMostrarSugestoesPlanoConta(false)}
                  className="w-full text-left px-4 py-2.5 text-sm font-semibold text-forest hover:bg-surface"
                >
                  + Cadastrar &ldquo;{buscaPlanoConta}&rdquo; como novo plano de conta
                </button>
              )}
            </div>
          )}
        </div>

        <Campo label="Número do contrato">
          <input
            value={numeroContrato}
            onChange={(e) => setNumeroContrato(e.target.value)}
            className="input"
            placeholder="Automático se em branco"
          />
        </Campo>

        <Campo label="Forma de pagamento" required>
          <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} className="input">
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Compromisso mínimo" required>
          <select value={tempoInicial} onChange={(e) => setTempoInicial(Number(e.target.value))} className="input">
            {OPCOES_TEMPO_INICIAL.map((m) => (
              <option key={m} value={m}>
                {m} meses
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Data da primeira mensalidade" required>
          <input
            type="date"
            required
            value={dataPrimeiraMensalidade}
            onChange={(e) => setDataPrimeiraMensalidade(e.target.value)}
            className="input"
          />
        </Campo>

        <Campo label="Valor mensal (R$)" required>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={valorMensal}
            onChange={(e) => setValorMensal(e.target.value)}
            className="input"
            placeholder="0,00"
          />
        </Campo>

        <Campo label="Entrada (R$)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={valorEntrada}
            onChange={(e) => setValorEntrada(e.target.value)}
            className="input"
            placeholder="Opcional"
          />
        </Campo>

        {valorEntrada && (
          <Campo label="Data de pagamento da entrada">
            <input
              type="date"
              value={dataPagamentoEntrada}
              onChange={(e) => setDataPagamentoEntrada(e.target.value)}
              className="input"
            />
          </Campo>
        )}

        {editando && (
          <Campo label="Status" required>
            <select value={status} onChange={(e) => setStatus(e.target.value as "ativo" | "encerrado")} className="input">
              <option value="ativo">Ativo</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </Campo>
        )}

        {editando && status === "encerrado" && (
          <Campo label="Data de encerramento" required>
            <input
              type="date"
              required
              value={dataEncerramento}
              onChange={(e) => setDataEncerramento(e.target.value)}
              className="input"
            />
          </Campo>
        )}
      </div>

      {!editando && (
        <p className="text-xs text-ink/40">
          🔁 O contrato é recorrente por padrão — as mensalidades continuam sendo lançadas
          automaticamente no financeiro até você encerrar o contrato. O compromisso mínimo
          acima é só o período combinado com o cliente, pra controle de churn e permanência.
        </p>
      )}

      <button
        type="button"
        onClick={() => setMaisOpcoesAberto((v) => !v)}
        className="text-sm font-semibold text-forest hover:text-ink"
      >
        {maisOpcoesAberto ? "− Ocultar" : "+ Anexo e observações"}
      </button>

      {maisOpcoesAberto && (
        <div className="space-y-4 rounded-2xl bg-surface p-4">
          <div>
            <span className="block text-sm font-medium text-ink/70 mb-1">Arquivo do contrato (PDF)</span>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setArrastandoArquivo(true);
              }}
              onDragLeave={() => setArrastandoArquivo(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastandoArquivo(false);
                handleArquivoSelecionado(e.dataTransfer.files?.[0]);
              }}
              className={`rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
                arrastandoArquivo ? "border-forest bg-mint/40" : "border-black/15 hover:border-forest/60"
              }`}
            >
              <p className="font-semibold text-ink text-sm">
                {arquivo?.name ?? contratoEditando?.arquivo_nome ?? "Arraste o PDF ou clique para selecionar"}
              </p>
              <p className="text-xs text-ink/40 mt-1">Máximo 10MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleArquivoSelecionado(e.target.files?.[0])}
            />
          </div>

          <Campo label="Contratado pelo cliente">
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="input"
              rows={2}
              placeholder="Resumo do contrato, escopo..."
            />
          </Campo>
          <Campo label="Comentários extras">
            <textarea
              value={comentariosExtras}
              onChange={(e) => setComentariosExtras(e.target.value)}
              className="input"
              rows={2}
              placeholder="Curiosidades, pedidos especiais..."
            />
          </Campo>
        </div>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
        >
          {saving ? "Salvando..." : editando ? "Salvar alterações" : "Salvar contrato"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-ink/60 hover:text-ink">
          Cancelar
        </button>
        {editando && (
          <button
            type="button"
            onClick={async () => {
              if (!contratoEditando) return;
              const supabase = createClient();
              const { count } = await supabase
                .from("lancamentos")
                .select("id", { count: "exact", head: true })
                .eq("contrato_id", contratoEditando.id);

              if (count && count > 0) {
                window.alert(
                  "Esse contrato tem lançamentos vinculados no financeiro, então não pode ser excluído. Mude o status para Encerrado se quiser desativá-lo."
                );
                return;
              }

              if (!window.confirm("Excluir este contrato? Essa ação não pode ser desfeita.")) return;
              await supabase.from("contratos").delete().eq("id", contratoEditando.id);
              onSaved();
            }}
            className="ml-auto text-sm font-semibold text-red-500 hover:text-red-700"
          >
            Excluir contrato
          </button>
        )}
      </div>
    </form>
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
