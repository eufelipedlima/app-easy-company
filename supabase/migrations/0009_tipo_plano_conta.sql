-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0009: tipo (receita/despesa) no plano de conta
-- ============================================================

alter table planos_conta add column if not exists tipo text not null default 'receita'
  check (tipo in ('receita', 'despesa'));

alter table planos_conta alter column tipo drop default;
