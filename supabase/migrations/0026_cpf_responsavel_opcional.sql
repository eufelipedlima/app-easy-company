-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0026: CPF do responsável passa a ser opcional
-- ============================================================

alter table responsaveis alter column cpf drop not null;
