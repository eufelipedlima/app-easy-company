-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0109: Editar/excluir comentários
-- ============================================================
-- Só guarda QUANDO um comentário foi editado (pra mostrar "(editado)" na
-- tela) — excluir não precisa de coluna nova, é a linha sumindo mesmo.

alter table tarefas_comentarios add column if not exists editado_em timestamptz;
alter table posts_conteudo_comentarios_internos add column if not exists editado_em timestamptz;
