"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PessoaForm } from "@/components/pessoa-form";

interface Contrato {
  id: string;
  numero_contrato: string | null;
  tipo_contrato: "pontual" | "recorrente";
  status: "ativo" | "encerrado";
  descricao: string | null;
  forma_pagamento: string | null;
  valor_total: number | null;
  data_fechamento: string | null;
  valor_mensal: number | null;
  data_primeira_mensalidade: string | null;
  tempo_inicial_meses: number | null;
  created_at: string;
  clientes: {
    papeis: {
      pessoas: { nome: string } | null;
    } | null;
  } | null;
}

function formatarMoeda(valor: number | null) {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string | null) {
  if (!data) return "—";
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("contratos")
      .select(
        `id, numero_contrato, tipo_contrato, status, descricao, forma_pagamento,
         valor_total, data_fechamento,
         valor_mensal, data_primeira_mensalidade, tempo_inicial_meses,
         created_at,
         clientes ( papeis ( pessoas ( nome ) ) )`
      )
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    setContratos((data as unknown as Contrato[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Contratos</h1>
          <p className="text-sm text-ink/60 mt-1">
            Contratos pontuais e recorrentes ativos e encerrados.
          </p>
        </div>
        {!painelAberto && (
          <button
            onClick={() => setPainelAberto(true)}
            className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
          >
            + Novo contrato
          </button>
        )}
      </div>

      {painelAberto && (
        <div className="mb-8 rounded-3xl bg-card border border-black/5 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-ink mb-6">Cadastrar contrato</h2>
          <ContratoForm
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
        ) : contratos.length === 0 ? (
          <p className="p-6 text-sm text-ink/50">
            Nenhum contrato cadastrado ainda. Clique em &ldquo;Novo contrato&rdquo; pra começar.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/50 border-b border-black/5">
                <th className="px-6 py-3 font-medium">Nº</th>
                <th className="px-6 py-3 font-medium">Cliente</th>
                <th className="px-6 py-3 font-medium">Tipo</th>
                <th className="px-6 py-3 font-medium">Valor</th>
                <th className="px-6 py-3 font-medium">Início</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.id} className="border-b border-black/5 last:border-0 hover:bg-surface/60">
                  <td className="px-6 py-3 text-ink/50 font-mono text-xs">{c.numero_contrato ?? "—"}</td>
                  <td className="px-6 py-3 font-semibold text-ink">
                    {c.clientes?.papeis?.pessoas?.nome ?? "—"}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        c.tipo_contrato === "recorrente"
                          ? "bg-mint text-forest"
                          : "bg-surface text-ink/70"
                      }`}
                    >
                      {c.tipo_contrato === "recorrente" ? "Recorrente" : "Pontual"}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-ink/70">
                    {c.tipo_contrato === "recorrente"
                      ? `${formatarMoeda(c.valor_mensal)}/mês`
                      : formatarMoeda(c.valor_total)}
                  </td>
                  <td className="px-6 py-3 text-ink/70">
                    {formatarData(
                      c.tipo_contrato === "recorrente" ? c.data_primeira_mensalidade : c.data_fechamento
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        c.status === "ativo" ? "bg-mint text-forest" : "bg-black/5 text-ink/50"
                      }`}
                    >
                      {c.status === "ativo" ? "Ativo" : "Encerrado"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

type TipoContrato = "pontual" | "recorrente";

interface PessoaOpcao {
  id: string;
  nome: string;
  tipo_pessoa: "PF" | "PJ";
}

const FORMAS_PAGAMENTO = ["Pix", "Boleto", "Cartão de crédito", "Transferência"];
const OPCOES_TEMPO_INICIAL = [3, 6, 9, 12];

interface FormProps {
  onSaved?: () => void;
  onCancel?: () => void;
}

function ContratoForm({ onSaved, onCancel }: FormProps) {
  const [tipo, setTipo] = useState<TipoContrato>("recorrente");
  const [pessoas, setPessoas] = useState<PessoaOpcao[]>([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<PessoaOpcao | null>(null);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [cadastrandoCliente, setCadastrandoCliente] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [numeroContrato, setNumeroContrato] = useState("");
  const [descricao, setDescricao] = useState("");
  const [formaPagamento, setFormaPagamento] = useState(FORMAS_PAGAMENTO[0]);

  const [valorTotal, setValorTotal] = useState("");
  const [dataFechamento, setDataFechamento] = useState("");

  const [valorMensal, setValorMensal] = useState("");
  const [dataPrimeiraMensalidade, setDataPrimeiraMensalidade] = useState("");
  const [tempoInicial, setTempoInicial] = useState(3);

  useEffect(() => {
    carregarPessoas();
  }, []);

  async function carregarPessoas() {
    const supabase = createClient();
    const { data } = await supabase.from("pessoas").select("id, nome, tipo_pessoa").order("nome");
    setPessoas(data ?? []);
  }

  const sugestoes = pessoas.filter((p) =>
    p.nome.toLowerCase().includes(buscaCliente.toLowerCase())
  );

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
      const { data: novoPapel, error: papelError } = await supabase
        .from("papeis")
        .insert({ pessoa_id: pessoaId, papel: "cliente" })
        .select("id")
        .single();
      if (papelError) throw papelError;
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
      const clienteId = await garantirClienteId(pessoaSelecionada.id);
      const supabase = createClient();

      const payload: Record<string, unknown> = {
        cliente_id: clienteId,
        tipo_contrato: tipo,
        descricao: descricao || null,
        forma_pagamento: formaPagamento,
        ...(numeroContrato.trim() ? { numero_contrato: numeroContrato.trim() } : {}),
        ...(tipo === "pontual"
          ? { valor_total: Number(valorTotal), data_fechamento: dataFechamento }
          : {
              valor_mensal: Number(valorMensal),
              data_primeira_mensalidade: dataPrimeiraMensalidade,
              tempo_inicial_meses: tempoInicial,
            }),
      };

      const { error } = await supabase.from("contratos").insert(payload);
      if (error) throw error;

      setSaving(false);
      onSaved?.();
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
            const { data } = await supabase
              .from("pessoas")
              .select("id, nome, tipo_pessoa")
              .order("nome");
            setPessoas(data ?? []);
            const encontrada = data?.find((p) => p.id === pessoa.id);
            setPessoaSelecionada(encontrada ?? { id: pessoa.id, nome: pessoa.nome, tipo_pessoa: "PF" });
            setBuscaCliente(pessoa.nome);
            setCadastrandoCliente(false);
          }}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-2 rounded-full bg-surface p-1 w-fit">
        <button
          type="button"
          onClick={() => setTipo("recorrente")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
            tipo === "recorrente" ? "bg-ink text-white" : "text-ink/60"
          }`}
        >
          Recorrente
        </button>
        <button
          type="button"
          onClick={() => setTipo("pontual")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
            tipo === "pontual" ? "bg-ink text-white" : "text-ink/60"
          }`}
        >
          Pontual
        </button>
      </div>

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
                    {p.nome}{" "}
                    <span className="text-xs text-ink/40">({p.tipo_pessoa})</span>
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

        <Campo label="Número do contrato">
          <input
            value={numeroContrato}
            onChange={(e) => setNumeroContrato(e.target.value)}
            className="input"
            placeholder="Gerado automaticamente se deixado em branco"
          />
        </Campo>

        <Campo label="Forma de pagamento" required>
          <select
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value)}
            className="input"
          >
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Campo>

        {tipo === "recorrente" ? (
          <>
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
              <select
                value={tempoInicial}
                onChange={(e) => setTempoInicial(Number(e.target.value))}
                className="input"
              >
                {OPCOES_TEMPO_INICIAL.map((meses) => (
                  <option key={meses} value={meses}>
                    {meses} meses
                  </option>
                ))}
              </select>
            </Campo>
          </>
        ) : (
          <>
            <Campo label="Data de fechamento" required>
              <input
                type="date"
                required
                value={dataFechamento}
                onChange={(e) => setDataFechamento(e.target.value)}
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
          </>
        )}
      </div>

      <Campo label="Descrição / escopo">
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="input"
          rows={3}
          placeholder="O que esse contrato cobre..."
        />
      </Campo>

      {tipo === "recorrente" && (
        <p className="text-xs text-ink/50 -mt-2">
          Após os {tempoInicial} meses iniciais, o contrato renova automaticamente todo mês até
          ser encerrado manualmente.
        </p>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar contrato"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-semibold text-ink/60 hover:text-ink"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function Campo({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
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
