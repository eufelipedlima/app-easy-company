-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0055: data de início + sub-conteúdos (post pai/filho)
-- ============================================================

alter table posts_conteudo add column if not exists data_inicio date;
alter table posts_conteudo add column if not exists post_pai_id uuid references posts_conteudo(id) on delete cascade;

create index if not exists idx_posts_conteudo_pai on posts_conteudo (post_pai_id);
