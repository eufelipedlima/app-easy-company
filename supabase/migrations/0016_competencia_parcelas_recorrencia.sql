-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0016: data de competência + parcelado/recorrente
-- ============================================================

alter table lancamentos add column if not exists data_competencia date;
alter table lancamentos add column if not exists grupo_id uuid;
alter table lancamentos add column if not exists numero_parcela integer;
alter table lancamentos add column if not exists total_parcelas integer;
alter table lancamentos add column if not exists recorrencia_tipo text
  check (recorrencia_tipo in ('mensal', 'semanal', 'anual'));

create index if not exists idx_lancamentos_grupo on lancamentos (grupo_id);
