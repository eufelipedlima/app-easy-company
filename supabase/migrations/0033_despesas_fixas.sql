-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0033: Despesas Fixas (mesma lógica do contrato recorrente,
-- só que pro lado das despesas da própria agência)
-- ============================================================

create table if not exists despesas_fixas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  fornecedor_pessoa_id uuid references pessoas(id),
  valor_mensal numeric(10,2) not null,
  banco_id uuid references bancos(id),
  plano_conta_id uuid references planos_conta(id),
  data_competencia date,
  data_inicio date not null,
  essencial boolean not null default false,
  status text not null default 'ativo' check (status in ('ativo', 'encerrado')),
  data_encerramento date,
  motivo_encerramento text,
  observacoes text,
  ultima_verificacao_parcelas timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table despesas_fixas enable row level security;
create policy "Usuarios autenticados - despesas_fixas" on despesas_fixas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop trigger if exists trg_despesas_fixas_updated_at on despesas_fixas;
create trigger trg_despesas_fixas_updated_at before update on despesas_fixas
  for each row execute function set_updated_at();

alter table lancamentos add column if not exists despesa_fixa_id uuid references despesas_fixas(id);
create index if not exists idx_lancamentos_despesa_fixa on lancamentos (despesa_fixa_id);
