-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0012: cargos cadastráveis + tipo de contrato do funcionário
-- ============================================================

create table if not exists cargos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);

alter table cargos enable row level security;
create policy "Usuarios autenticados - cargos" on cargos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table funcionarios add column if not exists cargo_id uuid references cargos(id);
alter table funcionarios add column if not exists tipo_contrato text check (tipo_contrato in ('CLT', 'PJ'));
