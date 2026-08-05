-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0061: realtime nos comentários de aprovação do cliente
-- ============================================================

alter publication supabase_realtime add table posts_conteudo_comentarios;
