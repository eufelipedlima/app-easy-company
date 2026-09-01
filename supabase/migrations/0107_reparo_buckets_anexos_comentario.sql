-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0107: Reparo — buckets de anexo de comentário
-- ============================================================
-- Confere e garante que os dois buckets de armazenamento dos anexos de
-- comentário (tarefas e conteúdo) existem, com as políticas certas —
-- caso a migration 0104 também não tenha rodado essa parte completa.

-- 1) Confira primeiro o que já existe:
select id, name, public from storage.buckets where id in ('tarefas-comentarios-anexos', 'conteudo-comentarios-anexos');

-- 2) Garante que os dois existem, marcados como públicos pra leitura:
insert into storage.buckets (id, name, public)
values ('tarefas-comentarios-anexos', 'tarefas-comentarios-anexos', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('conteudo-comentarios-anexos', 'conteudo-comentarios-anexos', true)
on conflict (id) do update set public = true;

-- 3) Garante as políticas de acesso (leitura pública, upload/exclusão só
-- autenticado) — refaz do zero pra garantir que estão certas.
drop policy if exists "Leitura publica - tarefas-comentarios-anexos" on storage.objects;
create policy "Leitura publica - tarefas-comentarios-anexos" on storage.objects
  for select using (bucket_id = 'tarefas-comentarios-anexos');
drop policy if exists "Upload autenticado - tarefas-comentarios-anexos" on storage.objects;
create policy "Upload autenticado - tarefas-comentarios-anexos" on storage.objects
  for insert with check (bucket_id = 'tarefas-comentarios-anexos' and auth.role() = 'authenticated');
drop policy if exists "Exclusao autenticada - tarefas-comentarios-anexos" on storage.objects;
create policy "Exclusao autenticada - tarefas-comentarios-anexos" on storage.objects
  for delete using (bucket_id = 'tarefas-comentarios-anexos' and auth.role() = 'authenticated');

drop policy if exists "Leitura publica - conteudo-comentarios-anexos" on storage.objects;
create policy "Leitura publica - conteudo-comentarios-anexos" on storage.objects
  for select using (bucket_id = 'conteudo-comentarios-anexos');
drop policy if exists "Upload autenticado - conteudo-comentarios-anexos" on storage.objects;
create policy "Upload autenticado - conteudo-comentarios-anexos" on storage.objects
  for insert with check (bucket_id = 'conteudo-comentarios-anexos' and auth.role() = 'authenticated');
drop policy if exists "Exclusao autenticada - conteudo-comentarios-anexos" on storage.objects;
create policy "Exclusao autenticada - conteudo-comentarios-anexos" on storage.objects
  for delete using (bucket_id = 'conteudo-comentarios-anexos' and auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';

-- 4) Confere de novo — deve mostrar os 2 buckets, com public = true:
select id, name, public from storage.buckets where id in ('tarefas-comentarios-anexos', 'conteudo-comentarios-anexos');
