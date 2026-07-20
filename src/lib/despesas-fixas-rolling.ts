// lib/despesas-fixas-rolling.ts
//
// Mantém sempre 12 meses de parcelas PENDENTES geradas à frente pra cada
// Despesa Fixa ativa. Mesmo padrão já usado em Contratos Recorrentes:
// checa no máximo 1x por mês por item (guarda ultima_verificacao_parcelas),
// e só gera parcelas novas se restarem <= 3 pendentes.
//
// Chame conferirRollingDespesasFixas() ao abrir a listagem de Despesas Fixas
// (mesmo lugar/momento em que a checagem dos Contratos Recorrentes já roda).
//
// Nomes de coluna conferidos contra o schema real de `lancamentos`
// (despesa_fixa_id, data_vencimento, data_competencia). A tabela
// `despesas_fixas` em si ainda não foi conferida — ajuste se preciso.

import { supabase } from './supabase-client' // ajuste pro seu client real

const MESES_ALVO = 12
const LIMITE_MINIMO = 3

type DespesaFixa = {
  id: string
  descricao: string
  valor: number
  banco_id: string | null
  plano_conta_id: string | null
  ultima_verificacao_parcelas: string | null
}

export async function conferirRollingDespesasFixas() {
  const hoje = new Date().toISOString().slice(0, 10)
  const mesAtual = hoje.slice(0, 7) // 'YYYY-MM'

  const { data: despesasFixas, error } = await supabase
    .from('despesas_fixas')
    .select('id, descricao, valor, banco_id, plano_conta_id, ultima_verificacao_parcelas')
    .eq('status', 'ativo')

  if (error) throw error

  for (const despesa of (despesasFixas ?? []) as DespesaFixa[]) {
    // já conferida esse mês? pula
    if (despesa.ultima_verificacao_parcelas?.slice(0, 7) === mesAtual) continue

    const { count } = await supabase
      .from('lancamentos')
      .select('id', { count: 'exact', head: true })
      .eq('despesa_fixa_id', despesa.id)
      .eq('situacao', 'pendente')

    const parcelasRestantes = count ?? 0

    if (parcelasRestantes <= LIMITE_MINIMO) {
      await gerarParcelasFaltantes(despesa, parcelasRestantes)
    }

    await supabase
      .from('despesas_fixas')
      .update({ ultima_verificacao_parcelas: hoje })
      .eq('id', despesa.id)
  }
}

async function gerarParcelasFaltantes(despesa: DespesaFixa, parcelasAtuais: number) {
  const faltam = MESES_ALVO - parcelasAtuais
  if (faltam <= 0) return

  // pega a última parcela gerada pra saber de onde continuar a sequência
  const { data: ultima } = await supabase
    .from('lancamentos')
    .select('data_vencimento')
    .eq('despesa_fixa_id', despesa.id)
    .order('data_vencimento', { ascending: false })
    .limit(1)
    .maybeSingle()

  const baseData = ultima ? new Date(ultima.data_vencimento) : new Date()

  const novasParcelas = Array.from({ length: faltam }).map((_, i) => {
    const data = new Date(baseData)
    data.setMonth(data.getMonth() + i + 1)
    const vencimentoStr = data.toISOString().slice(0, 10)

    return {
      despesa_fixa_id: despesa.id,
      tipo: 'despesa',
      descricao: despesa.descricao,
      valor: despesa.valor,
      banco_id: despesa.banco_id,
      plano_conta_id: despesa.plano_conta_id,
      data_vencimento: vencimentoStr,
      // competência desloca junto com o vencimento (diferente do Contrato,
      // onde a competência é fixa) — conforme decidido pra Despesas Fixas
      data_competencia: vencimentoStr,
      situacao: 'pendente',
    }
  })

  await supabase.from('lancamentos').insert(novasParcelas)
}
