-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0093: Docs — descrição e link público de compartilhamento
-- ============================================================

alter table docs add column if not exists descricao text;
alter table docs add column if not exists link_publico_token uuid;

create unique index if not exists idx_docs_link_publico_token on docs (link_publico_token) where link_publico_token is not null;
