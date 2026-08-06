-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0072: modelo de projeto vira uma tarefa especial
-- (ganha a mesma tela completa de tarefa/projeto automaticamente)
-- ============================================================

alter table tarefas add column if not exists eh_modelo_projeto boolean not null default false;
