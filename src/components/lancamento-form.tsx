"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";
import { PessoaForm } from "@/components/pessoa-form";

export interface Lancamento {
  id: string;
  descricao: string | null;
  valor: number;
  tipo: "receita" | "despesa" | "transferencia";
  situacao: "pendente" | "pago";
  data_vencimento: string;
  data_quitacao: string | null;
  data_competencia: string | null;
  codigo_transacao: string | null;
  banco_id: string | null;
  banco_destino_id: string | null;
  plano_conta_id: string | null;
  servico_id: string | null;
  numero_parcela: number | null;
  total_parcelas: number | null;
  grupo_id: string | null;
  grupo: string | null;
  recorrencia_tipo: "mensal" | "semanal" | "anual" | null;
  clientes: { papeis: { pessoas: { id: string; nome: string; pix: string | null; tipo_pessoa: "PF" | "PJ" } | null } | null } | null;
  pessoas: { id: string; nome: string; pix: string | null; tipo_pessoa: "PF" | "PJ" } | null;
  bancos: { nome: string } | null;
  bancos_destino: { nome: string } | null;
  planos_conta: { nome: string } | null;
  servicos: { nome: string } | null;
}

interface PessoaOpcao {
  id: string;
  nome: string;
  tipo_pessoa: "PF" | "PJ";
}

export interface Opcao {
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

export function nomePessoaLancamento(l: { clientes: Lancamento["clientes"]; pessoas: Lancamento["pessoas"] }) {
  return l.clientes?.papeis?.pessoas?.nome ?? l.pessoas?.nome ?? null;
}

export function LancamentoForm({
  lancamentoEditando,
  escopoEdicao,
  forcarDespesaFixa,
  onSaved,
  onCancel,
}: {
  lancamentoEditando: Lancamento | null;
  escopoEdicao: "unico" | "grupo";
  forcarDespesaFixa?: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const editando = !!lancamentoEditando;

  const [tipo, setTipo] = useState<"receita" | "despesa" | "transferencia">(
    lancamentoEditando?.tipo ?? (forcarDespesaFixa ? "despesa" : "receita")
  );

  const [pessoas, setPessoas] = useState<PessoaOpcao[]>([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<PessoaOpcao | null>(() => {
    if (!lancamentoEditando) return null;
    const p = lancamentoEditando.pessoas ?? lancamentoEditando.clientes?.papeis?.pessoas ?? null;
    return p ? { id: p.id, nome: p.nome, tipo_pessoa: p.tipo_pessoa } : null;
  });
  const [buscaCliente, setBuscaCliente] = useState(
    lancamentoEditando ? nomePessoaLancamento(lancamentoEditando) ?? "" : ""
  );
  const [mostrarSugCliente, setMostrarSugCliente] = useState(false);
  const [cadastrandoCliente, setCadastrandoCliente] = useState(false);

  const [bancos, setBancos] = useState<Opcao[]>([]);
  const [bancoSelecionado, setBancoSelecionado] = useState<Opcao | null>(null);
  const [buscaBanco, setBuscaBanco] = useState("");
  const [mostrarSugBanco, setMostrarSugBanco] = useState(false);

  const [bancoDestinoSelecionado, setBancoDestinoSelecionado] = useState<Opcao | null>(null);
  const [buscaBancoDestino, setBuscaBancoDestino] = useState("");
  const [mostrarSugBancoDestino, setMostrarSugBancoDestino] = useState(false);

  const [planosConta, setPlanosConta] = useState<PlanoContaOpcao[]>([]);
  const [planoContaSelecionado, setPlanoContaSelecionado] = useState<PlanoContaOpcao | null>(null);
  const [buscaPlanoConta, setBuscaPlanoConta] = useState("");
  const [mostrarSugPlanoConta, setMostrarSugPlanoConta] = useState(false);

  const [servicos, setServicos] = useState<(Opcao & { plano_conta_id: string | null })[]>([]);
  const [servicoSelecionado, setServicoSelecionado] = useState<Opcao | null>(null);
  const [buscaServico, setBuscaServico] = useState("");
  const [mostrarSugServico, setMostrarSugServico] = useState(false);

  const [descricao, setDescricao] = useState(lancamentoEditando?.descricao ?? "");
  const [valor, setValor] = useState(lancamentoEditando ? String(lancamentoEditando.valor) : "");
  const [grupo, setGrupo] = useState(lancamentoEditando?.grupo ?? "");
  const [gruposExistentes, setGruposExistentes] = useState<string[]>([]);
  const [situacao, setSituacao] = useState<"pendente" | "pago">(lancamentoEditando?.situacao ?? "pendente");
  const hojeISOForm = new Date().toISOString().slice(0, 10);
  const [dataVencimento, setDataVencimento] = useState(lancamentoEditando?.data_vencimento ?? hojeISOForm);
  const [dataQuitacao, setDataQuitacao] = useState(lancamentoEditando?.data_quitacao ?? "");
  const [dataCompetencia, setDataCompetencia] = useState(lancamentoEditando?.data_competencia ?? hojeISOForm);

  const [repeticao, setRepeticao] = useState<"nenhuma" | "parcelado" | "recorrente">("nenhuma");
  const [totalParcelas, setTotalParcelas] = useState("2");
  const [frequenciaRecorrencia, setFrequenciaRecorrencia] = useState<"mensal" | "semanal" | "anual">("mensal");
  const [quantidadeRecorrencias, setQuantidadeRecorrencias] = useState("12");

  const [ehDespesaFixa, setEhDespesaFixa] = useState(!!forcarDespesaFixa);

  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregarTudo() {
      const supabase = createClient();
      const [{ data: p }, { data: b }, { data: pc }, { data: s }, { data: gruposData }] = await Promise.all([
        supabase.from("pessoas").select("id, nome, tipo_pessoa").order("nome"),
        supabase.from("bancos").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("planos_conta").select("id, nome, tipo").order("nome"),
        supabase.from("servicos").select("id, nome, plano_conta_id").order("nome"),
        supabase.from("lancamentos").select("grupo").not("grupo", "is", null),
      ]);
      setPessoas(p ?? []);
      setBancos(b ?? []);
      setPlanosConta((pc as PlanoContaOpcao[]) ?? []);
      setServicos((s as { id: string; nome: string; plano_conta_id: string | null }[]) ?? []);
      setGruposExistentes(Array.from(new Set((gruposData ?? []).map((g) => g.grupo).filter((g): g is string => !!g))).sort());

      if (lancamentoEditando?.banco_id) {
        const banco = b?.find((x) => x.id === lancamentoEditando.banco_id);
        if (banco) {
          setBancoSelecionado(banco);
          setBuscaBanco(banco.nome);
        }
      }
      if (lancamentoEditando?.plano_conta_id) {
        const plano = pc?.find((x) => x.id === lancamentoEditando.plano_conta_id);
        if (plano) {
          setPlanoContaSelecionado(plano as PlanoContaOpcao);
          setBuscaPlanoConta(plano.nome);
        }
      }
      if (lancamentoEditando?.servico_id) {
        const servico = s?.find((x) => x.id === lancamentoEditando.servico_id);
        if (servico) {
          setServicoSelecionado(servico);
          setBuscaServico(servico.nome);
        }
      }
    }
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sugCliente = pessoas.filter((p) => normalizar(p.nome).includes(normalizar(buscaCliente)));
  const sugBanco = bancos.filter((b) => normalizar(b.nome).includes(normalizar(buscaBanco)));
  const sugBancoDestino = bancos.filter((b) => normalizar(b.nome).includes(normalizar(buscaBancoDestino)));
  const sugPlanoConta = planosConta
    .filter((p) => p.tipo === tipo)
    .filter((p) => normalizar(p.nome).includes(normalizar(buscaPlanoConta)));
  const sugServico = servicos.filter((s) => normalizar(s.nome).includes(normalizar(buscaServico)));

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

  // Garante que o lançamento tenha um registro de pagamento em lancamento_pagamentos
  // batendo com a situação/banco/valor atuais do form. É esse registro (não o banco_id
  // "esperado" salvo no próprio lançamento) que alimenta o saldo dos bancos.
  async function sincronizarPagamento(lancamentoId: string, bancoId: string | null) {
    const supabase = createClient();

    // Se já existem 2+ pagamentos parciais registrados (via o painel dedicado de
    // pagamentos, em bancos possivelmente diferentes), essa edição simples não deve
    // apagar esse detalhamento — só mexe quando havia 0 ou 1 registro (ou seja,
    // quando o "pago" foi marcado por aqui mesmo, não pelo painel de parciais).
    const { count } = await supabase
      .from("lancamento_pagamentos")
      .select("id", { count: "exact", head: true })
      .eq("lancamento_id", lancamentoId);
    if ((count ?? 0) >= 2) return;

    if (situacao === "pago") {
      // Substitui qualquer pagamento anterior por um único registro refletindo o
      // estado atual do formulário — mantém o saldo consistente com o que está na tela.
      await supabase.from("lancamento_pagamentos").delete().eq("lancamento_id", lancamentoId);
      await supabase.from("lancamento_pagamentos").insert({
        lancamento_id: lancamentoId,
        data_pagamento: dataQuitacao || hojeISOForm,
        banco_id: bancoId,
        valor: Number(valor),
      });
    } else {
      // Voltou a pendente: não conta mais como pago em banco nenhum
      await supabase.from("lancamento_pagamentos").delete().eq("lancamento_id", lancamentoId);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro(null);

    try {
      const supabase = createClient();

      let bancoFinalId = bancoSelecionado?.id ?? null;
      if (!bancoFinalId && buscaBanco.trim()) {
        const { data, error } = await supabase.from("bancos").insert({ nome: buscaBanco.trim() }).select("id").single();
        if (error) throw error;
        bancoFinalId = data.id;
      }

      let planoContaFinalId = planoContaSelecionado?.id ?? null;
      if (!planoContaFinalId && buscaPlanoConta.trim() && tipo !== "transferencia") {
        const { data, error } = await supabase
          .from("planos_conta")
          .insert({ nome: buscaPlanoConta.trim(), tipo })
          .select("id")
          .single();
        if (error) throw error;
        planoContaFinalId = data.id;
      }

      let bancoDestinoFinalId = bancoDestinoSelecionado?.id ?? null;
      if (tipo === "transferencia" && !bancoDestinoFinalId && buscaBancoDestino.trim()) {
        const { data, error } = await supabase
          .from("bancos")
          .insert({ nome: buscaBancoDestino.trim() })
          .select("id")
          .single();
        if (error) throw error;
        bancoDestinoFinalId = data.id;
      }

      let servicoFinalId = servicoSelecionado?.id ?? null;
      if (!servicoFinalId && buscaServico.trim() && tipo === "receita") {
        const { data, error } = await supabase.from("servicos").insert({ nome: buscaServico.trim() }).select("id").single();
        if (error) throw error;
        servicoFinalId = data.id;
      }

      let clienteId: string | null = null;
      if (pessoaSelecionada && tipo === "receita") {
        clienteId = await garantirClienteId(pessoaSelecionada.id);
      }

      const payloadBase = {
        descricao: tipo === "transferencia" ? "Transferência de contas" : descricao || null,
        tipo,
        banco_id: bancoFinalId,
        banco_destino_id: tipo === "transferencia" ? bancoDestinoFinalId : null,
        plano_conta_id: tipo === "transferencia" ? null : planoContaFinalId,
        servico_id: tipo === "receita" ? servicoFinalId : null,
        pessoa_id: tipo === "transferencia" ? null : pessoaSelecionada?.id ?? null,
        grupo: tipo === "transferencia" ? null : grupo.trim() || null,
        ...(clienteId ? { cliente_id: clienteId } : {}),
      };

      if (editando && lancamentoEditando) {
        const payload = {
          ...payloadBase,
          valor: Number(valor),
          situacao,
          data_vencimento: dataVencimento,
          data_quitacao: situacao === "pago" ? dataQuitacao || null : null,
          data_competencia: dataCompetencia || null,
        };
        const { error } = await supabase.from("lancamentos").update(payload).eq("id", lancamentoEditando.id);
        if (error) throw error;

        if (tipo !== "transferencia") {
          await sincronizarPagamento(lancamentoEditando.id, bancoFinalId);
        }

        if (escopoEdicao === "grupo" && lancamentoEditando.grupo_id) {
          // Aplica os campos "de conteúdo" (incluindo valor, útil pra reajuste) às próximas
          // parcelas/recorrências pendentes — situação, vencimento e quitação continuam
          // sendo por lançamento individual
          await supabase
            .from("lancamentos")
            .update({ ...payloadBase, valor: Number(valor) })
            .eq("grupo_id", lancamentoEditando.grupo_id)
            .eq("situacao", "pendente")
            .gt("data_vencimento", lancamentoEditando.data_vencimento)
            .neq("id", lancamentoEditando.id);
        }
      } else if (!editando && ehDespesaFixa) {
        const { data: novaDespesa, error: despesaError } = await supabase
          .from("despesas_fixas")
          .insert({
            nome: descricao.trim() || "Despesa fixa",
            fornecedor_pessoa_id: pessoaSelecionada?.id ?? null,
            valor_mensal: Number(valor),
            banco_id: bancoFinalId,
            plano_conta_id: planoContaFinalId,
            data_inicio: dataVencimento,
            grupo: grupo.trim() || null,
          })
          .select("id")
          .single();
        if (despesaError) throw despesaError;

        const grupoId = crypto.randomUUID();
        const linhas = Array.from({ length: 12 }, (_, i) => {
          const venc = new Date(dataVencimento + "T00:00:00");
          venc.setMonth(venc.getMonth() + i);
          const vencISO = venc.toISOString().slice(0, 10);
          return {
            ...payloadBase,
            despesa_fixa_id: novaDespesa.id,
            valor: Number(valor),
            situacao: i === 0 ? situacao : "pendente",
            data_vencimento: vencISO,
            data_quitacao: i === 0 && situacao === "pago" ? dataQuitacao || null : null,
            data_competencia: vencISO,
            grupo_id: grupoId,
            recorrencia_tipo: "mensal",
          };
        });
        const { data: inseridos, error: lancError } = await supabase.from("lancamentos").insert(linhas).select("id");
        if (lancError) throw lancError;

        if (situacao === "pago" && inseridos && inseridos[0]) {
          await sincronizarPagamento(inseridos[0].id, bancoFinalId);
        }
      } else if (repeticao === "parcelado") {
        const n = Number(totalParcelas);
        const grupoId = crypto.randomUUID();
        const linhas = Array.from({ length: n }, (_, i) => {
          const venc = new Date(dataVencimento + "T00:00:00");
          venc.setMonth(venc.getMonth() + i);
          const comp = dataCompetencia ? new Date(dataCompetencia + "T00:00:00") : null;
          if (comp) comp.setMonth(comp.getMonth() + i);
          return {
            ...payloadBase,
            valor: Number(valor),
            situacao: i === 0 ? situacao : "pendente",
            data_vencimento: venc.toISOString().slice(0, 10),
            data_quitacao: i === 0 && situacao === "pago" ? dataQuitacao || null : null,
            data_competencia: comp ? comp.toISOString().slice(0, 10) : null,
            grupo_id: grupoId,
            numero_parcela: i + 1,
            total_parcelas: n,
          };
        });
        const { data: inseridos, error } = await supabase.from("lancamentos").insert(linhas).select("id");
        if (error) throw error;

        if (situacao === "pago" && tipo !== "transferencia" && inseridos && inseridos[0]) {
          await sincronizarPagamento(inseridos[0].id, bancoFinalId);
        }
      } else if (repeticao === "recorrente") {
        const n = Number(quantidadeRecorrencias);
        const grupoId = crypto.randomUUID();
        const linhas = Array.from({ length: n }, (_, i) => {
          const venc = new Date(dataVencimento + "T00:00:00");
          const comp = dataCompetencia ? new Date(dataCompetencia + "T00:00:00") : null;
          if (frequenciaRecorrencia === "mensal") {
            venc.setMonth(venc.getMonth() + i);
            if (comp) comp.setMonth(comp.getMonth() + i);
          } else if (frequenciaRecorrencia === "semanal") {
            venc.setDate(venc.getDate() + i * 7);
            if (comp) comp.setDate(comp.getDate() + i * 7);
          } else {
            venc.setFullYear(venc.getFullYear() + i);
            if (comp) comp.setFullYear(comp.getFullYear() + i);
          }
          return {
            ...payloadBase,
            valor: Number(valor),
            situacao: i === 0 ? situacao : "pendente",
            data_vencimento: venc.toISOString().slice(0, 10),
            data_quitacao: i === 0 && situacao === "pago" ? dataQuitacao || null : null,
            data_competencia: comp ? comp.toISOString().slice(0, 10) : null,
            grupo_id: grupoId,
            recorrencia_tipo: frequenciaRecorrencia,
          };
        });
        const { data: inseridos, error } = await supabase.from("lancamentos").insert(linhas).select("id");
        if (error) throw error;

        if (situacao === "pago" && tipo !== "transferencia" && inseridos && inseridos[0]) {
          await sincronizarPagamento(inseridos[0].id, bancoFinalId);
        }
      } else {
        const payload = {
          ...payloadBase,
          valor: Number(valor),
          situacao,
          data_vencimento: dataVencimento,
          data_quitacao: situacao === "pago" ? dataQuitacao || null : null,
          data_competencia: dataCompetencia || null,
        };
        const { data: inserido, error } = await supabase.from("lancamentos").insert(payload).select("id").single();
        if (error) throw error;

        if (situacao === "pago" && tipo !== "transferencia" && inserido) {
          await sincronizarPagamento(inserido.id, bancoFinalId);
        }
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
          ← Voltar
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
      <div className="flex items-center gap-1 rounded-full bg-surface p-1 w-fit">
        <button
          type="button"
          onClick={() => setTipo("receita")}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            tipo === "receita" ? "bg-forest text-white" : "text-ink/60"
          }`}
        >
          Receita
        </button>
        <button
          type="button"
          onClick={() => setTipo("despesa")}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            tipo === "despesa" ? "bg-red-600 text-white" : "text-ink/60"
          }`}
        >
          Despesa
        </button>
        <button
          type="button"
          onClick={() => setTipo("transferencia")}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            tipo === "transferencia" ? "bg-ink text-white" : "text-ink/60"
          }`}
        >
          Transferência
        </button>
      </div>

      <div className={`rounded-2xl p-3 ${situacao === "pago" ? "bg-mint" : "bg-surface"}`}>
        <span className="block text-sm font-semibold text-ink mb-1.5">
          {tipo === "receita" ? "Esse valor já entrou?" : tipo === "despesa" ? "Essa conta já foi paga?" : "Já foi feita?"}
        </span>
        <div className="flex items-center gap-1 rounded-full bg-white p-1 w-fit shadow-sm">
          <button
            type="button"
            onClick={() => setSituacao("pendente")}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              situacao === "pendente" ? "bg-ink text-white" : "text-ink/60"
            }`}
          >
            Ainda não
          </button>
          <button
            type="button"
            onClick={() => setSituacao("pago")}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              situacao === "pago" ? "bg-forest text-white" : "text-ink/60"
            }`}
          >
            ✓ Já foi — dar baixa agora
          </button>
        </div>
        {situacao === "pago" && (
          <div className="mt-3">
            <Campo label="Data de quitação" required>
              <input type="date" required value={dataQuitacao} onChange={(e) => setDataQuitacao(e.target.value)} className="input" />
            </Campo>
          </div>
        )}
      </div>

      {tipo !== "transferencia" && (
        <div className="relative">
          <Busca
            label="Cliente / Fornecedor (opcional)"
            valor={buscaCliente}
            onChange={(v) => {
              setBuscaCliente(v);
              setPessoaSelecionada(null);
              setMostrarSugCliente(true);
            }}
            onFocus={() => setMostrarSugCliente(true)}
            placeholder="Digite o nome..."
          />
          {mostrarSugCliente && buscaCliente && !pessoaSelecionada && (
            <ListaSugestoes>
              {sugCliente.length > 0 ? (
                sugCliente.map((p) => (
                  <ItemSugestao
                    key={p.id}
                    onClick={() => {
                      setPessoaSelecionada(p);
                      setBuscaCliente(p.nome);
                      setMostrarSugCliente(false);
                    }}
                  >
                    {p.nome}
                  </ItemSugestao>
                ))
              ) : (
                <ItemSugestao destaque onClick={() => setCadastrandoCliente(true)}>
                  + Cadastrar &ldquo;{buscaCliente}&rdquo; como nova pessoa
                </ItemSugestao>
              )}
            </ListaSugestoes>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {tipo !== "transferencia" && (
          <Campo label="Descrição">
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input" placeholder="Ex: Assessoria de Marketing" />
          </Campo>
        )}
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
        {!ehDespesaFixa && (
          <Campo label="Data de competência">
            <input type="date" value={dataCompetencia} onChange={(e) => setDataCompetencia(e.target.value)} className="input" />
          </Campo>
        )}
        <Campo label="Data de vencimento" required>
          <input type="date" required value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="input" />
          {ehDespesaFixa && (
            <span className="block text-xs text-ink/40 mt-1">
              Vira a data de início. A competência de cada parcela acompanha o mês dela.
            </span>
          )}
        </Campo>
      </div>

      {situacao === "pago" && tipo !== "transferencia" && (
        <p className="text-xs text-ink/40 -mt-2">
          O banco selecionado abaixo é de onde o pagamento saiu/entrou — é ele que atualiza o saldo.
        </p>
      )}

      {!editando && tipo === "despesa" && !forcarDespesaFixa && (
        <label className="flex items-center gap-2 text-sm font-semibold text-ink cursor-pointer rounded-2xl bg-surface p-3">
          <input
            type="checkbox"
            checked={ehDespesaFixa}
            onChange={(e) => setEhDespesaFixa(e.target.checked)}
            className="h-4 w-4 rounded accent-red-600"
          />
          Despesa Fixa
          <span className="text-xs font-normal text-ink/40">
            (gera 12 meses e aparece em Financeiro → Despesas Fixas)
          </span>
        </label>
      )}

      {!editando && !ehDespesaFixa && (
        <div className="rounded-2xl bg-surface p-3">
          <span className="block text-sm font-medium text-ink/70 mb-2">Repetição</span>
          <div className="flex items-center gap-1 rounded-full bg-white p-1 w-fit mb-3">
            <button
              type="button"
              onClick={() => setRepeticao("nenhuma")}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                repeticao === "nenhuma" ? "bg-ink text-white" : "text-ink/60"
              }`}
            >
              Nenhuma
            </button>
            <button
              type="button"
              onClick={() => setRepeticao("parcelado")}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                repeticao === "parcelado" ? "bg-ink text-white" : "text-ink/60"
              }`}
            >
              Parcelado
            </button>
            <button
              type="button"
              onClick={() => setRepeticao("recorrente")}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                repeticao === "recorrente" ? "bg-ink text-white" : "text-ink/60"
              }`}
            >
              Recorrente
            </button>
          </div>

          {repeticao === "parcelado" && (
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Número de parcelas" required>
                <input
                  type="number"
                  min="2"
                  required
                  value={totalParcelas}
                  onChange={(e) => setTotalParcelas(e.target.value)}
                  className="input"
                />
              </Campo>
              <p className="text-xs text-ink/40 self-end pb-2">
                Gera {totalParcelas || "—"} lançamentos mensais de {formatarMoeda(Number(valor) || 0)} cada,
                a partir da data de vencimento.
              </p>
            </div>
          )}

          {repeticao === "recorrente" && (
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Frequência" required>
                <select
                  value={frequenciaRecorrencia}
                  onChange={(e) => setFrequenciaRecorrencia(e.target.value as "mensal" | "semanal" | "anual")}
                  className="input"
                >
                  <option value="mensal">Mensal</option>
                  <option value="semanal">Semanal</option>
                  <option value="anual">Anual</option>
                </select>
              </Campo>
              <Campo label="Quantidade de repetições" required>
                <input
                  type="number"
                  min="2"
                  required
                  value={quantidadeRecorrencias}
                  onChange={(e) => setQuantidadeRecorrencias(e.target.value)}
                  className="input"
                />
              </Campo>
            </div>
          )}
        </div>
      )}

      {tipo === "receita" && (
        <div className="relative">
          <Busca
            label="Serviço"
            valor={buscaServico}
            onChange={(v) => {
              setBuscaServico(v);
              setServicoSelecionado(null);
              setMostrarSugServico(true);
            }}
            onFocus={() => setMostrarSugServico(true)}
            placeholder="Digite o serviço..."
          />
          {mostrarSugServico && buscaServico && !servicoSelecionado && (
            <ListaSugestoes>
              {sugServico.length > 0 ? (
                sugServico.map((s) => (
                  <ItemSugestao
                    key={s.id}
                    onClick={() => {
                      setServicoSelecionado(s);
                      setBuscaServico(s.nome);
                      setMostrarSugServico(false);
                      if (s.plano_conta_id) {
                        const plano = planosConta.find((p) => p.id === s.plano_conta_id);
                        if (plano) {
                          setPlanoContaSelecionado(plano);
                          setBuscaPlanoConta(plano.nome);
                        }
                      }
                    }}
                  >
                    {s.nome}
                  </ItemSugestao>
                ))
              ) : (
                <ItemSugestao destaque onClick={() => setMostrarSugServico(false)}>
                  + Cadastrar &ldquo;{buscaServico}&rdquo; como novo serviço
                </ItemSugestao>
              )}
            </ListaSugestoes>
          )}
        </div>
      )}

      <div className="relative">
        <Busca
          label={tipo === "transferencia" ? "Banco de origem" : "Banco"}
          valor={buscaBanco}
          onChange={(v) => {
            setBuscaBanco(v);
            setBancoSelecionado(null);
            setMostrarSugBanco(true);
          }}
          onFocus={() => setMostrarSugBanco(true)}
          placeholder="Digite o banco..."
        />
        {mostrarSugBanco && buscaBanco && !bancoSelecionado && (
          <ListaSugestoes>
            {sugBanco.length > 0 ? (
              sugBanco.map((b) => (
                <ItemSugestao
                  key={b.id}
                  onClick={() => {
                    setBancoSelecionado(b);
                    setBuscaBanco(b.nome);
                    setMostrarSugBanco(false);
                  }}
                >
                  {b.nome}
                </ItemSugestao>
              ))
            ) : (
              <ItemSugestao destaque onClick={() => setMostrarSugBanco(false)}>
                + Cadastrar &ldquo;{buscaBanco}&rdquo; como novo banco
              </ItemSugestao>
            )}
          </ListaSugestoes>
        )}
      </div>

      {tipo === "transferencia" && (
        <div className="relative">
          <Busca
            label="Banco de destino"
            valor={buscaBancoDestino}
            onChange={(v) => {
              setBuscaBancoDestino(v);
              setBancoDestinoSelecionado(null);
              setMostrarSugBancoDestino(true);
            }}
            onFocus={() => setMostrarSugBancoDestino(true)}
            placeholder="Digite o banco de destino..."
          />
          {mostrarSugBancoDestino && buscaBancoDestino && !bancoDestinoSelecionado && (
            <ListaSugestoes>
              {sugBancoDestino.length > 0 ? (
                sugBancoDestino.map((b) => (
                  <ItemSugestao
                    key={b.id}
                    onClick={() => {
                      setBancoDestinoSelecionado(b);
                      setBuscaBancoDestino(b.nome);
                      setMostrarSugBancoDestino(false);
                    }}
                  >
                    {b.nome}
                  </ItemSugestao>
                ))
              ) : (
                <ItemSugestao destaque onClick={() => setMostrarSugBancoDestino(false)}>
                  + Cadastrar &ldquo;{buscaBancoDestino}&rdquo; como novo banco
                </ItemSugestao>
              )}
            </ListaSugestoes>
          )}
        </div>
      )}

      {tipo !== "transferencia" && (
        <div className="relative">
          <Busca
            label="Plano de conta"
            valor={buscaPlanoConta}
            onChange={(v) => {
              setBuscaPlanoConta(v);
              setPlanoContaSelecionado(null);
              setMostrarSugPlanoConta(true);
            }}
            onFocus={() => setMostrarSugPlanoConta(true)}
            placeholder="Digite o plano de conta..."
          />
          {mostrarSugPlanoConta && buscaPlanoConta && !planoContaSelecionado && (
            <ListaSugestoes>
              {sugPlanoConta.length > 0 ? (
                sugPlanoConta.map((p) => (
                  <ItemSugestao
                    key={p.id}
                    onClick={() => {
                      setPlanoContaSelecionado(p);
                      setBuscaPlanoConta(p.nome);
                      setMostrarSugPlanoConta(false);
                    }}
                  >
                    {p.nome}
                  </ItemSugestao>
                ))
              ) : (
                <ItemSugestao destaque onClick={() => setMostrarSugPlanoConta(false)}>
                  + Cadastrar &ldquo;{buscaPlanoConta}&rdquo; como novo plano de {tipo}
                </ItemSugestao>
              )}
            </ListaSugestoes>
          )}
        </div>
      )}

      {tipo !== "transferencia" && (
        <label className="block">
          <span className="block text-sm font-medium text-ink/70 mb-1">Grupo (opcional)</span>
          <input
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            list="grupos-lancamento"
            className="input"
            placeholder="Ex: Cartão de Crédito"
          />
          <datalist id="grupos-lancamento">
            {gruposExistentes.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex items-center gap-3 pt-1">
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

function Busca({
  label,
  valor,
  onChange,
  onFocus,
  placeholder,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink/70 mb-1">{label}</span>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        className="input"
        placeholder={placeholder}
      />
    </label>
  );
}

function ListaSugestoes({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute z-10 mt-1 w-full rounded-xl bg-white border border-black/10 shadow-lg max-h-56 overflow-auto">
      {children}
    </div>
  );
}

function ItemSugestao({
  children,
  onClick,
  destaque,
}: {
  children: React.ReactNode;
  onClick: () => void;
  destaque?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-surface ${
        destaque ? "font-semibold text-forest" : ""
      }`}
    >
      {children}
    </button>
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
