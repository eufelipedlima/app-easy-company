-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0102: Rotinas — simplificação (tarefa individual, sem "caixa")
-- ============================================================
-- Troca o modelo "Rotina (container) → vários Itens dentro" por tarefas
-- recorrentes independentes: cada linha JÁ é a tarefa completa (nome,
-- frequência, dias, responsável). Um campo "grupo" (texto livre,
-- opcional) permite juntar visualmente tarefas relacionadas quando fizer
-- sentido — sem exigir nada.
--
-- Como essa funcionalidade acabou de ser criada, presumimos que ainda não
-- tem dado real cadastrado — essa migration apaga e recria as tabelas do
-- zero. Se você já tinha cadastrado alguma rotina de teste importante,
-- me avisa antes de rodar isso.

drop table if exists rotina_execucoes;
drop table if exists rotina_responsaveis_funcionario;
drop table if exists rotina_responsaveis_cargo;
drop table if exists rotina_itens;
drop table if exists rotinas;

create table rotinas (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  descricao text,
  grupo text,
  frequencia text not null default 'diaria' check (frequencia in ('diaria', 'semanal', 'mensal')),
  dias_semana integer[],
  dia_mes integer,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_por uuid references auth.users(id),
  criado_em timestamptz not null default now()
);

create table rotina_responsaveis_cargo (
  rotina_id uuid not null references rotinas(id) on delete cascade,
  cargo_id uuid not null references cargos(id) on delete cascade,
  primary key (rotina_id, cargo_id)
);

create table rotina_responsaveis_funcionario (
  rotina_id uuid not null references rotinas(id) on delete cascade,
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  primary key (rotina_id, funcionario_id)
);

create table rotina_execucoes (
  id uuid primary key default gen_random_uuid(),
  rotina_id uuid not null references rotinas(id) on delete cascade,
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  data_referencia date not null,
  concluido_em timestamptz not null default now(),
  unique (rotina_id, funcionario_id, data_referencia)
);
create index idx_rotina_execucoes_data on rotina_execucoes (data_referencia);

alter table rotinas enable row level security;
alter table rotina_responsaveis_cargo enable row level security;
alter table rotina_responsaveis_funcionario enable row level security;
alter table rotina_execucoes enable row level security;

create policy "Usuarios autenticados - rotinas" on rotinas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Usuarios autenticados - rotina_responsaveis_cargo" on rotina_responsaveis_cargo
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Usuarios autenticados - rotina_responsaveis_funcionario" on rotina_responsaveis_funcionario
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Usuarios autenticados - rotina_execucoes" on rotina_execucoes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
