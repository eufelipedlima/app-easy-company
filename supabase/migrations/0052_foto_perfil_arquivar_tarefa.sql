-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0052: foto de perfil + arquivar tarefa
-- ============================================================

alter table pessoas add column if not exists foto_url text;
alter table tarefas add column if not exists arquivada boolean not null default false;

insert into storage.buckets (id, name, public)
values ('perfis', 'perfis', true)
on conflict (id) do nothing;

drop policy if exists "Leitura publica - perfis" on storage.objects;
create policy "Leitura publica - perfis" on storage.objects
  for select using (bucket_id = 'perfis');

drop policy if exists "Upload autenticado - perfis" on storage.objects;
create policy "Upload autenticado - perfis" on storage.objects
  for insert with check (bucket_id = 'perfis' and auth.role() = 'authenticated');

drop policy if exists "Atualizacao autenticada - perfis" on storage.objects;
create policy "Atualizacao autenticada - perfis" on storage.objects
  for update using (bucket_id = 'perfis' and auth.role() = 'authenticated');
