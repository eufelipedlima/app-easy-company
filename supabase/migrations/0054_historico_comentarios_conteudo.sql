-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0054: histórico de alterações + comentários internos do conteúdo
-- ============================================================

-- Histórico de alterações — genérico, reutilizado por Tarefas e Conteúdo
create table if not exists tarefas_historico (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  autor_id uuid references auth.users(id),
  descricao text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_tarefas_historico_tarefa on tarefas_historico (tarefa_id, created_at);
alter table tarefas_historico enable row level security;
create policy "Usuarios autenticados - tarefas_historico" on tarefas_historico
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create table if not exists posts_conteudo_historico (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts_conteudo(id) on delete cascade,
  autor_id uuid references auth.users(id),
  descricao text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_posts_historico_post on posts_conteudo_historico (post_id, created_at);
alter table posts_conteudo_historico enable row level security;
create policy "Usuarios autenticados - posts_conteudo_historico" on posts_conteudo_historico
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Comentários internos do conteúdo (separado dos comentários que o CLIENTE vê
-- na aprovação — esses aqui são só pra equipe, com @menção)
create table if not exists posts_conteudo_comentarios_internos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts_conteudo(id) on delete cascade,
  autor_id uuid not null references auth.users(id),
  texto text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_posts_comentarios_internos_post on posts_conteudo_comentarios_internos (post_id, created_at);
alter table posts_conteudo_comentarios_internos enable row level security;
create policy "Usuarios autenticados - posts_conteudo_comentarios_internos" on posts_conteudo_comentarios_internos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table posts_conteudo_comentarios_internos;

-- Responsáveis por post também virando múltiplos, igual tarefas
create table if not exists posts_conteudo_responsaveis (
  post_id uuid not null references posts_conteudo(id) on delete cascade,
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  primary key (post_id, funcionario_id)
);
alter table posts_conteudo_responsaveis enable row level security;
create policy "Usuarios autenticados - posts_conteudo_responsaveis" on posts_conteudo_responsaveis
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into posts_conteudo_responsaveis (post_id, funcionario_id)
select id, responsavel_id from posts_conteudo where responsavel_id is not null
on conflict do nothing;
