-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0086: Academy — permissão por treinamento (página), não por categoria
-- ============================================================

-- Categoria vira só uma pasta organizacional; quem pode ver o quê agora se
-- decide treinamento por treinamento — mais flexível (dá pra ter treinamento
-- público e restrito dentro da mesma categoria).

alter table academy_paginas add column if not exists cargos_permitidos uuid[];

-- A coluna cargos_permitidos de academy_categorias deixa de ser usada pela
-- tela, mas não apago ela pra não perder nada — se algum dia quiser reativar
-- permissão por categoria também, o dado ainda está lá.
