"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PessoaForm } from "@/components/pessoa-form";

interface Contrato {
  id: string;
  numero_contrato: string | null;
  status: "ativo" | "concluido" | "arquivado";
  forma_pagamento: string | null;
  valor_total: number | null;
  data_fechamento: string | null;
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

export default function ContratosPontuaisPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);
  const [editando, setEditando] = useState<Contrato | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("ativo");
  const [detalhe, setDetalhe] = useState<Contrato | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("contratos")
      .select(
        `id, numero_contrato, status, forma_pagamento, valor_total, data_fechamento,
         data_encerramento, servico_id, banco_id, plano_conta_id, descricao, comentarios_extras, arquivo_path, arquivo_nome,
         tipo_pagamento, data_pagamento, situacao_pagamento, valor_entrada, quantidade_parcelas, data_primeira_parcela,
         clientes ( papeis ( pessoas ( nome, razao_social, documento, email ) ) ),
         servicos ( nome ),
         bancos ( nome ),
         planos_conta ( nome )`
      )
      .eq("tipo_contrato", "pontual")
      .order("created_at", { ascending: false });
    setContratos((data as unknown as Contrato[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const contratosFiltrados = contratos.filter((c) => filtro === "todos" || c.status === filtro);

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
        {!painelAberto && !editando && (
          <button
            onClick={() => setPainelAberto(true)}
            className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
          >
            + Novo contrato pontual
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
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-16" />
              <col className="w-40" />
              <col className="w-32" />
              <col className="w-28" />
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
                <th className="px-3 py-3 font-medium">Valor</th>
                <th className="px-3 py-3 font-medium">Início</th>
                <th className="px-3 py-3 font-medium">Encerr.</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {contratosFiltrados.map((c) => (
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
                  <td className="px-3 py-3 text-ink/70">{formatarMoeda(c.valor_total)}</td>
                  <td className="px-3 py-3 text-ink/70">{formatarData(c.data_fechamento)}</td>
                  <td className="px-3 py-3 text-ink/70">
                    {c.status !== "ativo" ? formatarData(c.data_encerramento) : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        c.status === "ativo"
                          ? "bg-mint text-forest"
                          : c.status === "concluido"
                          ? "bg-black/5 text-ink/60"
                          : "bg-black/5 text-ink/40"
                      }`}
                    >
                      {STATUS_LABEL[c.status]}
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
                    <p className="text-xs text-ink/50 mb-0.5">Valor total</p>
                    <p className="text-xl font-extrabold text-forest">{formatarMoeda(detalhe.valor_total)}</p>
                    <p className="text-xs text-ink/40 mt-3 pt-3 border-t border-black/5">Pontual</p>
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
  const [valorTotal, setValorTotal] = useState(
    contratoEditando?.valor_total != null ? String(contratoEditando.valor_total) : ""
  );
  const [dataInicio, setDataInicio] = useState(contratoEditando?.data_fechamento ?? "");

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
    const { data } = await supabase.from("bancos").select("id, nome").order("nome");
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
            descricao: descricao || null,
            comentarios_extras: comentariosExtras || null,
            tipo_pagamento: tipoPagamento,
            data_pagamento: tipoPagamento === "avista" ? dataPagamento || null : null,
            situacao_pagamento: tipoPagamento === "avista" ? situacaoPagamento : null,
            valor_entrada: tipoPagamento === "parcelado" && valorEntrada ? Number(valorEntrada) : null,
            quantidade_parcelas: tipoPagamento === "parcelado" ? Number(quantidadeParcelas) : null,
            data_primeira_parcela: tipoPagamento === "parcelado" ? dataPrimeiraParcela || null : null,
            ...(numeroContrato.trim() ? { numero_contrato: numeroContrato.trim() } : {}),
          })
          .select("id")
          .single();
        if (error) throw error;

        if (arquivo && novoContrato) {
          await enviarArquivo(novoContrato.id, arquivo);
        }

        // Gera o(s) lançamento(s) automaticamente
        if (novoContrato) {
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

        {tipoPagamento === "avista" ? (
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
        )}

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
