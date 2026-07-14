-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0013: benefício com valor por dia útil (ex: vale-alimentação)
-- ============================================================

alter table funcionario_beneficios add column if not exists tipo_valor text not null default 'mensal'
  check (tipo_valor in ('mensal', 'diario'));
