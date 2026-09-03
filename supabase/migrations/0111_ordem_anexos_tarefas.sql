-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0111: Reordenar anexos de tarefa (arrastar e soltar)
-- ============================================================

alter table tarefas_anexos add column if not exists ordem integer not null default 0;

-- Dá uma ordem inicial pros anexos que já existem, na ordem em que foram
-- enviados (mais antigo primeiro) — assim nada muda de posição na
-- primeira vez que a tela carregar depois dessa migration.
with numerados as (
  select id, row_number() over (partition by tarefa_id order by created_at) - 1 as pos
  from tarefas_anexos
)
update tarefas_anexos t
set ordem = n.pos
from numerados n
where t.id = n.id;
