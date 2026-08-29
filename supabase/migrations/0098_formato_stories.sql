-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0098: Conteúdo — formato "Stories"
-- ============================================================

alter table posts_conteudo drop constraint if exists posts_conteudo_formato_check;
alter table posts_conteudo add constraint posts_conteudo_formato_check
  check (formato in ('estatico', 'carrossel', 'stories', 'video'));
