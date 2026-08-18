-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0091: Permitir conteúdo sem data de publicação
-- ============================================================

-- Antes, data_publicacao era obrigatória — tentar apagar a data na tela
-- falhava silenciosamente (o banco recusava a gravação, sem avisar).
-- Um post sem data de publicação simplesmente não aparece nas visões de
-- calendário (não tem onde encaixar), mas continua normal no Kanban e na
-- Lista.

alter table posts_conteudo alter column data_publicacao drop not null;
