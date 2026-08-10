"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sanearNomeArquivo } from "@/lib/nome-arquivo";
import { normalizar } from "@/lib/normalizar";
import { PessoaForm } from "@/components/pessoa-form";
import { useTabelaConfig, LINHAS_POR_PAGINA_OPCOES, type ColunaDef } from "@/lib/use-tabela-config";

interface Contrato {
  id: string;
  numero_contrato: string | null;
  status: "ativo" | "concluido" | "arquivado";
  forma_pagamento: string | null;
  valor_total: number | null;
  data_fechamento: string | null;
  data_competencia: string | null;
  data_encerramento: string | null;
  servico_id: string | null;
  banco_id: string | null;
  plano_conta_id: string | null;
  descricao: string | null;
  comentarios_extras: string | null;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  tipo_pagamento: "avista" | "parcelado" | null;
  data_pagamento: string | null;
  situacao_pagamento: "pago" | "pendente" | null;
  valor_entrada: number | null;
  quantidade_parcelas: number | null;
  data_primeira_parcela: string | null;
  eh_migracao: boolean;
  valor_pago_historico: number | null;
  clientes: {
    papeis: {
      pessoas: {
        nome: string;
        razao_social: string | null;
        documento: string | null;
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
  plano_conta_id: string | null;
}

interface Opcao {
  id: string;
  nome: string;
}

interface PlanoConta extends Opcao {
  tipo: "receita" | "despesa";
}

const FORMAS_PAGAMENTO = ["Pix", "Cartão de crédito"];

function formatarMoeda(valor: number | null) {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string | null) {
  if (!data) return "—";
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
}

const STATUS_LABEL: Record<Contrato["status"], string> = {
  ativo: "Ativo",
  concluido: "Concluído",
  arquivado: "Arquivado",
};

type Filtro = "todos" | "ativo" | "concluido" | "arquivado";

const COLUNAS_DISPONIVEIS: ColunaDef[] = [
  { key: "numero", label: "Nº" },
  { key: "cliente", label: "Cliente" },
  { key: "servico", label: "Serviço" },
  { key: "valor", label: "Valor" },
  { key: "inicio", label: "Início" },
  { key: "encerramento", label: "Encerr." },
  { key: "status", label: "Status" },
];

function renderCelulaContratoPontual(key: string, c: Contrato) {
  switch (key) {
    case "numero":
      return <span className="text-ink/50 font-mono text-xs">{c.numero_contrato ?? "—"}</span>;
    case "cliente":
      return <span className="font-semibold text-ink">{c.clientes?.papeis?.pessoas?.nome ?? "—"}</span>;
    case "servico":
      return <span className="text-ink/70">{c.servicos?.nome ?? "—"}</span>;
    case "valor":
      return <span className="text-ink/70">{formatarMoeda(c.valor_total)}</span>;
    case "inicio":
      return <span className="text-ink/70">{formatarData(c.data_fechamento)}</span>;
    case "encerramento":
      return <span className="text-ink/70">{c.status !== "ativo" ? formatarData(c.data_encerramento) : "—"}</span>;
    case "status":
      return (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            c.status === "ativo" ? "bg-mint text-forest" : c.status === "concluido" ? "bg-black/5 text-ink/60" : "bg-black/5 text-ink/40"
          }`}
        >
          {STATUS_LABEL[c.status]}
        </span>
      );
    default:
      return null;
  }
}

export default function ContratosPontuaisPage() {
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

  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErroCarregamento(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("contratos")
      .select(
        `id, numero_contrato, status, forma_pagamento, valor_total, data_fechamento, data_competencia,
         data_encerramento, servico_id, banco_id, plano_conta_id, descricao, comentarios_extras, arquivo_path, arquivo_nome,
         tipo_pagamento, data_pagamento, situacao_pagamento, valor_entrada, quantidade_parcelas, data_primeira_parcela,
         eh_migracao, valor_pago_historico,
         clientes ( papeis ( pessoas ( nome, razao_social, documento, email ) ) ),
         servicos ( nome ),
         bancos ( nome ),
         planos_conta ( nome )`
      )
      .eq("tipo_contrato", "pontual")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Erro ao carregar contratos pontuais:", error);
      setErroCarregamento(error.message);
    }
    setContratos((data as unknown as Contrato[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const {
    colunas,
    painelColunasAberto,
    setPainelColunasAberto,
    linhasPorPagina,
    paginaAtual,
    setPaginaAtual,
    alternarVisibilidade,
    moverColuna,
    mudarLinhasPorPagina,
  } = useTabelaConfig("contratos_pontuais", COLUNAS_DISPONIVEIS);

  const contratosFiltrados = contratos.filter((c) => filtro === "todos" || c.status === filtro);

  const totalPaginas = Math.max(Math.ceil(contratosFiltrados.length / linhasPorPagina), 1);
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const paginados = contratosFiltrados.slice((paginaSegura - 1) * linhasPorPagina, paginaSegura * linhasPorPagina);

  useEffect(() => {
    setPaginaAtual(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1.5 shadow-inner">
          {(["ativo", "concluido", "arquivado", "todos"] as Filtro[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${
                filtro === f
                  ? "bg-ink text-white shadow-md scale-105"
                  : "text-ink/50 hover:text-ink hover:bg-white/60"
              }`}
            >
              {f === "todos" ? "Todos" : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
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
          {!painelAberto && !editando && (
            <button
              onClick={() => setPainelAberto(true)}
              className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
            >
              + Novo contrato pontual
            </button>
          )}
        </div>
      </div>

      {erroCarregamento && (
        <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">
          <p className="font-semibold">Erro ao carregar os contratos:</p>
          <p className="font-mono text-xs mt-1">{erroCarregamento}</p>
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
              {editando ? "Editar contrato" : "Cadastrar contrato pontual"}
            </h2>
            <ContratoPontualForm
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
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/50 border-b border-black/5">
                {colunas
                  .filter((c) => c.visivel)
                  .map((c) => (
                    <th key={c.key} className="px-3 py-3 font-medium">
                      {COLUNAS_DISPONIVEIS.find((d) => d.key === c.key)?.label}
                    </th>
                  ))}
                <th className="px-3 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {paginados.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setDetalhe(c)}
                  className="border-b border-black/5 last:border-0 hover:bg-surface/60 cursor-pointer"
                >
                  {colunas
                    .filter((c2) => c2.visivel)
                    .map((c2) => (
                      <td key={c2.key} className="px-3 py-3">
                        {renderCelulaContratoPontual(c2.key, c)}
                      </td>
                    ))}
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
              ))}
            </tbody>
          </table>
        )}
      </div>

      {contratosFiltrados.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-ink/50">
          <div className="flex items-center gap-4">
            <p>
              Mostrando {(paginaSegura - 1) * linhasPorPagina + 1}–
              {Math.min(paginaSegura * linhasPorPagina, contratosFiltrados.length)} de {contratosFiltrados.length}
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
            {(() => {
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
                          detalhe.status === "ativo"
                            ? "bg-mint text-forest"
                            : detalhe.status === "concluido"
                            ? "bg-black/5 text-ink/60"
                            : "bg-black/5 text-ink/40"
                        }`}
                      >
                        {STATUS_LABEL[detalhe.status]}
                      </span>
                      <button onClick={() => setDetalhe(null)} className="text-ink/40 hover:text-ink text-lg leading-none">
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-card p-4 mb-4 shadow-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-ink/50 mb-0.5">Valor total</p>
                        <p className="text-xl font-extrabold text-forest">{formatarMoeda(detalhe.valor_total)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink/50 mb-0.5">Total pago (real)</p>
                        <p className="text-lg font-bold text-forest">
                          {totalPagoReal != null ? formatarMoeda(totalPagoReal) : "…"}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-ink/40 mt-3 pt-3 border-t border-black/5">
                      Pontual{detalhe.eh_migracao && " · cliente migrado"}
                    </p>
                  </div>

                  <SecaoDetalhe titulo="Cliente">
                    <DetalheLinha label={pessoa?.razao_social ? "Razão social" : "Nome"} valor={pessoa?.nome ?? "—"} />
                    <DetalheLinha label="Documento" valor={pessoa?.documento ?? "—"} />
                    <DetalheLinha label="E-mail" valor={pessoa?.email ?? "—"} />
                  </SecaoDetalhe>

                  <SecaoDetalhe titulo="Período">
                    <DetalheLinha label="Início" valor={formatarData(detalhe.data_fechamento)} />
                    {detalhe.status !== "ativo" && (
                      <DetalheLinha label="Encerramento" valor={formatarData(detalhe.data_encerramento)} />
                    )}
                  </SecaoDetalhe>

                  <SecaoDetalhe titulo="Pagamento">
                    <DetalheLinha label="Serviço" valor={detalhe.servicos?.nome ?? "—"} />
                    <DetalheLinha label="Forma de pagamento" valor={detalhe.forma_pagamento ?? "—"} />
                    <DetalheLinha
                      label="Estrutura"
                      valor={detalhe.tipo_pagamento === "parcelado" ? "Parcelado" : "À vista"}
                    />
                    {detalhe.tipo_pagamento === "avista" ? (
                      <>
                        <DetalheLinha label="Data de pagamento" valor={formatarData(detalhe.data_pagamento)} />
                        <DetalheLinha
                          label="Situação"
                          valor={detalhe.situacao_pagamento === "pago" ? "Pago" : "Pendente"}
                        />
                      </>
                    ) : (
                      <>
                        {detalhe.valor_entrada != null && (
                          <DetalheLinha label="Entrada" valor={formatarMoeda(detalhe.valor_entrada)} />
                        )}
                        <DetalheLinha label="Parcelas" valor={String(detalhe.quantidade_parcelas ?? "—")} />
                        <DetalheLinha
                          label="1ª parcela"
                          valor={formatarData(detalhe.data_primeira_parcela)}
                        />
                      </>
                    )}
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

function ContratoPontualForm({
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
      ? { id: contratoEditando.servico_id, nome: contratoEditando.servicos.nome, plano_conta_id: null }
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
  const [valorTotal, setValorTotal] = useState(
    contratoEditando?.valor_total != null ? String(contratoEditando.valor_total) : ""
  );
  const [dataInicio, setDataInicio] = useState(contratoEditando?.data_fechamento ?? new Date().toISOString().slice(0, 10));
  const [dataCompetenciaContrato, setDataCompetenciaContrato] = useState(
    contratoEditando?.data_competencia ?? new Date().toISOString().slice(0, 10)
  );

  const [tipoPagamento, setTipoPagamento] = useState<"avista" | "parcelado">(
    contratoEditando?.tipo_pagamento ?? "avista"
  );
  const [dataPagamento, setDataPagamento] = useState(contratoEditando?.data_pagamento ?? "");
  const [situacaoPagamento, setSituacaoPagamento] = useState<"pago" | "pendente">(
    contratoEditando?.situacao_pagamento ?? "pendente"
  );
  const [valorEntrada, setValorEntrada] = useState(
    contratoEditando?.valor_entrada != null ? String(contratoEditando.valor_entrada) : ""
  );
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(
    contratoEditando?.quantidade_parcelas != null ? String(contratoEditando.quantidade_parcelas) : "2"
  );
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState(
    contratoEditando?.data_primeira_parcela ?? ""
  );

  const [ehMigracao, setEhMigracao] = useState(contratoEditando?.eh_migracao ?? false);
  const [valorPagoHistorico, setValorPagoHistorico] = useState(
    contratoEditando?.valor_pago_historico != null ? String(contratoEditando.valor_pago_historico) : ""
  );

  const [status, setStatus] = useState<"ativo" | "concluido" | "arquivado">(
    contratoEditando?.status ?? "ativo"
  );
  const [dataEncerramento, setDataEncerramento] = useState(contratoEditando?.data_encerramento ?? "");

  const [descricao, setDescricao] = useState(contratoEditando?.descricao ?? "");
  const [comentariosExtras, setComentariosExtras] = useState(contratoEditando?.comentarios_extras ?? "");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arrastandoArquivo, setArrastandoArquivo] = useState(false);
  const [maisOpcoesAberto, setMaisOpcoesAberto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [saving, setSaving] = useState(false);
  const enviandoRef = useRef(false);
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
    const { data } = await supabase.from("servicos").select("id, nome, plano_conta_id").order("nome");
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

  const sugestoes = pessoas.filter((p) => normalizar(p.nome).includes(normalizar(buscaCliente)));

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
    const path = `${contratoId}/${Date.now()}-${sanearNomeArquivo(arquivo.name)}`;
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
    if (enviandoRef.current) return;
    if (!editando && !pessoaSelecionada) {
      setErro("Selecione um cliente.");
      return;
    }
    enviandoRef.current = true;
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
            banco_id: bancoFinalId,
            plano_conta_id: planoContaFinalId,
            valor_total: Number(valorTotal),
            data_fechamento: dataInicio,
            data_competencia: dataCompetenciaContrato || null,
            numero_contrato: numeroContrato.trim() || null,
            status,
            data_encerramento: status !== "ativo" ? dataEncerramento || null : null,
            descricao: descricao || null,
            comentarios_extras: comentariosExtras || null,
            tipo_pagamento: tipoPagamento,
            data_pagamento: tipoPagamento === "avista" ? dataPagamento || null : null,
            situacao_pagamento: tipoPagamento === "avista" ? situacaoPagamento : null,
            valor_entrada: tipoPagamento === "parcelado" && valorEntrada ? Number(valorEntrada) : null,
            quantidade_parcelas: tipoPagamento === "parcelado" ? Number(quantidadeParcelas) : null,
            data_primeira_parcela: tipoPagamento === "parcelado" ? dataPrimeiraParcela || null : null,
            eh_migracao: ehMigracao,
            valor_pago_historico: ehMigracao && valorPagoHistorico ? Number(valorPagoHistorico) : null,
          })
          .eq("id", contratoEditando.id);
        if (error) throw error;

        if (arquivo) {
          await enviarArquivo(contratoEditando.id, arquivo);
        }

        // Ao concluir/arquivar antes da hora, remove parcelas futuras ainda pendentes
        if (status !== "ativo" && dataEncerramento) {
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
            tipo_contrato: "pontual",
            forma_pagamento: formaPagamento,
            servico_id: servicoFinalId,
            banco_id: bancoFinalId,
            plano_conta_id: planoContaFinalId,
            valor_total: Number(valorTotal),
            data_fechamento: dataInicio,
            data_competencia: dataCompetenciaContrato || null,
            descricao: descricao || null,
            comentarios_extras: comentariosExtras || null,
            tipo_pagamento: tipoPagamento,
            data_pagamento: tipoPagamento === "avista" ? dataPagamento || null : null,
            situacao_pagamento: tipoPagamento === "avista" ? situacaoPagamento : null,
            valor_entrada: tipoPagamento === "parcelado" && valorEntrada ? Number(valorEntrada) : null,
            quantidade_parcelas: tipoPagamento === "parcelado" ? Number(quantidadeParcelas) : null,
            data_primeira_parcela: tipoPagamento === "parcelado" ? dataPrimeiraParcela || null : null,
            ...(numeroContrato.trim() ? { numero_contrato: numeroContrato.trim() } : {}),
            eh_migracao: ehMigracao,
            valor_pago_historico: ehMigracao && valorPagoHistorico ? Number(valorPagoHistorico) : null,
          })
          .select("id")
          .single();
        if (error) throw error;

        if (arquivo && novoContrato) {
          await enviarArquivo(novoContrato.id, arquivo);
        }

        // Gera o(s) lançamento(s) automaticamente — pulado em contratos de migração,
        // já que o valor foi recebido antes de entrar no sistema
        if (novoContrato && !ehMigracao) {
          const linhas: Record<string, unknown>[] = [];
          const nomeCliente = pessoaSelecionada!.nome;
          const descricaoPadrao = nomeServicoParaDescricao
            ? `${nomeCliente} — ${nomeServicoParaDescricao}`
            : nomeCliente;
          const base = {
            contrato_id: novoContrato.id,
            cliente_id: clienteId,
            pessoa_id: pessoaSelecionada!.id,
            tipo: "receita" as const,
            servico_id: servicoFinalId,
            banco_id: bancoFinalId,
            plano_conta_id: planoContaFinalId,
            data_competencia: dataCompetenciaContrato || null,
          };

          if (tipoPagamento === "avista") {
            linhas.push({
              ...base,
              situacao: situacaoPagamento,
              descricao: descricaoPadrao,
              valor: Number(valorTotal),
              data_vencimento: dataPagamento || dataInicio,
              data_quitacao: situacaoPagamento === "pago" ? dataPagamento || null : null,
            });
          } else {
            const entrada = valorEntrada ? Number(valorEntrada) : 0;
            const n = Number(quantidadeParcelas);
            const valorParcela = (Number(valorTotal) - entrada) / n;
            const grupoId = crypto.randomUUID();

            if (entrada > 0) {
              linhas.push({
                ...base,
                situacao: "pendente",
                descricao: `${descricaoPadrao} (entrada)`,
                valor: entrada,
                data_vencimento: dataInicio,
              });
            }

            for (let i = 0; i < n; i++) {
              const venc = new Date(dataPrimeiraParcela + "T00:00:00");
              venc.setMonth(venc.getMonth() + i);
              linhas.push({
                ...base,
                situacao: "pendente",
                descricao: descricaoPadrao,
                valor: valorParcela,
                data_vencimento: venc.toISOString().slice(0, 10),
                grupo_id: grupoId,
                numero_parcela: i + 1,
                total_parcelas: n,
              });
            }
          }

          const { error: lancError } = await supabase.from("lancamentos").insert(linhas);
          if (lancError) throw lancError;
        }
      }

      setSaving(false);
      enviandoRef.current = false;
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar contrato.");
      setSaving(false);
      enviandoRef.current = false;
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
              {servicos.filter((s) => normalizar(s.nome).includes(normalizar(buscaServico))).length > 0 ? (
                servicos
                  .filter((s) => normalizar(s.nome).includes(normalizar(buscaServico)))
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setServicoSelecionado(s);
                        setBuscaServico(s.nome);
                        setMostrarSugestoesServico(false);
                        if (s.plano_conta_id) {
                          const plano = planosConta.find((p) => p.id === s.plano_conta_id);
                          if (plano) {
                            setPlanoContaSelecionado(plano);
                            setBuscaPlanoConta(plano.nome);
                          }
                        }
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
              {bancos.filter((b) => normalizar(b.nome).includes(normalizar(buscaBanco))).length > 0 ? (
                bancos
                  .filter((b) => normalizar(b.nome).includes(normalizar(buscaBanco)))
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
              {planosConta.filter((p) => p.tipo === "receita" && normalizar(p.nome).includes(normalizar(buscaPlanoConta))).length > 0 ? (
                planosConta
                  .filter((p) => p.tipo === "receita" && normalizar(p.nome).includes(normalizar(buscaPlanoConta)))
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

        <Campo label="Data de competência" required>
          <input
            type="date"
            required
            value={dataCompetenciaContrato}
            onChange={(e) => setDataCompetenciaContrato(e.target.value)}
            className="input"
          />
          <span className="block text-xs text-ink/40 mt-1">
            Fixa mesmo se for parcelado — todas as parcelas usam essa mesma data.
          </span>
        </Campo>

        <Campo label="Início do contrato" required>
          <input
            type="date"
            required
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="input"
          />
        </Campo>

        <Campo label="Valor total (R$)" required>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={valorTotal}
            onChange={(e) => setValorTotal(e.target.value)}
            className="input"
            placeholder="0,00"
          />
        </Campo>

        {!ehMigracao && (
          <div>
            <span className="block text-sm font-medium text-ink/70 mb-1">Pagamento</span>
            <div className="flex items-center gap-1 rounded-full bg-surface p-1 w-fit">
              <button
                type="button"
                onClick={() => setTipoPagamento("avista")}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  tipoPagamento === "avista" ? "bg-ink text-white" : "text-ink/60"
                }`}
              >
                À vista
              </button>
              <button
                type="button"
                onClick={() => setTipoPagamento("parcelado")}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  tipoPagamento === "parcelado" ? "bg-ink text-white" : "text-ink/60"
                }`}
              >
                Parcelado
              </button>
            </div>
          </div>
        )}

        {!ehMigracao && (tipoPagamento === "avista" ? (
          <>
            <Campo label="Data de pagamento">
              <input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} className="input" />
            </Campo>
            <div>
              <span className="block text-sm font-medium text-ink/70 mb-1">Situação</span>
              <div className="flex items-center gap-1 rounded-full bg-surface p-1 w-fit">
                <button
                  type="button"
                  onClick={() => setSituacaoPagamento("pendente")}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    situacaoPagamento === "pendente" ? "bg-ink text-white" : "text-ink/60"
                  }`}
                >
                  Pendente
                </button>
                <button
                  type="button"
                  onClick={() => setSituacaoPagamento("pago")}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    situacaoPagamento === "pago" ? "bg-forest text-white" : "text-ink/60"
                  }`}
                >
                  Pago
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
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
            <Campo label="Quantidade de parcelas" required>
              <input
                type="number"
                min="2"
                required
                value={quantidadeParcelas}
                onChange={(e) => setQuantidadeParcelas(e.target.value)}
                className="input"
              />
            </Campo>
            <Campo label="Data da primeira parcela" required>
              <input
                type="date"
                required
                value={dataPrimeiraParcela}
                onChange={(e) => setDataPrimeiraParcela(e.target.value)}
                className="input"
              />
            </Campo>
          </>
        ))}

        {editando && (
          <Campo label="Status" required>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "ativo" | "concluido" | "arquivado")}
              className="input"
            >
              <option value="ativo">Ativo</option>
              <option value="concluido">Concluído</option>
              <option value="arquivado">Arquivado</option>
            </select>
          </Campo>
        )}

        {editando && status !== "ativo" && (
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
                  "Esse contrato tem lançamentos vinculados no financeiro, então não pode ser excluído. Mude o status para Concluído ou Arquivado se quiser desativá-lo."
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
