"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";
import { LancamentoForm } from "@/components/lancamento-form";

interface DespesaFixa {
  id: string;
  nome: string;
  fornecedor_pessoa_id: string | null;
  valor_mensal: number;
  banco_id: string | null;
  plano_conta_id: string | null;
  data_competencia: string | null;
  data_inicio: string;
  status: "ativo" | "encerrado";
  data_encerramento: string | null;
  motivo_encerramento: string | null;
  observacoes: string | null;
  ultima_verificacao_parcelas: string | null;
  pessoas: { nome: string } | null;
  bancos: { nome: string } | null;
  planos_conta: { nome: string } | null;
}

interface Opcao {
  id: string;
  nome: string;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string | null) {
  if (!data) return "—";
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function mesesPagando(inicio: string, fim: Date) {
  const d1 = new Date(inicio + "T00:00:00");
  let meses = (fim.getFullYear() - d1.getFullYear()) * 12 + (fim.getMonth() - d1.getMonth());
  if (fim.getDate() < d1.getDate()) meses -= 1;
  return Math.max(meses, 0);
}

type Filtro = "ativo" | "encerrado" | "todos";

export default function DespesasFixasPage() {
  const [despesas, setDespesas] = useState<DespesaFixa[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("ativo");
  const [painelAberto, setPainelAberto] = useState(false);
  const [editando, setEditando] = useState<DespesaFixa | null>(null);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErroCarregamento(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("despesas_fixas")
      .select(
        `id, nome, fornecedor_pessoa_id, valor_mensal, banco_id, plano_conta_id, data_competencia, data_inicio,
         status, data_encerramento, motivo_encerramento, observacoes, ultima_verificacao_parcelas,
         pessoas ( nome ), bancos ( nome ), planos_conta ( nome )`
      )
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Erro ao carregar despesas fixas:", error);
      setErroCarregamento(error.message);
    }
    const lista = (data as unknown as DespesaFixa[]) ?? [];
    setDespesas(lista);
    setLoading(false);
    garantirParcelasFuturas(lista);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Mesma lógica do contrato recorrente: mantém sempre pelo menos 3 meses de
  // parcela gerada à frente; quando cai abaixo disso, completa até 12 de novo.
  // Só verifica 1x por mês por despesa.
  async function garantirParcelasFuturas(lista: DespesaFixa[]) {
    const supabase = createClient();
    const hoje = new Date();
    const limiteMinimo = new Date(hoje);
    limiteMinimo.setMonth(limiteMinimo.getMonth() + 3);
    const alvoFinal = new Date(hoje);
    alvoFinal.setMonth(alvoFinal.getMonth() + 12);
    const trintaDiasAtras = new Date(hoje);
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    for (const d of lista.filter((d) => d.status === "ativo")) {
      if (d.ultima_verificacao_parcelas && new Date(d.ultima_verificacao_parcelas) > trintaDiasAtras) continue;

      const { data: ultimos } = await supabase
        .from("lancamentos")
        .select("data_vencimento, grupo_id")
        .eq("despesa_fixa_id", d.id)
        .eq("recorrencia_tipo", "mensal")
        .order("data_vencimento", { ascending: false })
        .limit(1);

      const ultimo = ultimos?.[0];
      if (!ultimo) continue;

      const maxData = new Date(ultimo.data_vencimento + "T00:00:00");
      if (maxData < limiteMinimo) {
        const linhas: Record<string, unknown>[] = [];
        const cursor = new Date(maxData);
        while (cursor < alvoFinal) {
          cursor.setMonth(cursor.getMonth() + 1);
          const vencISO = cursor.toISOString().slice(0, 10);
          linhas.push({
            despesa_fixa_id: d.id,
            tipo: "despesa",
            situacao: "pendente",
            descricao: d.nome,
            valor: d.valor_mensal,
            data_vencimento: vencISO,
            data_competencia: vencISO,
            banco_id: d.banco_id,
            plano_conta_id: d.plano_conta_id,
            pessoa_id: d.fornecedor_pessoa_id,
            grupo_id: ultimo.grupo_id,
            recorrencia_tipo: "mensal",
          });
        }
        if (linhas.length > 0) await supabase.from("lancamentos").insert(linhas);
      }

      await supabase
        .from("despesas_fixas")
        .update({ ultima_verificacao_parcelas: hoje.toISOString() })
        .eq("id", d.id);
    }
  }

  const filtradas = despesas.filter((d) => filtro === "todos" || d.status === filtro);
  const totalAtivasMensal = despesas.filter((d) => d.status === "ativo").reduce((s, d) => s + d.valor_mensal, 0);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink mb-1">Despesas Fixas</h1>
          <p className="text-sm text-ink/60">
            Assinaturas, aluguel, sistemas e outras contas recorrentes da agência.
          </p>
        </div>
        {!painelAberto && !editando && (
          <button
            onClick={() => setPainelAberto(true)}
            className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
          >
            + Nova despesa fixa
          </button>
        )}
      </div>

      {erroCarregamento && (
        <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">
          <p className="font-semibold">Erro ao carregar as despesas fixas:</p>
          <p className="font-mono text-xs mt-1">{erroCarregamento}</p>
        </div>
      )}

      <div className="rounded-2xl bg-card border border-black/5 p-4 mb-6 w-fit">
        <p className="text-xs text-ink/50 mb-0.5">Total mensal (ativas)</p>
        <p className="text-xl font-extrabold text-red-600">{formatarMoeda(totalAtivasMensal)}</p>
      </div>

      <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1.5 shadow-inner mb-6">
        {(["ativo", "encerrado", "todos"] as Filtro[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${
              filtro === f ? "bg-ink text-white shadow-md scale-105" : "text-ink/50 hover:text-ink hover:bg-white/60"
            }`}
          >
            {f === "ativo" ? "Ativas" : f === "encerrado" ? "Encerradas" : "Todas"}
          </button>
        ))}
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
              {editando ? "Editar despesa fixa" : "Nova despesa fixa"}
            </h2>
            {editando ? (
              <DespesaFixaForm
                despesaEditando={editando}
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
            ) : (
              <LancamentoForm
                lancamentoEditando={null}
                escopoEdicao="unico"
                forcarDespesaFixa
                onSaved={() => {
                  setPainelAberto(false);
                  carregar();
                }}
                onCancel={() => setPainelAberto(false)}
              />
            )}
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-ink/50">Carregando...</p>
        ) : filtradas.length === 0 ? (
          <p className="p-6 text-sm text-ink/50">Nenhuma despesa fixa encontrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/50 border-b border-black/5">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Fornecedor</th>
                <th className="px-4 py-3 font-medium">Valor mensal</th>
                <th className="px-4 py-3 font-medium">Tempo pagando</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((d) => (
                <tr key={d.id} className="border-b border-black/5 last:border-0 hover:bg-surface/60">
                  <td className="px-4 py-3 font-semibold text-ink">{d.nome}</td>
                  <td className="px-4 py-3 text-ink/70">{d.pessoas?.nome ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold text-red-600">{formatarMoeda(d.valor_mensal)}</td>
                  <td className="px-4 py-3 text-ink/70">
                    {mesesPagando(d.data_inicio, d.status === "encerrado" && d.data_encerramento ? new Date(d.data_encerramento + "T00:00:00") : new Date())} meses
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        d.status === "ativo" ? "bg-mint text-forest" : "bg-black/5 text-ink/50"
                      }`}
                    >
                      {d.status === "ativo" ? "Ativa" : "Encerrada"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setEditando(d);
                        setPainelAberto(false);
                      }}
                      className="rounded-full px-3 py-1.5 text-xs font-bold bg-forest text-white hover:bg-ink transition-colors"
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
    </main>
  );
}

function DespesaFixaForm({
  despesaEditando,
  onSaved,
  onCancel,
}: {
  despesaEditando: DespesaFixa | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const editando = !!despesaEditando;
  const enviandoRef = useRef(false);

  const [nome, setNome] = useState(despesaEditando?.nome ?? "");
  const [valorMensal, setValorMensal] = useState(despesaEditando ? String(despesaEditando.valor_mensal) : "");
  const [dataInicio, setDataInicio] = useState(despesaEditando?.data_inicio ?? hojeISO());
  const [observacoes, setObservacoes] = useState(despesaEditando?.observacoes ?? "");

  const [status, setStatus] = useState<"ativo" | "encerrado">(despesaEditando?.status ?? "ativo");
  const [dataEncerramento, setDataEncerramento] = useState(despesaEditando?.data_encerramento ?? "");
  const [motivoEncerramento, setMotivoEncerramento] = useState(despesaEditando?.motivo_encerramento ?? "");

  const [pessoas, setPessoas] = useState<Opcao[]>([]);
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState<Opcao | null>(
    despesaEditando?.fornecedor_pessoa_id && despesaEditando.pessoas
      ? { id: despesaEditando.fornecedor_pessoa_id, nome: despesaEditando.pessoas.nome }
      : null
  );
  const [buscaFornecedor, setBuscaFornecedor] = useState(despesaEditando?.pessoas?.nome ?? "");
  const [mostrarSugFornecedor, setMostrarSugFornecedor] = useState(false);

  const [bancos, setBancos] = useState<Opcao[]>([]);
  const [bancoSelecionado, setBancoSelecionado] = useState<Opcao | null>(
    despesaEditando?.banco_id && despesaEditando.bancos
      ? { id: despesaEditando.banco_id, nome: despesaEditando.bancos.nome }
      : null
  );
  const [buscaBanco, setBuscaBanco] = useState(despesaEditando?.bancos?.nome ?? "");
  const [mostrarSugBanco, setMostrarSugBanco] = useState(false);

  const [planosConta, setPlanosConta] = useState<Opcao[]>([]);
  const [planoContaSelecionado, setPlanoContaSelecionado] = useState<Opcao | null>(
    despesaEditando?.plano_conta_id && despesaEditando.planos_conta
      ? { id: despesaEditando.plano_conta_id, nome: despesaEditando.planos_conta.nome }
      : null
  );
  const [buscaPlanoConta, setBuscaPlanoConta] = useState(despesaEditando?.planos_conta?.nome ?? "");
  const [mostrarSugPlanoConta, setMostrarSugPlanoConta] = useState(false);

  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregarTudo() {
      const supabase = createClient();
      const [{ data: p }, { data: b }, { data: pc }] = await Promise.all([
        supabase.from("pessoas").select("id, nome").order("nome"),
        supabase.from("bancos").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("planos_conta").select("id, nome").eq("tipo", "despesa").order("nome"),
      ]);
      setPessoas(p ?? []);
      setBancos(b ?? []);
      setPlanosConta(pc ?? []);
    }
    carregarTudo();
  }, []);

  const sugFornecedor = pessoas.filter((p) => normalizar(p.nome).includes(normalizar(buscaFornecedor)));
  const sugBanco = bancos.filter((b) => normalizar(b.nome).includes(normalizar(buscaBanco)));
  const sugPlanoConta = planosConta.filter((p) => normalizar(p.nome).includes(normalizar(buscaPlanoConta)));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviandoRef.current) return;
    if (!nome.trim() || !valorMensal || !dataInicio) {
      setErro("Preencha nome, valor mensal e data de início.");
      return;
    }
    enviandoRef.current = true;
    setSaving(true);
    setErro(null);

    try {
      const supabase = createClient();

      let fornecedorId = fornecedorSelecionado?.id ?? null;
      if (!fornecedorId && buscaFornecedor.trim()) {
        const { data, error } = await supabase
          .from("pessoas")
          .insert({ tipo_pessoa: "PJ", nome: buscaFornecedor.trim(), documento: "" })
          .select("id")
          .single();
        if (error) throw error;
        fornecedorId = data.id;
      }

      let bancoFinalId = bancoSelecionado?.id ?? null;
      if (!bancoFinalId && buscaBanco.trim()) {
        const { data, error } = await supabase.from("bancos").insert({ nome: buscaBanco.trim() }).select("id").single();
        if (error) throw error;
        bancoFinalId = data.id;
      }

      let planoContaFinalId = planoContaSelecionado?.id ?? null;
      if (!planoContaFinalId && buscaPlanoConta.trim()) {
        const { data, error } = await supabase
          .from("planos_conta")
          .insert({ nome: buscaPlanoConta.trim(), tipo: "despesa" })
          .select("id")
          .single();
        if (error) throw error;
        planoContaFinalId = data.id;
      }

      if (editando && despesaEditando) {
        const { error } = await supabase
          .from("despesas_fixas")
          .update({
            nome: nome.trim(),
            fornecedor_pessoa_id: fornecedorId,
            valor_mensal: Number(valorMensal),
            banco_id: bancoFinalId,
            plano_conta_id: planoContaFinalId,
            data_inicio: dataInicio,
            observacoes: observacoes || null,
            status,
            data_encerramento: status === "encerrado" ? dataEncerramento || null : null,
            motivo_encerramento: status === "encerrado" ? motivoEncerramento || null : null,
          })
          .eq("id", despesaEditando.id);
        if (error) throw error;

        if (status === "encerrado" && dataEncerramento) {
          await supabase
            .from("lancamentos")
            .delete()
            .eq("despesa_fixa_id", despesaEditando.id)
            .eq("situacao", "pendente")
            .gte("data_vencimento", dataEncerramento);
        }
      } else {
        const { data: novaDespesa, error } = await supabase
          .from("despesas_fixas")
          .insert({
            nome: nome.trim(),
            fornecedor_pessoa_id: fornecedorId,
            valor_mensal: Number(valorMensal),
            banco_id: bancoFinalId,
            plano_conta_id: planoContaFinalId,
            data_inicio: dataInicio,
            observacoes: observacoes || null,
          })
          .select("id")
          .single();
        if (error) throw error;

        if (novaDespesa) {
          const linhas: Record<string, unknown>[] = [];
          const grupoId = crypto.randomUUID();
          for (let i = 0; i < 12; i++) {
            const venc = new Date(dataInicio + "T00:00:00");
            venc.setMonth(venc.getMonth() + i);
            const vencISO = venc.toISOString().slice(0, 10);
            linhas.push({
              despesa_fixa_id: novaDespesa.id,
              tipo: "despesa",
              situacao: "pendente",
              descricao: nome.trim(),
              valor: Number(valorMensal),
              data_vencimento: vencISO,
              data_competencia: vencISO,
              banco_id: bancoFinalId,
              plano_conta_id: planoContaFinalId,
              pessoa_id: fornecedorId,
              grupo_id: grupoId,
              recorrencia_tipo: "mensal",
            });
          }
          const { error: lancError } = await supabase.from("lancamentos").insert(linhas);
          if (lancError) throw lancError;
        }
      }

      setSaving(false);
      enviandoRef.current = false;
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar despesa fixa.");
      setSaving(false);
      enviandoRef.current = false;
    }
  }

  async function excluir() {
    if (!despesaEditando) return;
    const supabase = createClient();
    const { count } = await supabase
      .from("lancamentos")
      .select("id", { count: "exact", head: true })
      .eq("despesa_fixa_id", despesaEditando.id);

    if (count && count > 0) {
      window.alert(
        "Essa despesa fixa tem lançamentos vinculados, então não pode ser excluída. Mude o status pra Encerrada se quiser desativá-la."
      );
      return;
    }

    if (!window.confirm("Excluir essa despesa fixa? Essa ação não pode ser desfeita.")) return;
    await supabase.from("despesas_fixas").delete().eq("id", despesaEditando.id);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="block text-sm font-medium text-ink/70 mb-1">Nome da despesa *</span>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="input"
          placeholder="Ex: Aluguel do escritório, Internet, Assinatura Adobe..."
          required
        />
      </label>

      <div className="relative">
        <span className="block text-sm font-medium text-ink/70 mb-1">Fornecedor (opcional)</span>
        <input
          value={buscaFornecedor}
          onChange={(e) => {
            setBuscaFornecedor(e.target.value);
            setFornecedorSelecionado(null);
            setMostrarSugFornecedor(true);
          }}
          onFocus={() => setMostrarSugFornecedor(true)}
          className="input"
          placeholder="Digite o nome..."
        />
        {mostrarSugFornecedor && buscaFornecedor && !fornecedorSelecionado && (
          <div className="absolute z-10 mt-1 w-full rounded-xl bg-white border border-black/10 shadow-lg max-h-56 overflow-auto">
            {sugFornecedor.length > 0 ? (
              sugFornecedor.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setFornecedorSelecionado(p);
                    setBuscaFornecedor(p.nome);
                    setMostrarSugFornecedor(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface"
                >
                  {p.nome}
                </button>
              ))
            ) : (
              <button
                type="button"
                onClick={() => setMostrarSugFornecedor(false)}
                className="w-full text-left px-4 py-2.5 text-sm font-semibold text-forest hover:bg-surface"
              >
                + Cadastrar &ldquo;{buscaFornecedor}&rdquo; como novo fornecedor
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-sm font-medium text-ink/70 mb-1">Valor mensal (R$) *</span>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={valorMensal}
            onChange={(e) => setValorMensal(e.target.value)}
            className="input"
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-ink/70 mb-1">Data de início *</span>
          <input type="date" required value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="input" />
        </label>
      </div>

      {!editando && (
        <p className="text-xs text-ink/40">
          A data de competência de cada parcela acompanha o próprio mês dela (ex: parcela de
          agosto tem competência em agosto) — não precisa preencher à parte.
        </p>
      )}

      <div className="relative">
        <span className="block text-sm font-medium text-ink/70 mb-1">Banco</span>
        <input
          value={buscaBanco}
          onChange={(e) => {
            setBuscaBanco(e.target.value);
            setBancoSelecionado(null);
            setMostrarSugBanco(true);
          }}
          onFocus={() => setMostrarSugBanco(true)}
          className="input"
          placeholder="Digite o banco..."
        />
        {mostrarSugBanco && buscaBanco && !bancoSelecionado && (
          <div className="absolute z-10 mt-1 w-full rounded-xl bg-white border border-black/10 shadow-lg max-h-56 overflow-auto">
            {sugBanco.length > 0 ? (
              sugBanco.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setBancoSelecionado(b);
                    setBuscaBanco(b.nome);
                    setMostrarSugBanco(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface"
                >
                  {b.nome}
                </button>
              ))
            ) : (
              <button
                type="button"
                onClick={() => setMostrarSugBanco(false)}
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
            setMostrarSugPlanoConta(true);
          }}
          onFocus={() => setMostrarSugPlanoConta(true)}
          className="input"
          placeholder="Digite o plano de conta..."
        />
        {mostrarSugPlanoConta && buscaPlanoConta && !planoContaSelecionado && (
          <div className="absolute z-10 mt-1 w-full rounded-xl bg-white border border-black/10 shadow-lg max-h-56 overflow-auto">
            {sugPlanoConta.length > 0 ? (
              sugPlanoConta.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPlanoContaSelecionado(p);
                    setBuscaPlanoConta(p.nome);
                    setMostrarSugPlanoConta(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface"
                >
                  {p.nome}
                </button>
              ))
            ) : (
              <button
                type="button"
                onClick={() => setMostrarSugPlanoConta(false)}
                className="w-full text-left px-4 py-2.5 text-sm font-semibold text-forest hover:bg-surface"
              >
                + Cadastrar &ldquo;{buscaPlanoConta}&rdquo; como novo plano de despesa
              </button>
            )}
          </div>
        )}
      </div>

      {!editando && (
        <p className="text-xs text-ink/40">
          🔁 Gera 12 meses de lançamentos já pendentes, a partir da data de início. O sistema
          completa automaticamente pra sempre ter uns meses de folga à frente.
        </p>
      )}

      {editando && (
        <div className="rounded-2xl bg-surface p-3 space-y-3">
          <div>
            <span className="block text-sm font-medium text-ink/70 mb-1">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as "ativo" | "encerrado")} className="input">
              <option value="ativo">Ativa</option>
              <option value="encerrado">Encerrada</option>
            </select>
          </div>
          {status === "encerrado" && (
            <>
              <div>
                <span className="block text-sm font-medium text-ink/70 mb-1">Data de encerramento</span>
                <input
                  type="date"
                  value={dataEncerramento}
                  onChange={(e) => setDataEncerramento(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <span className="block text-sm font-medium text-ink/70 mb-1">Motivo (opcional)</span>
                <input
                  value={motivoEncerramento}
                  onChange={(e) => setMotivoEncerramento(e.target.value)}
                  className="input"
                  placeholder="Ex: cancelamos a assinatura, trocamos de fornecedor..."
                />
              </div>
              <p className="text-xs text-ink/40">
                As parcelas pendentes a partir dessa data serão removidas. As já pagas continuam
                intactas.
              </p>
            </>
          )}
        </div>
      )}

      <label className="block">
        <span className="block text-sm font-medium text-ink/70 mb-1">Observações</span>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          className="input"
          rows={2}
        />
      </label>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
        >
          {saving ? "Salvando..." : editando ? "Salvar alterações" : "Salvar despesa fixa"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-ink/60 hover:text-ink">
          Cancelar
        </button>
        {editando && (
          <button
            type="button"
            onClick={excluir}
            className="ml-auto text-sm font-semibold text-red-500 hover:text-red-700"
          >
            Excluir
          </button>
        )}
      </div>
    </form>
  );
}
