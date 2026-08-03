-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0040: título do post + novos objetivos
-- ============================================================

alter table posts_conteudo add column if not exists titulo text;

alter table posts_conteudo drop constraint if exists posts_conteudo_objetivo_check;
alter table posts_conteudo add constraint posts_conteudo_objetivo_check check (objetivo in (
  'atracao', 'educacao', 'conversao', 'conexao', 'institucional', 'bastidores'
));
