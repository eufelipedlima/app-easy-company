-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0008: módulo financeiro (bancos, planos de conta, lançamentos)
-- ============================================================

create table if not exists bancos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);

create table if not exists planos_conta (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);

alter table bancos enable row level security;
create policy "Usuarios autenticados - bancos" on bancos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table planos_conta enable row level security;
create policy "Usuarios autenticados - planos_conta" on planos_conta
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create table if not exists lancamentos (
  id uuid primary key default gen_random_uuid(),

  cliente_id uuid references clientes(id) on delete set null,
  contrato_id uuid references contratos(id) on delete set null,

  descricao text,
  valor numeric(10,2) not null,
  tipo text not null check (tipo in ('receita', 'despesa')),
  situacao text not null default 'pendente' check (situacao in ('pendente', 'pago')),

  data_vencimento date not null,
  data_quitacao date,

  banco_id uuid references bancos(id),
  plano_conta_id uuid references planos_conta(id),
  codigo_transacao text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lancamentos_cliente on lancamentos (cliente_id);
create index if not exists idx_lancamentos_contrato on lancamentos (contrato_id);
create index if not exists idx_lancamentos_situacao on lancamentos (situacao);
create index if not exists idx_lancamentos_tipo on lancamentos (tipo);

alter table lancamentos enable row level security;
create policy "Usuarios autenticados - lancamentos" on lancamentos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop trigger if exists trg_lancamentos_updated_at on lancamentos;
create trigger trg_lancamentos_updated_at before update on lancamentos
  for each row execute function set_updated_at();
