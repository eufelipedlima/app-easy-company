-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0085: Academy — progresso da equipe (aulas concluídas)
-- ============================================================

create table if not exists academy_progresso (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  tema_id uuid not null references academy_temas(id) on delete cascade,
  concluido_em timestamptz not null default now(),
  constraint progresso_unico unique (funcionario_id, tema_id)
);

create index if not exists idx_academy_progresso_funcionario on academy_progresso (funcionario_id);
create index if not exists idx_academy_progresso_tema on academy_progresso (tema_id);

alter table academy_progresso enable row level security;

create policy "Usuarios autenticados - academy_progresso" on academy_progresso
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
