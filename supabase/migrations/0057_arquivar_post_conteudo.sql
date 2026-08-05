-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0057: arquivar post de conteúdo
-- ============================================================

alter table posts_conteudo add column if not exists arquivado boolean not null default false;
