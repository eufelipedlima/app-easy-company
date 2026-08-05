-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0063: mensagens de áudio no Chat
-- ============================================================

alter table chat_mensagens add column if not exists audio_url text;
alter table chat_mensagens add column if not exists audio_duracao integer;

insert into storage.buckets (id, name, public)
values ('chat-audio', 'chat-audio', true)
on conflict (id) do nothing;

drop policy if exists "Leitura publica - chat-audio" on storage.objects;
create policy "Leitura publica - chat-audio" on storage.objects
  for select using (bucket_id = 'chat-audio');

drop policy if exists "Upload autenticado - chat-audio" on storage.objects;
create policy "Upload autenticado - chat-audio" on storage.objects
  for insert with check (bucket_id = 'chat-audio' and auth.role() = 'authenticated');
