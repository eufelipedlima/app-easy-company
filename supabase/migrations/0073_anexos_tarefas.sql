-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0073: anexos genéricos em tarefas
-- ============================================================

create table if not exists tarefas_anexos (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  arquivo_path text not null,
  arquivo_nome text,
  arquivo_tipo text,
  tamanho_bytes bigint,
  enviado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_tarefas_anexos_tarefa on tarefas_anexos (tarefa_id);

alter table tarefas_anexos enable row level security;
create policy "Usuarios autenticados - tarefas_anexos" on tarefas_anexos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('tarefas-anexos', 'tarefas-anexos', true)
on conflict (id) do nothing;

drop policy if exists "Leitura publica - tarefas-anexos" on storage.objects;
create policy "Leitura publica - tarefas-anexos" on storage.objects
  for select using (bucket_id = 'tarefas-anexos');

drop policy if exists "Upload autenticado - tarefas-anexos" on storage.objects;
create policy "Upload autenticado - tarefas-anexos" on storage.objects
  for insert with check (bucket_id = 'tarefas-anexos' and auth.role() = 'authenticated');

drop policy if exists "Exclusao autenticada - tarefas-anexos" on storage.objects;
create policy "Exclusao autenticada - tarefas-anexos" on storage.objects
  for delete using (bucket_id = 'tarefas-anexos' and auth.role() = 'authenticated');
