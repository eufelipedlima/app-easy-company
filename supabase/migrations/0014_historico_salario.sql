-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0014: histórico de reajuste/aumento salarial
-- ============================================================

create table if not exists funcionario_historico_salario (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  tipo text not null check (tipo in ('aumento', 'reajuste')),
  salario_anterior numeric(10,2) not null,
  salario_novo numeric(10,2) not null,
  data_alteracao date not null,
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists idx_historico_salario_funcionario on funcionario_historico_salario (funcionario_id);

alter table funcionario_historico_salario enable row level security;
create policy "Usuarios autenticados - historico_salario" on funcionario_historico_salario
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
