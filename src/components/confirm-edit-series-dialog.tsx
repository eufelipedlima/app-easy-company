// components/confirm-edit-series-dialog.tsx
//
// Reutiliza o mesmo padrão já usado em Lançamentos recorrentes/parcelados
// ("Apenas este" / "Este e os próximos"), aplicado agora à edição de um
// lançamento gerado por Despesa Fixa.
//
// Uso: antes de salvar a edição de um lançamento que tenha despesa_fixa_id,
// abra esse dialog e só prossiga com o PATCH depois da escolha do usuário.

type Escopo = 'apenas_este' | 'este_e_proximos'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (escopo: Escopo) => void
}

export function ConfirmEditSeriesDialog({ open, onClose, onConfirm }: Props) {
  if (!open) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Editar Despesa Fixa</h3>
        <p>Esse lançamento faz parte de uma série mensal. O que você quer editar?</p>
        <div className="modal-actions">
          <button onClick={() => onConfirm('apenas_este')}>Apenas este</button>
          <button onClick={() => onConfirm('este_e_proximos')}>Este e os próximos</button>
          <button onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// Exemplo de uso dentro do form de edição:
//
// const [confirmOpen, setConfirmOpen] = useState(false)
//
// function handleSalvar() {
//   if (lancamento.despesa_fixa_id) {
//     setConfirmOpen(true)
//     return
//   }
//   salvarEdicao('apenas_este')
// }
//
// <ConfirmEditSeriesDialog
//   open={confirmOpen}
//   onClose={() => setConfirmOpen(false)}
//   onConfirm={(escopo) => { setConfirmOpen(false); salvarEdicao(escopo) }}
// />
