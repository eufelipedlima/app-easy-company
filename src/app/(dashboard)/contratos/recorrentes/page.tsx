"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PessoaForm } from "@/components/pessoa-form";

interface Contrato {
  id: string;
  numero_contrato: string | null;
  status: "ativo" | "encerrado";
  forma_pagamento: string | null;
  valor_mensal: number | null;
  data_primeira_mensalidade: string | null;
  data_encerramento: string | null;
  tempo_inicial_meses: number | null;
  servico_id: string | null;
  clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
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

const FORMAS_PAGAMENTO = ["Pix", "Boleto", "Cartão de crédito", "Transferência"];
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
  const [alterandoStatusId, setAlterandoStatusId] = useState<string | null>(null);
  const [dataEncerramento, setDataEncerramento] = useState("");
  const [detalhe, setDetalhe] = useState<Contrato | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("contratos")
      .select(
        `id, numero_contrato, status, forma_pagamento, valor_mensal, data_primeira_mensalidade,
         data_encerramento, tempo_inicial_meses, servico_id,
         clientes ( papeis ( pessoas ( nome ) ) ),
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

  async function confirmarEncerramento(id: string) {
    if (!dataEncerramento) return;
    const supabase = createClient();
    await supabase
      .from("contratos")
      .update({ status: "encerrado", data_encerramento: dataEncerramento })
      .eq("id", id);
    setAlterandoStatusId(null);
    setDataEncerramento("");
    carregar();
  }

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
              <col className="w-auto" />
              <col className="w-40" />
              <col className="w-28" />
              <col className="w-16" />
              <col className="w-28" />
              <col className="w-24" />
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr className="text-left text-ink/50 border-b border-black/5">
                <th className="px-3 py-3 font-medium">Nº</th>
                <th className="px-3 py-3 font-medium">Cliente</th>
                <th className="px-3 py-3 font-medium">Serviço</th>
                <th className="px-3 py-3 font-medium">Valor</th>
                <th className="px-3 py-3 font-medium">Meses</th>
                <th className="px-3 py-3 font-medium">LTV atual</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {contratosFiltrados.map((c) => {
                const meses = mesesDeCasa(c.data_primeira_mensalidade, c.data_encerramento);
                const ltv = meses * (c.valor_mensal ?? 0);
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
                    <td className="px-3 py-3 text-ink/70">{formatarMoeda(c.valor_mensal)}</td>
                    <td className="px-3 py-3 text-ink/70">{meses}</td>
                    <td className="px-3 py-3 font-semibold text-ink">{formatarMoeda(ltv)}</td>
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
                      {alterandoStatusId === c.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={dataEncerramento}
                            onChange={(e) => setDataEncerramento(e.target.value)}
                            className="input py-1 px-2 text-xs"
                          />
                          <button
                            onClick={() => confirmarEncerramento(c.id)}
                            className="text-xs font-semibold text-forest"
                          >
                            OK
                          </button>
                          <button
                            onClick={() => setAlterandoStatusId(null)}
                            className="text-xs font-semibold text-ink/40"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditando(c);
                              setPainelAberto(false);
                            }}
                            title="Editar contrato"
                            className="rounded-full px-2.5 py-1 text-xs font-semibold text-ink/50 hover:bg-surface hover:text-ink transition-colors"
                          >
                            Editar
                          </button>
                          {c.status === "ativo" && (
                            <button
                              onClick={() => setAlterandoStatusId(c.id)}
                              title="Encerrar contrato"
                              className="rounded-full px-2.5 py-1 text-xs font-semibold bg-mint text-forest hover:bg-forest hover:text-white transition-colors"
                            >
                              Status
                            </button>
                          )}
                        </div>
                      )}
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
          className="fixed inset-0 z-20 bg-ink/40 flex items-center justify-center p-6"
          onClick={() => setDetalhe(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-ink">Detalhes do contrato</h3>
              <button onClick={() => setDetalhe(null)} className="text-ink/40 hover:text-ink text-sm font-semibold">
                Fechar
              </button>
            </div>
            <dl className="space-y-3 text-sm">
              {(() => {
                const meses = mesesDeCasa(detalhe.data_primeira_mensalidade, detalhe.data_encerramento);
                const ltv = meses * (detalhe.valor_mensal ?? 0);
                return (
                  <>
                    <DetalheLinha label="Nº do contrato" valor={detalhe.numero_contrato ?? "—"} />
                    <DetalheLinha label="Cliente" valor={detalhe.clientes?.papeis?.pessoas?.nome ?? "—"} />
                    <DetalheLinha label="Serviço" valor={detalhe.servicos?.nome ?? "—"} />
                    <DetalheLinha label="Valor mensal" valor={formatarMoeda(detalhe.valor_mensal)} />
                    <DetalheLinha label="Forma de pagamento" valor={detalhe.forma_pagamento ?? "—"} />
                    <DetalheLinha label="Início do contrato" valor={formatarData(detalhe.data_primeira_mensalidade)} />
                    <DetalheLinha label="Tempo inicial" valor={`${detalhe.tempo_inicial_meses ?? "—"} meses`} />
                    <DetalheLinha label="Meses de casa" valor={String(meses)} />
                    <DetalheLinha label="LTV atual" valor={formatarMoeda(ltv)} />
                    {detalhe.status === "encerrado" && (
                      <DetalheLinha label="Data de encerramento" valor={formatarData(detalhe.data_encerramento)} />
                    )}
                    <DetalheLinha
                      label="Status"
                      valor={detalhe.status === "ativo" ? "Ativo" : "Encerrado"}
                    />
                  </>
                );
              })()}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function DetalheLinha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between border-b border-black/5 pb-2 last:border-0">
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
  const [dataPrimeiraMensalidade, setDataPrimeiraMensalidade] = useState(
    contratoEditando?.data_primeira_mensalidade ?? ""
  );
  const [tempoInicial, setTempoInicial] = useState(contratoEditando?.tempo_inicial_meses ?? 3);

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
            data_primeira_mensalidade: dataPrimeiraMensalidade,
            tempo_inicial_meses: tempoInicial,
            numero_contrato: numeroContrato.trim() || null,
          })
          .eq("id", contratoEditando.id);
        if (error) throw error;
      } else {
        const clienteId = await garantirClienteId(pessoaSelecionada!.id);
        const { error } = await supabase.from("contratos").insert({
          cliente_id: clienteId,
          tipo_contrato: "recorrente",
          forma_pagamento: formaPagamento,
          servico_id: servicoFinalId,
          valor_mensal: Number(valorMensal),
          data_primeira_mensalidade: dataPrimeiraMensalidade,
          tempo_inicial_meses: tempoInicial,
          ...(numeroContrato.trim() ? { numero_contrato: numeroContrato.trim() } : {}),
        });
        if (error) throw error;
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative sm:col-span-2">
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
        <p className="text-xs text-ink/50">
          Após os {tempoInicial} meses iniciais, o contrato renova automaticamente todo mês até ser
          encerrado manualmente.
        </p>
      )}

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
