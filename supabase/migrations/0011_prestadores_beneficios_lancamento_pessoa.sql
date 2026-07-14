-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0011: prestadores, benefícios de funcionário,
-- e lançamento ligado a qualquer pessoa (não só cliente)
-- ============================================================

create table if not exists prestadores (
  id uuid primary key default gen_random_uuid(),
  papel_id uuid not null references papeis(id) on delete cascade,
  tipo_servico text,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint papel_prestador_unico unique (papel_id)
);

alter table prestadores enable row level security;
create policy "Usuarios autenticados - prestadores" on prestadores
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop trigger if exists trg_prestadores_updated_at on prestadores;
create trigger trg_prestadores_updated_at before update on prestadores
  for each row execute function set_updated_at();

create table if not exists funcionario_beneficios (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  nome text not null,
  valor numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_beneficios_funcionario on funcionario_beneficios (funcionario_id);

alter table funcionario_beneficios enable row level security;
create policy "Usuarios autenticados - funcionario_beneficios" on funcionario_beneficios
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Lançamento passa a poder se ligar a qualquer pessoa (funcionário, prestador ou cliente),
-- não só a um registro de cliente
alter table lancamentos add column if not exists pessoa_id uuid references pessoas(id);
