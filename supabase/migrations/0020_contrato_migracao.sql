-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0020: modo "contrato já existente" (migração de clientes antigos)
-- ============================================================

alter table contratos add column if not exists eh_migracao boolean not null default false;
alter table contratos add column if not exists valor_pago_historico numeric(10,2);
alter table contratos add column if not exists data_proxima_cobranca date;
