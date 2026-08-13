-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0087: Academy — descrição curta, duração e dificuldade por tema
-- ============================================================

alter table academy_temas add column if not exists descricao text;
alter table academy_temas add column if not exists duracao_min int;
alter table academy_temas add column if not exists dificuldade text check (dificuldade in ('iniciante', 'intermediario', 'avancado'));
