-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0029: histórico de reajuste de valor do contrato recorrente
-- ============================================================

create table if not exists contrato_historico_valor (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos(id) on delete cascade,
  valor_anterior numeric(10,2) not null,
  valor_novo numeric(10,2) not null,
  data_reajuste date not null,
  motivo text,
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists idx_contrato_historico_valor_contrato on contrato_historico_valor (contrato_id);

alter table contrato_historico_valor enable row level security;
create policy "Usuarios autenticados - contrato_historico_valor" on contrato_historico_valor
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
