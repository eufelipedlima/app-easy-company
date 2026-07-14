-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0003: contratos
-- ============================================================

create table if not exists contratos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete restrict,

  tipo_contrato text not null check (tipo_contrato in ('pontual', 'recorrente')),
  status text not null default 'ativo' check (status in ('ativo', 'encerrado')),

  descricao text,
  forma_pagamento text,

  -- Pontual
  valor_total numeric(10,2),
  data_fechamento date,

  -- Recorrente
  valor_mensal numeric(10,2),
  data_primeira_mensalidade date,
  tempo_inicial_meses integer default 3,

  data_encerramento date, -- preenchido quando o contrato é encerrado (de qualquer tipo)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pontual_tem_valor_e_data check (
    (tipo_contrato = 'recorrente')
    or (tipo_contrato = 'pontual' and valor_total is not null and data_fechamento is not null)
  ),
  constraint recorrente_tem_campos_obrigatorios check (
    (tipo_contrato = 'pontual')
    or (tipo_contrato = 'recorrente' and valor_mensal is not null and data_primeira_mensalidade is not null)
  )
);

create index if not exists idx_contratos_cliente on contratos (cliente_id);
create index if not exists idx_contratos_status on contratos (status);
create index if not exists idx_contratos_tipo on contratos (tipo_contrato);

comment on table contratos is 'Contratos pontuais ou recorrentes vinculados a um cliente';

drop trigger if exists trg_contratos_updated_at on contratos;
create trigger trg_contratos_updated_at before update on contratos
  for each row execute function set_updated_at();

alter table contratos enable row level security;

create policy "Usuarios autenticados - contratos" on contratos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
