-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0088: Academy — abas de Materiais, Notas e Dúvidas por aula
-- ============================================================

-- Materiais de apoio (PDF, DOCX etc.) por aula
create table if not exists academy_temas_materiais (
  id uuid primary key default gen_random_uuid(),
  tema_id uuid not null references academy_temas(id) on delete cascade,
  nome text not null,
  arquivo_path text not null,
  arquivo_tipo text,
  arquivo_tamanho int,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_academy_materiais_tema on academy_temas_materiais (tema_id);

-- Anotação pessoal e privada de cada colaborador em cada aula
create table if not exists academy_temas_notas (
  id uuid primary key default gen_random_uuid(),
  tema_id uuid not null references academy_temas(id) on delete cascade,
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  texto text,
  updated_at timestamptz not null default now(),
  constraint nota_unica unique (tema_id, funcionario_id)
);
create index if not exists idx_academy_notas_tema_func on academy_temas_notas (tema_id, funcionario_id);

-- Mural de dúvidas — pergunta pública dentro da aula, qualquer um do time pode ver/responder
create table if not exists academy_temas_duvidas (
  id uuid primary key default gen_random_uuid(),
  tema_id uuid not null references academy_temas(id) on delete cascade,
  autor_id uuid not null,
  texto text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_academy_duvidas_tema on academy_temas_duvidas (tema_id);

alter table academy_temas_materiais enable row level security;
alter table academy_temas_notas enable row level security;
alter table academy_temas_duvidas enable row level security;

create policy "Usuarios autenticados - academy_temas_materiais" on academy_temas_materiais
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Usuarios autenticados - academy_temas_duvidas" on academy_temas_duvidas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Notas são privadas: só quem escreveu mexe nelas (o funcionario_id precisa bater com quem está logado)
create policy "Cada um ve e edita so a propria nota" on academy_temas_notas
  for all using (
    exists (select 1 from funcionarios f where f.id = academy_temas_notas.funcionario_id and f.auth_user_id = auth.uid())
  )
  with check (
    exists (select 1 from funcionarios f where f.id = academy_temas_notas.funcionario_id and f.auth_user_id = auth.uid())
  );

drop trigger if exists trg_academy_notas_updated_at on academy_temas_notas;
create trigger trg_academy_notas_updated_at before update on academy_temas_notas
  for each row execute function set_updated_at();

insert into storage.buckets (id, name, public)
values ('academy-materiais', 'academy-materiais', true)
on conflict (id) do nothing;

drop policy if exists "Leitura publica - academy-materiais" on storage.objects;
create policy "Leitura publica - academy-materiais" on storage.objects
  for select using (bucket_id = 'academy-materiais');

drop policy if exists "Upload autenticado - academy-materiais" on storage.objects;
create policy "Upload autenticado - academy-materiais" on storage.objects
  for insert with check (bucket_id = 'academy-materiais' and auth.role() = 'authenticated');

drop policy if exists "Delete autenticado - academy-materiais" on storage.objects;
create policy "Delete autenticado - academy-materiais" on storage.objects
  for delete using (bucket_id = 'academy-materiais' and auth.role() = 'authenticated');
