-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0094: Cronômetro por pessoa (permite rodar em paralelo)
-- ============================================================

-- Hoje o cronômetro vive só em duas colunas na própria tarefa/post
-- (timer_iniciado_em / timer_iniciado_por), então só uma pessoa por vez
-- consegue deixar rodando — quem tentasse depois ficava travado. Essas
-- tabelas guardam uma sessão por pessoa, permitindo todo mundo trabalhar
-- em paralelo na mesma tarefa, e dão uma base confiável pra ver quanto
-- tempo cada um dedicou (sem precisar reconstruir isso lendo o histórico).

create table if not exists tarefas_tempo_sessoes (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  funcionario_auth_id uuid not null references auth.users(id) on delete cascade,
  iniciado_em timestamptz,
  segundos_acumulados integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (tarefa_id, funcionario_auth_id)
);
create index if not exists idx_tarefas_tempo_sessoes_tarefa on tarefas_tempo_sessoes (tarefa_id);

alter table tarefas_tempo_sessoes enable row level security;
create policy "Usuarios autenticados - tarefas_tempo_sessoes" on tarefas_tempo_sessoes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create table if not exists posts_conteudo_tempo_sessoes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts_conteudo(id) on delete cascade,
  funcionario_auth_id uuid not null references auth.users(id) on delete cascade,
  iniciado_em timestamptz,
  segundos_acumulados integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (post_id, funcionario_auth_id)
);
create index if not exists idx_posts_conteudo_tempo_sessoes_post on posts_conteudo_tempo_sessoes (post_id);

alter table posts_conteudo_tempo_sessoes enable row level security;
create policy "Usuarios autenticados - posts_conteudo_tempo_sessoes" on posts_conteudo_tempo_sessoes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- O total geral (tarefas.tempo_total_segundos / posts_conteudo.tempo_total_segundos)
-- continua existindo e sendo a soma de todo mundo — só que agora atualizado a
-- partir dessas sessões por pessoa, em vez de um cronômetro único.
