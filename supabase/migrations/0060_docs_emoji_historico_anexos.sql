-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0060: emoji do doc + histórico de alterações + anexos
-- ============================================================

alter table docs add column if not exists emoji text;

create table if not exists docs_historico (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references docs(id) on delete cascade,
  autor_id uuid references auth.users(id),
  descricao text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_docs_historico_doc on docs_historico (doc_id, created_at);
alter table docs_historico enable row level security;
create policy "Usuarios autenticados - docs_historico" on docs_historico
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('docs-anexos', 'docs-anexos', true)
on conflict (id) do nothing;

drop policy if exists "Leitura publica - docs-anexos" on storage.objects;
create policy "Leitura publica - docs-anexos" on storage.objects
  for select using (bucket_id = 'docs-anexos');

drop policy if exists "Upload autenticado - docs-anexos" on storage.objects;
create policy "Upload autenticado - docs-anexos" on storage.objects
  for insert with check (bucket_id = 'docs-anexos' and auth.role() = 'authenticated');
