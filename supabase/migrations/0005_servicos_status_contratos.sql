-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0005: serviços + status ampliado (pontual vs recorrente)
-- ============================================================

create table if not exists servicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);

alter table servicos enable row level security;
create policy "Usuarios autenticados - servicos" on servicos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table contratos add column if not exists servico_id uuid references servicos(id);

-- Amplia o status pra suportar os fluxos de pontual (ativo/concluido/arquivado)
-- e recorrente (ativo/encerrado)
alter table contratos drop constraint if exists contratos_status_check;
alter table contratos add constraint contratos_status_check
  check (status in ('ativo', 'encerrado', 'concluido', 'arquivado'));
