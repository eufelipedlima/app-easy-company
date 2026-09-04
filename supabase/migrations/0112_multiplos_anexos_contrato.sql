-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0112: Múltiplos anexos por contrato
-- ============================================================
-- Hoje um contrato só guarda 1 arquivo (arquivo_path/arquivo_nome na
-- própria tabela). Essa migration cria uma tabela separada pra guardar
-- vários anexos por contrato (contrato assinado, aditivos,
-- cancelamentos, etc) e migra o arquivo único que já existir pra lá,
-- sem perder nada.

create table if not exists contratos_anexos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos(id) on delete cascade,
  arquivo_path text not null,
  arquivo_nome text,
  arquivo_tipo text,
  tamanho_bytes bigint,
  enviado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_contratos_anexos_contrato on contratos_anexos (contrato_id, created_at);

alter table contratos_anexos enable row level security;
drop policy if exists "Usuarios autenticados - contratos_anexos" on contratos_anexos;
create policy "Usuarios autenticados - contratos_anexos" on contratos_anexos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Migra o arquivo único existente (se houver) pra tabela nova
insert into contratos_anexos (contrato_id, arquivo_path, arquivo_nome, created_at)
select id, arquivo_path, arquivo_nome, coalesce(created_at, now())
from contratos
where arquivo_path is not null
  and not exists (select 1 from contratos_anexos ca where ca.contrato_id = contratos.id and ca.arquivo_path = contratos.arquivo_path);

NOTIFY pgrst, 'reload schema';
