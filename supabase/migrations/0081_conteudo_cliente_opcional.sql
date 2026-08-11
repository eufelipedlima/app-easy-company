-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0081: permite criar um conteúdo sem cliente selecionado
-- (corrige o bug de "DMK Soluções" vindo pré-selecionado sozinho)
-- ============================================================

alter table posts_conteudo alter column cliente_id drop not null;
