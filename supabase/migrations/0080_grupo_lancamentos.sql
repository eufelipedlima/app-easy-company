-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0080: campo "Grupo" em lançamentos e despesas fixas
-- (pra separar categorias tipo "Cartão de Crédito" e conseguir
-- filtrar por isso na tela de Lançamentos)
-- ============================================================

alter table lancamentos add column if not exists grupo text;
alter table despesas_fixas add column if not exists grupo text;

create index if not exists idx_lancamentos_grupo on lancamentos (grupo);
