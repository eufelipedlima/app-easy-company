-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0010: folha de pagamento + serviço no lançamento
-- ============================================================

create table if not exists funcionarios (
  id uuid primary key default gen_random_uuid(),
  papel_id uuid not null references papeis(id) on delete cascade,
  cargo text,
  salario numeric(10,2) not null,
  data_admissao date,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint papel_funcionario_unico unique (papel_id)
);

alter table funcionarios enable row level security;
create policy "Usuarios autenticados - funcionarios" on funcionarios
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop trigger if exists trg_funcionarios_updated_at on funcionarios;
create trigger trg_funcionarios_updated_at before update on funcionarios
  for each row execute function set_updated_at();

alter table lancamentos add column if not exists servico_id uuid references servicos(id);
