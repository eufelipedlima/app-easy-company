-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0023: PIX na pessoa + pagamentos parciais de lançamento
-- ============================================================

alter table pessoas add column if not exists pix text;

create table if not exists lancamento_pagamentos (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null references lancamentos(id) on delete cascade,
  data_pagamento date not null,
  banco_id uuid references bancos(id),
  valor numeric(10,2) not null,
  taxa numeric(10,2),
  desconto numeric(10,2),
  created_at timestamptz not null default now()
);

create index if not exists idx_lancamento_pagamentos_lancamento on lancamento_pagamentos (lancamento_id);

alter table lancamento_pagamentos enable row level security;
create policy "Usuarios autenticados - lancamento_pagamentos" on lancamento_pagamentos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
