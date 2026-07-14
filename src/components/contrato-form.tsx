"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TipoContrato = "pontual" | "recorrente";

interface PessoaOpcao {
  id: string;
  nome: string;
  tipo_pessoa: "PF" | "PJ";
}

const FORMAS_PAGAMENTO = ["Pix", "Boleto", "Cartão de crédito", "Transferência"];
const OPCOES_TEMPO_INICIAL = [3, 6, 9, 12];

interface Props {
  onSaved?: () => void;
  onCancel?: () => void;
}

export function ContratoForm({ onSaved, onCancel }: Props) {
  const [tipo, setTipo] = useState<TipoContrato>("recorrente");
  const [pessoas, setPessoas] = useState<PessoaOpcao[]>([]);
  const [pessoaId, setPessoaId] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [descricao, setDescricao] = useState("");
  const [formaPagamento, setFormaPagamento] = useState(FORMAS_PAGAMENTO[0]);

  // Pontual
  const [valorTotal, setValorTotal] = useState("");
  const [dataFechamento, setDataFechamento] = useState("");

  // Recorrente
  const [valorMensal, setValorMensal] = useState("");
  const [dataPrimeiraMensalidade, setDataPrimeiraMensalidade] = useState("");
  const [tempoInicial, setTempoInicial] = useState(3);

  useEffect(() => {
    async function carregarPessoas() {
      const supabase = createClient();
      const { data } = await supabase
        .from("pessoas")
        .select("id, nome, tipo_pessoa")
        .order("nome");
      setPessoas(data ?? []);
    }
    carregarPessoas();
  }, []);

  // Garante que a pessoa selecionada tenha o papel de cliente (cria se não existir)
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
    if (!pessoaId) {
      setErro("Selecione um cliente.");
      return;
    }

    setSaving(true);
    setErro(null);

    try {
      const clienteId = await garantirClienteId(pessoaId);
      const supabase = createClient();

      const payload: Record<string, unknown> =
        tipo === "pontual"
          ? {
              cliente_id: clienteId,
              tipo_contrato: "pontual",
              descricao: descricao || null,
              forma_pagamento: formaPagamento,
              valor_total: Number(valorTotal),
              data_fechamento: dataFechamento,
            }
          : {
              cliente_id: clienteId,
              tipo_contrato: "recorrente",
              descricao: descricao || null,
              forma_pagamento: formaPagamento,
              valor_mensal: Number(valorMensal),
              data_primeira_mensalidade: dataPrimeiraMensalidade,
              tempo_inicial_meses: tempoInicial,
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
        <Campo label="Cliente" required>
          <select
            required
            value={pessoaId}
            onChange={(e) => setPessoaId(e.target.value)}
            className="input"
          >
            <option value="">Selecione...</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({p.tipo_pessoa})
              </option>
            ))}
          </select>
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
