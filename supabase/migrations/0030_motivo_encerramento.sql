-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0030: motivo de encerramento do contrato
-- ============================================================

alter table contratos add column if not exists motivo_encerramento text;
alter table contratos add column if not exists observacao_encerramento text;
