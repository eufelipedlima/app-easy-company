-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0076: corrige permissões de upload/leitura do bucket
-- "conteudo-midia" (o bucket existia, mas nunca ganhou as políticas
-- de acesso — por isso os uploads de arte falhavam silenciosamente)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('conteudo-midia', 'conteudo-midia', true)
on conflict (id) do nothing;

drop policy if exists "Leitura publica - conteudo-midia" on storage.objects;
create policy "Leitura publica - conteudo-midia" on storage.objects
  for select using (bucket_id = 'conteudo-midia');

drop policy if exists "Upload autenticado - conteudo-midia" on storage.objects;
create policy "Upload autenticado - conteudo-midia" on storage.objects
  for insert with check (bucket_id = 'conteudo-midia' and auth.role() = 'authenticated');

drop policy if exists "Exclusao autenticada - conteudo-midia" on storage.objects;
create policy "Exclusao autenticada - conteudo-midia" on storage.objects
  for delete using (bucket_id = 'conteudo-midia' and auth.role() = 'authenticated');
