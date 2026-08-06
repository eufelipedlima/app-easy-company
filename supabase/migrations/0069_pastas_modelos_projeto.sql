-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0069: pastas dentro dos modelos de projeto
-- ============================================================

alter table modelos_projeto_etapas add column if not exists etapa_pai_id uuid references modelos_projeto_etapas(id) on delete cascade;
create index if not exists idx_modelos_projeto_etapas_pai on modelos_projeto_etapas (etapa_pai_id);
