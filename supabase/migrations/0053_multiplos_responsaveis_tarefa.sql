-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0053: múltiplos responsáveis por tarefa
-- ============================================================

create table if not exists tarefas_responsaveis (
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  primary key (tarefa_id, funcionario_id)
);

create index if not exists idx_tarefas_responsaveis_tarefa on tarefas_responsaveis (tarefa_id);
create index if not exists idx_tarefas_responsaveis_funcionario on tarefas_responsaveis (funcionario_id);

alter table tarefas_responsaveis enable row level security;
create policy "Usuarios autenticados - tarefas_responsaveis" on tarefas_responsaveis
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Migra quem já tinha um responsável único pra tabela nova (sem perder nada)
insert into tarefas_responsaveis (tarefa_id, funcionario_id)
select id, responsavel_id from tarefas where responsavel_id is not null
on conflict do nothing;
