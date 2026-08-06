-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0071: onboarding no primeiro acesso (apelido + avatar)
-- ============================================================

alter table funcionarios add column if not exists perfil_completo boolean not null default true;
