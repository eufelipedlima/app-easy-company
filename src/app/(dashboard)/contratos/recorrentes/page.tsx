"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PessoaForm } from "@/components/pessoa-form";

interface Contrato {
  id: string;
  numero_contrato: string | null;
  status: "ativo" | "encerrado";
  valor_mensal: number | null;
  data_primeira_mensalidade: string | null;
  data_encerramento: string | null;
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
  const [filtro, setFiltro] = useState<Filtro>("ativo");
  const [encerrandoId, setEncerrandoId] = useState<string | null>(null);
  const [dataEncerramento, setDataEncerramento] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("contratos")
      .select(
        `id, numero_contrato, status, valor_mensal, data_primeira_mensalidade, data_encerramento,
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
    setEncerrandoId(null);
    setDataEncerramento("");
    carregar();
  }

  const contratosFiltrados = contratos.filter((c) => filtro === "todos" || c.status === filtro);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1">
          {(["ativo", "encerrado", "todos"] as Filtro[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                filtro === f ? "bg-card shadow-sm text-ink" : "text-ink/50"
              }`}
            >
              {f === "ativo" ? "Ativos" : f === "encerrado" ? "Encerrados" : "Todos"}
            </button>
          ))}
        </div>
        {!painelAberto && (
          <button
            onClick={() => setPainelAberto(true)}
            className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
          >
            + Novo contrato recorrente
          </button>
        )}
      </div>

      {painelAberto && (
        <div className="mb-8 rounded-3xl bg-card border border-black/5 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-ink mb-6">Cadastrar contrato recorrente</h2>
          <ContratoRecorrenteForm
            onSaved={() => {
              setPainelAberto(false);
              carregar();
            }}
            onCancel={() => setPainelAberto(false)}
          />
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
                <th className="px-5 py-3 font-medium">Nº</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Serviço</th>
                <th className="px-5 py-3 font-medium">Valor</th>
                <th className="px-5 py-3 font-medium">Início</th>
                <th className="px-5 py-3 font-medium">Meses de casa</th>
                <th className="px-5 py-3 font-medium">LTV atual</th>
                <th className="px-5 py-3 font-medium">Encerramento</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {contratosFiltrados.map((c) => {
                const meses = mesesDeCasa(c.data_primeira_mensalidade, c.data_encerramento);
                const ltv = meses * (c.valor_mensal ?? 0);
                return (
                  <tr key={c.id} className="border-b border-black/5 last:border-0 hover:bg-surface/60">
                    <td className="px-5 py-3 text-ink/50 font-mono text-xs">{c.numero_contrato ?? "—"}</td>
                    <td className="px-5 py-3 font-semibold text-ink">
                      {c.clientes?.papeis?.pessoas?.nome ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-ink/70">{c.servicos?.nome ?? "—"}</td>
                    <td className="px-5 py-3 text-ink/70">{formatarMoeda(c.valor_mensal)}/mês</td>
                    <td className="px-5 py-3 text-ink/70">{formatarData(c.data_primeira_mensalidade)}</td>
                    <td className="px-5 py-3 text-ink/70">{meses}</td>
                    <td className="px-5 py-3 font-semibold text-ink">{formatarMoeda(ltv)}</td>
                    <td className="px-5 py-3 text-ink/70">
                      {c.status === "encerrado" ? formatarData(c.data_encerramento) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          c.status === "ativo" ? "bg-mint text-forest" : "bg-black/5 text-ink/50"
                        }`}
                      >
                        {c.status === "ativo" ? "Ativo" : "Encerrado"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {c.status === "ativo" &&
                        (encerrandoId === c.id ? (
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
                              onClick={() => setEncerrandoId(null)}
                              className="text-xs font-semibold text-ink/40"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEncerrandoId(c.id)}
                            className="text-xs font-semibold text-ink/40 hover:text-ink"
                          >
                            Encerrar
                          </button>
                        ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ContratoRecorrenteForm({
  onSaved,
  onCancel,
}: {
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [pessoas, setPessoas] = useState<PessoaOpcao[]>([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<PessoaOpcao | null>(null);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [cadastrandoCliente, setCadastrandoCliente] = useState(false);

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [servicoId, setServicoId] = useState("");
  const [novoServico, setNovoServico] = useState(false);
  const [nomeNovoServico, setNomeNovoServico] = useState("");

  const [numeroContrato, setNumeroContrato] = useState("");
  const [formaPagamento, setFormaPagamento] = useState(FORMAS_PAGAMENTO[0]);
  const [valorMensal, setValorMensal] = useState("");
  const [dataPrimeiraMensalidade, setDataPrimeiraMensalidade] = useState("");
  const [tempoInicial, setTempoInicial] = useState(3);

  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregarPessoas();
    carregarServicos();
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
    if (!pessoaSelecionada) {
      setErro("Selecione um cliente.");
      return;
    }
    setSaving(true);
    setErro(null);

    try {
      const supabase = createClient();
      const clienteId = await garantirClienteId(pessoaSelecionada.id);

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

      <p className="text-xs text-ink/50">
        Após os {tempoInicial} meses iniciais, o contrato renova automaticamente todo mês até ser
        encerrado manualmente.
      </p>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar contrato"}
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
