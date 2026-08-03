-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0041: responsável (funcionário) por post de conteúdo
-- ============================================================

alter table posts_conteudo add column if not exists responsavel_id uuid references funcionarios(id);
