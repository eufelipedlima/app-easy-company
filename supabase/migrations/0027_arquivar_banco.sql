-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0027: arquivar banco
-- ============================================================

alter table bancos add column if not exists ativo boolean not null default true;
