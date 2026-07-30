-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0037: marca quais serviços geram calendário de conteúdo
-- ============================================================

alter table servicos add column if not exists gera_calendario_conteudo boolean not null default false;
