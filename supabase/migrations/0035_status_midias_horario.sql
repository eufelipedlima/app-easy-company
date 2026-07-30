-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0035: novo fluxo de status, horário de publicação,
-- e múltiplas mídias por post (carrossel)
-- ============================================================

alter table posts_conteudo drop constraint if exists posts_conteudo_status_check;
alter table posts_conteudo add constraint posts_conteudo_status_check check (status in (
  'ideia', 'planejamento', 'captacao', 'criacao', 'revisao',
  'aprovacao', 'em_alteracao', 'agendamento', 'concluido'
));
alter table posts_conteudo alter column status set default 'ideia';

-- Já migra os posts que estavam no fluxo antigo pra um equivalente razoável
-- no fluxo novo, sem perder o que já estava cadastrado
update posts_conteudo set status = 'aprovacao' where status = 'para_aprovar_interno';
update posts_conteudo set status = 'aprovacao' where status = 'aprovado_interno';
update posts_conteudo set status = 'em_alteracao' where status = 'alteracoes_interno';
update posts_conteudo set status = 'agendamento' where status = 'aprovado_cliente';
update posts_conteudo set status = 'em_alteracao' where status = 'alteracoes_cliente';

alter table posts_conteudo add column if not exists hora_publicacao time;

create table if not exists posts_conteudo_midias (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts_conteudo(id) on delete cascade,
  arquivo_path text not null,
  arquivo_nome text,
  arquivo_tipo text,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_posts_conteudo_midias_post on posts_conteudo_midias (post_id);

alter table posts_conteudo_midias enable row level security;
create policy "Usuarios autenticados - posts_conteudo_midias" on posts_conteudo_midias
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Migra a mídia única que já existia (se houver) pra tabela nova, como item 0
insert into posts_conteudo_midias (post_id, arquivo_path, arquivo_nome, arquivo_tipo, ordem)
select id, arquivo_path, arquivo_nome, arquivo_tipo, 0
from posts_conteudo
where arquivo_path is not null
on conflict do nothing;
