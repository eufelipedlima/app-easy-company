-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0024: origem do cliente (lista cadastrável)
-- ============================================================

create table if not exists origens (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);

alter table origens enable row level security;
create policy "Usuarios autenticados - origens" on origens
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table pessoas add column if not exists origem_id uuid references origens(id);
