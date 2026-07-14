-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0007: valor de entrada (pagamento proporcional inicial)
-- ============================================================

alter table contratos add column if not exists valor_entrada numeric(10,2);
