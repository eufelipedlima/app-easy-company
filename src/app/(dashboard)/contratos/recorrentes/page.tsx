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
  data_primeira_mensalidade: string | null;
  data_encerramento: string | null;
  tempo_inicial_meses: number | null;
  servico_id: string | null;
  descricao: string | null;
  comentarios_extras: string | null;
  arquivo_path: string | null;
  arquivo_nome: string | null;
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

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("contratos")
      .select(
        `id, numero_contrato, status, forma_pagamento, valor_mensal, valor_entrada, data_primeira_mensalidade,
         data_encerramento, tempo_inicial_meses, servico_id, descricao, comentarios_extras,
         arquivo_path, arquivo_nome,
         clientes ( papeis ( pessoas ( nome, razao_social, documento, email ) ) ),
         servicos ( nome )`
      )
      .eq("tipo_contrato", "recorrente")
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
        <div className="mb-8 rounded-3xl bg-card border border-black/5 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-ink mb-6">
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
                        <p className="text-xs text-ink/50 mb-0.5">LTV atual</p>
                        <p className="text-xl font-extrabold text-ink">{formatarMoeda(ltv)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-ink/40 mt-3 pt-3 border-t border-black/5">
                      Recorrente · {meses} {meses === 1 ? "mês" : "meses"} de casa
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
                    <DetalheLinha label="Início" valor={formatarData(detalhe.data_primeira_mensalidade)} />
                    <DetalheLinha label="Tempo inicial" valor={`${detalhe.tempo_inicial_meses ?? "—"} meses`} />
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
  const [servicoId, setServicoId] = useState(contratoEditando?.servico_id ?? "");
  const [novoServico, setNovoServico] = useState(false);
  const [nomeNovoServico, setNomeNovoServico] = useState("");

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
  const [dataPrimeiraMensalidade, setDataPrimeiraMensalidade] = useState(
    contratoEditando?.data_primeira_mensalidade ?? ""
  );
  const [tempoInicial, setTempoInicial] = useState(contratoEditando?.tempo_inicial_meses ?? 3);
  const [status, setStatus] = useState<"ativo" | "encerrado">(contratoEditando?.status ?? "ativo");
  const [dataEncerramento, setDataEncerramento] = useState(contratoEditando?.data_encerramento ?? "");

  const [descricao, setDescricao] = useState(contratoEditando?.descricao ?? "");
  const [comentariosExtras, setComentariosExtras] = useState(contratoEditando?.comentarios_extras ?? "");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arrastandoArquivo, setArrastandoArquivo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregarPessoas();
    carregarServicos();
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

      let servicoFinalId = servicoId || null;
      if (novoServico && nomeNovoServico.trim()) {
        const { data: srv, error: srvError } = await supabase
          .from("servicos")
          .insert({ nome: nomeNovoServico.trim() })
          .select("id")
          .single();
        if (srvError) throw srvError;
        servicoFinalId = srv.id;
      }

      if (editando && contratoEditando) {
        const { error } = await supabase
          .from("contratos")
          .update({
            forma_pagamento: formaPagamento,
            servico_id: servicoFinalId,
            valor_mensal: Number(valorMensal),
            valor_entrada: valorEntrada ? Number(valorEntrada) : null,
            data_primeira_mensalidade: dataPrimeiraMensalidade,
            tempo_inicial_meses: tempoInicial,
            numero_contrato: numeroContrato.trim() || null,
            status,
            data_encerramento: status === "encerrado" ? dataEncerramento || null : null,
            descricao: descricao || null,
            comentarios_extras: comentariosExtras || null,
          })
          .eq("id", contratoEditando.id);
        if (error) throw error;

        if (arquivo) {
          await enviarArquivo(contratoEditando.id, arquivo);
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
            data_primeira_mensalidade: dataPrimeiraMensalidade,
            tempo_inicial_meses: tempoInicial,
            descricao: descricao || null,
            comentarios_extras: comentariosExtras || null,
            ...(numeroContrato.trim() ? { numero_contrato: numeroContrato.trim() } : {}),
          })
          .select("id")
          .single();
        if (error) throw error;

        if (arquivo && novoContrato) {
          await enviarArquivo(novoContrato.id, arquivo);
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-2xl bg-surface p-4">
        <p className="text-sm font-bold text-ink flex items-center gap-2 mb-3">
          <span className="text-forest">👤</span> Cliente
        </p>
        <div className="relative">
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
      </div>

      <div className="rounded-2xl bg-surface p-4">
        <p className="text-sm font-bold text-ink flex items-center gap-2 mb-3">
          <span className="text-forest">🧾</span> Detalhes do contrato
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Serviço">
            {!novoServico ? (
              <div className="flex gap-2">
                <select value={servicoId} onChange={(e) => setServicoId(e.target.value)} className="input">
                  <option value="">Selecione...</option>
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setNovoServico(true)}
                  className="shrink-0 text-xs font-semibold text-forest whitespace-nowrap"
                >
                  + Novo
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={nomeNovoServico}
                  onChange={(e) => setNomeNovoServico(e.target.value)}
                  className="input"
                  placeholder="Nome do novo serviço"
                />
                <button
                  type="button"
                  onClick={() => {
                    setNovoServico(false);
                    setNomeNovoServico("");
                  }}
                  className="shrink-0 text-xs font-semibold text-ink/50 whitespace-nowrap"
                >
                  Cancelar
                </button>
              </div>
            )}
          </Campo>

          <Campo label="Número do contrato">
            <input
              value={numeroContrato}
              onChange={(e) => setNumeroContrato(e.target.value)}
              className="input"
              placeholder="Gerado automaticamente se em branco"
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
        </div>
      </div>

      <div className="rounded-2xl bg-surface p-4">
        <p className="text-sm font-bold text-ink flex items-center gap-2 mb-3">
          <span className="text-forest">💰</span> Valores e datas
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Entrada (R$)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={valorEntrada}
              onChange={(e) => setValorEntrada(e.target.value)}
              className="input"
              placeholder="Opcional — valor proporcional na assinatura"
            />
            <span className="block text-xs text-ink/40 mt-1">
              Use quando o cliente fecha fora do dia de vencimento e paga um valor proporcional antes
              da primeira mensalidade cheia.
            </span>
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

          <Campo label="Tempo inicial de contrato" required>
            <select value={tempoInicial} onChange={(e) => setTempoInicial(Number(e.target.value))} className="input">
              {OPCOES_TEMPO_INICIAL.map((m) => (
                <option key={m} value={m}>
                  {m} meses
                </option>
              ))}
            </select>
          </Campo>
        </div>

        {!editando && (
          <p className="text-xs text-ink/50 mt-4 pt-4 border-t border-black/5">
            🔁 Após os {tempoInicial} meses iniciais, o contrato renova automaticamente todo mês até
            ser encerrado manualmente.
          </p>
        )}
      </div>

      {editando && (
        <div className="rounded-2xl bg-surface p-4">
          <p className="text-sm font-bold text-ink flex items-center gap-2 mb-3">
            <span className="text-forest">⚙️</span> Status do contrato
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="Status" required>
              <select value={status} onChange={(e) => setStatus(e.target.value as "ativo" | "encerrado")} className="input">
                <option value="ativo">Ativo</option>
                <option value="encerrado">Encerrado</option>
              </select>
            </Campo>

            {status === "encerrado" && (
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
        </div>
      )}

      <div className="rounded-2xl bg-surface p-4">
        <p className="text-sm font-bold text-ink flex items-center gap-2 mb-3">
          <span className="text-forest">⬆</span> Arquivo do contrato
        </p>
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
          className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            arrastandoArquivo ? "border-forest bg-mint/40" : "border-black/15 hover:border-forest/60"
          }`}
        >
          <p className="text-2xl mb-2">⬆</p>
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

      <div className="rounded-2xl bg-surface p-4 space-y-4">
        <p className="text-sm font-bold text-ink flex items-center gap-2">
          <span className="text-forest">📝</span> Observações do contrato
        </p>
        <Campo label="Contratado pelo cliente">
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="input"
            rows={3}
            placeholder="Resumo do contrato, observações importantes, escopo detalhado..."
          />
          <span className="block text-xs text-ink/40 mt-1">
            Descreva o que foi contratado e observações relevantes sobre o escopo.
          </span>
        </Campo>
        <Campo label="Comentários extras">
          <textarea
            value={comentariosExtras}
            onChange={(e) => setComentariosExtras(e.target.value)}
            className="input"
            rows={3}
            placeholder="Curiosidades, pedidos especiais, preferências do cliente..."
          />
          <span className="block text-xs text-ink/40 mt-1">
            Informações adicionais sobre o fechamento e particularidades do cliente.
          </span>
        </Campo>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex items-center gap-3 pt-2">
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
