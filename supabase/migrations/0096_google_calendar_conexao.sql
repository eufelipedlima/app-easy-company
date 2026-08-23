-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0096: Google Calendar — conexão por funcionário
-- ============================================================

create table if not exists funcionarios_google_calendar (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  google_email text,
  refresh_token text not null,
  access_token text,
  access_token_expira_em timestamptz,
  google_calendar_id text,
  conectado_em timestamptz not null default now(),
  ultima_sincronizacao timestamptz,
  unique (funcionario_id)
);

alter table funcionarios_google_calendar enable row level security;

-- Cada pessoa só vê o status da PRÓPRIA conexão (nunca a de outra pessoa) —
-- e nem essa política dá acesso de escrita: inserir/atualizar/remover só
-- acontece pelas rotas do servidor, usando a chave de administrador, nunca
-- direto do navegador. O token de acesso ao Google é informação sensível.
create policy "Ve a propria conexao - funcionarios_google_calendar" on funcionarios_google_calendar
  for select using (funcionario_id in (select id from funcionarios where auth_user_id = auth.uid()));
