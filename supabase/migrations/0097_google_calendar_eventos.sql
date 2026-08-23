-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0097: Google Calendar — mapeamento de eventos
-- ============================================================

-- Guarda qual evento do Google corresponde a qual tarefa/conteúdo, por
-- pessoa — assim a sincronização sabe se deve CRIAR um evento novo ou
-- ATUALIZAR um que já existe, em vez de duplicar toda vez que roda.

create table if not exists tarefas_google_eventos (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  google_event_id text not null,
  atualizado_em timestamptz not null default now(),
  unique (tarefa_id, funcionario_id)
);
create index if not exists idx_tarefas_google_eventos_funcionario on tarefas_google_eventos (funcionario_id);

create table if not exists posts_conteudo_google_eventos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts_conteudo(id) on delete cascade,
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  google_event_id text not null,
  atualizado_em timestamptz not null default now(),
  unique (post_id, funcionario_id)
);
create index if not exists idx_posts_conteudo_google_eventos_funcionario on posts_conteudo_google_eventos (funcionario_id);

-- Essas tabelas só são lidas/escritas pelo servidor (rotina de
-- sincronização, com a chave de administrador) — nunca direto do
-- navegador, então ficam sem nenhuma política liberada por padrão.
alter table tarefas_google_eventos enable row level security;
alter table posts_conteudo_google_eventos enable row level security;

-- Permite que a pessoa reconecte e escolha de novo a agenda, sem travar
-- em "já tem uma conexão" — o campo abaixo marca se a etapa de escolher
-- a agenda ainda está pendente.
alter table funcionarios_google_calendar add column if not exists escolha_pendente boolean not null default false;
