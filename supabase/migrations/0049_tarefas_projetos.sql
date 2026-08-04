-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0049: Tarefas / Projetos
-- ============================================================

create table if not exists tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  cliente_id uuid references clientes(id) on delete cascade,
  responsavel_id uuid references funcionarios(id),
  status_id uuid not null references status_conteudo(id),
  prioridade text check (prioridade in ('baixa', 'media', 'alta')),
  data_inicio date,
  prazo date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tarefas_cliente on tarefas (cliente_id);
create index if not exists idx_tarefas_status on tarefas (status_id);

alter table tarefas enable row level security;
create policy "Usuarios autenticados - tarefas" on tarefas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop trigger if exists trg_tarefas_updated_at on tarefas;
create trigger trg_tarefas_updated_at before update on tarefas
  for each row execute function set_updated_at();

create table if not exists tarefas_subtarefas (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  titulo text not null,
  concluida boolean not null default false,
  ordem integer not null default 0
);

create index if not exists idx_subtarefas_tarefa on tarefas_subtarefas (tarefa_id);

alter table tarefas_subtarefas enable row level security;
create policy "Usuarios autenticados - tarefas_subtarefas" on tarefas_subtarefas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Nova área do sistema, pra já entrar no controle de permissões existente
insert into areas_sistema (nome, slug, ordem) values ('Tarefas', 'tarefas', 6)
on conflict (slug) do nothing;

insert into perfis_acesso_areas (perfil_id, area_id, nivel)
select p.id, a.id, 'completo'
from perfis_acesso p, areas_sistema a
where p.nome = 'Administrador' and a.slug = 'tarefas'
on conflict (perfil_id, area_id) do update set nivel = 'completo';
