-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0068: modelos de projeto (projetos com etapas pré-definidas)
-- ============================================================

create table if not exists modelos_projeto (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  criado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists modelos_projeto_etapas (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references modelos_projeto(id) on delete cascade,
  titulo text not null,
  ordem integer not null default 0
);
create index if not exists idx_modelos_projeto_etapas_modelo on modelos_projeto_etapas (modelo_id, ordem);

alter table modelos_projeto enable row level security;
create policy "Usuarios autenticados - modelos_projeto" on modelos_projeto
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table modelos_projeto_etapas enable row level security;
create policy "Usuarios autenticados - modelos_projeto_etapas" on modelos_projeto_etapas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Marca uma tarefa como "projeto" (pra diferenciar visualmente de tarefa comum)
alter table tarefas add column if not exists eh_projeto boolean not null default false;
