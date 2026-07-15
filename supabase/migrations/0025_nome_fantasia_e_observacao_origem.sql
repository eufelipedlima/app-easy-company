-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0025: nome fantasia (PF) + observação da origem
-- ============================================================

alter table pessoas add column if not exists nome_fantasia text;
alter table pessoas add column if not exists observacao_origem text;
