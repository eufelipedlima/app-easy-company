-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0090: Arquivar membro em Meu Time
-- ============================================================

alter table funcionarios add column if not exists oculto_equipe boolean not null default false;
