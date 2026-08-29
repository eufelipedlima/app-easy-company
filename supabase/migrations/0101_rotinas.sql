-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0101: Rotinas (tarefas recorrentes por cargo/pessoa)
-- ============================================================
-- Uma rotina não guarda "aconteceu ou não" pra cada dia — ela só guarda
-- a regra de repetição (ex: "toda segunda e quinta", ou "todo dia 5"). O
-- sistema calcula, na hora de exibir, se ela se aplica ao dia visto. O
-- que fica gravado é só a CONCLUSÃO, quando alguém marca como feito.
--
-- Diferente do sistema de origem: aqui uma rotina pode ser atribuída a um
-- CARGO inteiro (ex: "Social Media") — nesse caso, toda pessoa com esse
-- cargo vê a rotina no painel dela, e cada uma marca a própria conclusão
-- independentemente (não é um "feito por qualquer um do time conta pra
-- todo mundo"). Também dá pra atribuir a pessoas específicas, além ou no
-- lugar do cargo.

create table if not exists rotinas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  frequencia text not null default 'diaria' check (frequencia in ('diaria', 'semanal', 'mensal')),
  dias_semana integer[],
  dia_mes integer,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_por uuid references auth.users(id),
  criado_em timestamptz not null default now()
);

create table if not exists rotina_itens (
  id uuid primary key default gen_random_uuid(),
  rotina_id uuid not null references rotinas(id) on delete cascade,
  texto text not null,
  descricao text,
  ordem integer not null default 0
);

-- Uma rotina pode ser atribuída a um cargo inteiro...
create table if not exists rotina_responsaveis_cargo (
  rotina_id uuid not null references rotinas(id) on delete cascade,
  cargo_id uuid not null references cargos(id) on delete cascade,
  primary key (rotina_id, cargo_id)
);

-- ...e/ou a pessoas específicas (além do cargo, ou no lugar dele).
create table if not exists rotina_responsaveis_funcionario (
  rotina_id uuid not null references rotinas(id) on delete cascade,
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  primary key (rotina_id, funcionario_id)
);

-- Uma linha por item concluído, por pessoa, por dia. Desmarcar = apagar
-- a linha — a ausência dela já significa "essa pessoa não fez ainda".
create table if not exists rotina_execucoes (
  id uuid primary key default gen_random_uuid(),
  rotina_item_id uuid not null references rotina_itens(id) on delete cascade,
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  data_referencia date not null,
  concluido_em timestamptz not null default now(),
  unique (rotina_item_id, funcionario_id, data_referencia)
);
create index if not exists idx_rotina_execucoes_data on rotina_execucoes (data_referencia);

alter table rotinas enable row level security;
alter table rotina_itens enable row level security;
alter table rotina_responsaveis_cargo enable row level security;
alter table rotina_responsaveis_funcionario enable row level security;
alter table rotina_execucoes enable row level security;

create policy "Usuarios autenticados - rotinas" on rotinas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Usuarios autenticados - rotina_itens" on rotina_itens
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Usuarios autenticados - rotina_responsaveis_cargo" on rotina_responsaveis_cargo
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Usuarios autenticados - rotina_responsaveis_funcionario" on rotina_responsaveis_funcionario
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Usuarios autenticados - rotina_execucoes" on rotina_execucoes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
