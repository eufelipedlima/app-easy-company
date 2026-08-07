-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0075: ordem manual (arrastar pra reordenar) em
-- subtarefas e sub-conteúdos
-- ============================================================

alter table tarefas add column if not exists ordem integer not null default 0;
alter table posts_conteudo add column if not exists ordem integer not null default 0;
