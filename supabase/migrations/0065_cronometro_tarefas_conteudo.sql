-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0065: cronômetro manual (tempo gasto) em Tarefas e Conteúdo
-- ============================================================

alter table tarefas add column if not exists tempo_total_segundos integer not null default 0;
alter table tarefas add column if not exists timer_iniciado_em timestamptz;
alter table tarefas add column if not exists timer_iniciado_por uuid references auth.users(id);

alter table posts_conteudo add column if not exists tempo_total_segundos integer not null default 0;
alter table posts_conteudo add column if not exists timer_iniciado_em timestamptz;
alter table posts_conteudo add column if not exists timer_iniciado_por uuid references auth.users(id);
