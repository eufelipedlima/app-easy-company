-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0050: comentários em tarefas
-- ============================================================

create table if not exists tarefas_comentarios (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  autor_id uuid not null references auth.users(id),
  texto text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tarefas_comentarios_tarefa on tarefas_comentarios (tarefa_id, created_at);

alter table tarefas_comentarios enable row level security;
create policy "Usuarios autenticados - tarefas_comentarios" on tarefas_comentarios
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table tarefas_comentarios;
