-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0059: docs em árvore (sub-documentos)
-- ============================================================

alter table docs add column if not exists doc_pai_id uuid references docs(id) on delete cascade;
create index if not exists idx_docs_pai on docs (doc_pai_id);
