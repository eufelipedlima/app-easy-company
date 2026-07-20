// snippet a integrar no LancamentoForm.tsx (ou no modal de "Pagar"),
// tanto no fluxo de CRIAR um lançamento novo já com pagamento marcado,
// quanto no fluxo de DAR BAIXA em um lançamento existente.
//
// Assume que taxa/desconto são salvos junto do registro em
// lancamento_pagamentos (data, banco, valor, taxa, desconto) — tabela
// que já existe no schema pelos pagamentos parciais.

import { useState } from 'react'

type Tipo = 'receita' | 'despesa'

export function CamposTaxaDesconto({
  taxa,
  desconto,
  onChangeTaxa,
  onChangeDesconto,
}: {
  taxa: number
  desconto: number
  onChangeTaxa: (v: number) => void
  onChangeDesconto: (v: number) => void
}) {
  return (
    <div className="form-row">
      <label>
        Taxa (opcional)
        <input
          type="number"
          step="0.01"
          min="0"
          value={taxa || ''}
          onChange={(e) => onChangeTaxa(parseFloat(e.target.value) || 0)}
          placeholder="0,00"
        />
      </label>
      <label>
        Desconto (opcional)
        <input
          type="number"
          step="0.01"
          min="0"
          value={desconto || ''}
          onChange={(e) => onChangeDesconto(parseFloat(e.target.value) || 0)}
          placeholder="0,00"
        />
      </label>
    </div>
  )
}

// Cálculo do valor líquido que efetivamente reflete no saldo do banco.
// Regra combinada: taxa e desconto sempre reduzem o valor líquido,
// independente do tipo (receita ou despesa) — ajuste aqui se quiser
// um comportamento diferente por tipo.
export function calcularValorLiquido(valorPago: number, taxa: number, desconto: number) {
  return valorPago - taxa - desconto
}

// Exemplo de uso no form:
//
// const [taxa, setTaxa] = useState(0)
// const [desconto, setDesconto] = useState(0)
// const valorLiquido = calcularValorLiquido(valorPago, taxa, desconto)
//
// async function salvarPagamento() {
//   await supabase.from('lancamento_pagamentos').insert({
//     lancamento_id: lancamento.id,
//     data: dataPagamento,
//     banco: bancoId,
//     valor: valorPago,
//     taxa,
//     desconto,
//   })
//   // valorLiquido é o que soma no saldo do banco (via trigger ou cálculo
//   // do saldo já existente, que já lê de lancamento_pagamentos)
// }
