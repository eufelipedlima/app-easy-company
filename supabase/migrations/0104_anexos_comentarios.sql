-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0104: Anexos em comentários (Tarefas e Conteúdo)
-- ============================================================
-- Permite anexar arquivos (foto, áudio, documento) em qualquer comentário
-- de tarefa/conteúdo — mesma lógica dos Anexos já existentes na tarefa,
-- só que ligados a um comentário específico em vez da tarefa toda.

create table if not exists tarefas_comentarios_anexos (
  id uuid primary key default gen_random_uuid(),
  comentario_id uuid not null references tarefas_comentarios(id) on delete cascade,
  arquivo_path text not null,
  arquivo_nome text,
  arquivo_tipo text,
  tamanho_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists idx_tarefas_com_anexos_comentario on tarefas_comentarios_anexos (comentario_id);

create table if not exists posts_conteudo_comentarios_internos_anexos (
  id uuid primary key default gen_random_uuid(),
  comentario_id uuid not null references posts_conteudo_comentarios_internos(id) on delete cascade,
  arquivo_path text not null,
  arquivo_nome text,
  arquivo_tipo text,
  tamanho_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists idx_posts_com_anexos_comentario on posts_conteudo_comentarios_internos_anexos (comentario_id);

alter table tarefas_comentarios_anexos enable row level security;
alter table posts_conteudo_comentarios_internos_anexos enable row level security;

create policy "Usuarios autenticados - tarefas_comentarios_anexos" on tarefas_comentarios_anexos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Usuarios autenticados - posts_conteudo_comentarios_internos_anexos" on posts_conteudo_comentarios_internos_anexos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Buckets de armazenamento (público pra leitura, só autenticado sobe/apaga)
insert into storage.buckets (id, name, public)
values ('tarefas-comentarios-anexos', 'tarefas-comentarios-anexos', true)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
values ('conteudo-comentarios-anexos', 'conteudo-comentarios-anexos', true)
on conflict (id) do nothing;

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
