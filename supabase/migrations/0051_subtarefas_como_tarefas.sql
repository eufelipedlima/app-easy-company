-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0051: subtarefas viram tarefas de verdade (com tarefa-mãe)
-- ============================================================

alter table tarefas add column if not exists tarefa_pai_id uuid references tarefas(id) on delete cascade;

create index if not exists idx_tarefas_pai on tarefas (tarefa_pai_id);
