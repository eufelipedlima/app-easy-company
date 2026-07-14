-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0001: pessoas, responsaveis, papeis
-- ============================================================

create extension if not exists "pgcrypto";

-- Tabela base: qualquer pessoa física ou jurídica que a agência
-- se relaciona (cliente, funcionário, parceiro, prestador, etc.)
create table if not exists pessoas (
  id uuid primary key default gen_random_uuid(),
  tipo_pessoa text not null check (tipo_pessoa in ('PF', 'PJ')),

  -- PF: nome completo · PJ: nome fantasia
  nome text not null,
  razao_social text,               -- só PJ
  documento text not null,         -- CPF (PF) ou CNPJ (PJ)
  data_nascimento date,            -- só PF

  email text,
  whatsapp text,

  rua text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  cep text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint documento_unico unique (documento),
  constraint pj_tem_razao_social check (
    (tipo_pessoa = 'PJ' and razao_social is not null)
    or (tipo_pessoa = 'PF')
  ),
  constraint pf_nao_tem_data_nascimento_nula check (
    (tipo_pessoa = 'PF') or (tipo_pessoa = 'PJ' and data_nascimento is null)
  )
);

create index if not exists idx_pessoas_tipo on pessoas (tipo_pessoa);
create index if not exists idx_pessoas_documento on pessoas (documento);

comment on table pessoas is 'Cadastro mestre de pessoas físicas e jurídicas (clientes, funcionários, parceiros, etc.)';

-- Responsável pela empresa (só preenchido quando pessoa é PJ)
create table if not exists responsaveis (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references pessoas(id) on delete cascade,

  nome_completo text not null,
  cpf text not null,
  email text,
  whatsapp text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_responsaveis_pessoa on responsaveis (pessoa_id);

comment on table responsaveis is 'Responsável legal/contato principal de uma pessoa jurídica';

-- Papéis: uma pessoa pode ser cliente, funcionário, parceiro etc.
-- ao mesmo tempo (relação N:N)
create table if not exists papeis (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references pessoas(id) on delete cascade,
  papel text not null check (papel in ('cliente', 'funcionario', 'parceiro', 'prestador', 'fornecedor')),

  ativo boolean not null default true,
  created_at timestamptz not null default now(),

  constraint papel_unico_por_pessoa unique (pessoa_id, papel)
);

create index if not exists idx_papeis_pessoa on papeis (pessoa_id);
create index if not exists idx_papeis_papel on papeis (papel);

comment on table papeis is 'Papéis que uma pessoa assume na agência — permite múltiplos papéis simultâneos';

-- Dados específicos de quem é cliente (origem/CAC ficam aqui, não em pessoas)
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  papel_id uuid not null references papeis(id) on delete cascade,

  origem text,   -- lead source, lista fixa controlada no front (indicação, tráfego pago, orgânico, etc.)
  cac numeric(10,2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint papel_cliente_unico unique (papel_id)
);

comment on table clientes is 'Dados comerciais específicos de pessoas com papel = cliente';

-- Trigger simples pra manter updated_at em dia
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_pessoas_updated_at on pessoas;
create trigger trg_pessoas_updated_at before update on pessoas
  for each row execute function set_updated_at();

drop trigger if exists trg_responsaveis_updated_at on responsaveis;
create trigger trg_responsaveis_updated_at before update on responsaveis
  for each row execute function set_updated_at();

drop trigger if exists trg_clientes_updated_at on clientes;
create trigger trg_clientes_updated_at before update on clientes
  for each row execute function set_updated_at();
