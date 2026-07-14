-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0019: banco e plano de conta no contrato
-- ============================================================

alter table contratos add column if not exists banco_id uuid references bancos(id);
alter table contratos add column if not exists plano_conta_id uuid references planos_conta(id);
