-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0039: formato do post (Estático/Carrossel/Vídeo)
-- ============================================================

alter table posts_conteudo add column if not exists formato text check (formato in ('estatico', 'carrossel', 'video'));
