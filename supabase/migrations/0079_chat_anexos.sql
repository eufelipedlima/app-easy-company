-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0079: anexos de arquivo no Chat (qualquer tipo, não só áudio)
-- ============================================================

alter table chat_mensagens add column if not exists arquivo_url text;
alter table chat_mensagens add column if not exists arquivo_nome text;
alter table chat_mensagens add column if not exists arquivo_tipo text;
alter table chat_mensagens add column if not exists arquivo_tamanho bigint;

insert into storage.buckets (id, name, public)
values ('chat-arquivos', 'chat-arquivos', true)
on conflict (id) do nothing;

drop policy if exists "Leitura publica - chat-arquivos" on storage.objects;
create policy "Leitura publica - chat-arquivos" on storage.objects
  for select using (bucket_id = 'chat-arquivos');

drop policy if exists "Upload autenticado - chat-arquivos" on storage.objects;
create policy "Upload autenticado - chat-arquivos" on storage.objects
  for insert with check (bucket_id = 'chat-arquivos' and auth.role() = 'authenticated');

drop policy if exists "Exclusao autenticada - chat-arquivos" on storage.objects;
create policy "Exclusao autenticada - chat-arquivos" on storage.objects
  for delete using (bucket_id = 'chat-arquivos' and auth.role() = 'authenticated');
