-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0015: tipo "transferência" nos lançamentos
-- ============================================================

alter table lancamentos drop constraint if exists lancamentos_tipo_check;
alter table lancamentos add constraint lancamentos_tipo_check
  check (tipo in ('receita', 'despesa', 'transferencia'));
