-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0018: controle de última verificação de parcelas futuras
-- ============================================================

alter table contratos add column if not exists ultima_verificacao_parcelas timestamptz;
