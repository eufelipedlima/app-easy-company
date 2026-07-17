-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0031: data de competência fixa no contrato
-- ============================================================

alter table contratos add column if not exists data_competencia date;
