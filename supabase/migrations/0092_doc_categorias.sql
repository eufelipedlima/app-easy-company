-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0092: Categorias de Docs (tags coloridas)
-- ============================================================

create table if not exists doc_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cor text not null default 'cinza',
  created_at timestamptz not null default now()
);

alter table doc_categorias enable row level security;
create policy "Usuarios autenticados - doc_categorias" on doc_categorias
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table docs add column if not exists categoria_id uuid references doc_categorias(id) on delete set null;

-- Umas categorias já prontas pra começar — pode editar/apagar/criar outras
-- normalmente depois.
insert into doc_categorias (nome, cor) values
  ('Branding', 'verde'),
  ('Planejamento', 'roxo'),
  ('Estratégia', 'vermelho'),
  ('Operacional', 'amarelo'),
  ('Geral', 'cinza')
on conflict (nome) do nothing;
