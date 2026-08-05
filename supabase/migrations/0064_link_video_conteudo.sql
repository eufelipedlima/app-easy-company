-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0064: link de vídeo externo (Drive) pra posts de formato vídeo
-- ============================================================

alter table posts_conteudo add column if not exists link_video text;
