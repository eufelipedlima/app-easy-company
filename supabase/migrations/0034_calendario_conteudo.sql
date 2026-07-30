-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0034: Calendário de Conteúdo
-- ============================================================

create table if not exists redes_sociais (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);

alter table redes_sociais enable row level security;
create policy "Usuarios autenticados - redes_sociais" on redes_sociais
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into redes_sociais (nome) values
  ('Instagram'), ('TikTok'), ('Facebook'), ('LinkedIn'), ('YouTube')
on conflict do nothing;

create table if not exists posts_conteudo (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  rede_social_id uuid references redes_sociais(id),
  data_publicacao date not null,
  legenda text,
  objetivo text check (objetivo in ('atracao', 'educacao', 'conversao')),
  status text not null default 'para_aprovar_interno' check (status in (
    'para_aprovar_interno', 'aprovado_interno', 'alteracoes_interno',
    'aprovado_cliente', 'alteracoes_cliente'
  )),
  observacoes_internas text,
  arquivo_path text,
  arquivo_nome text,
  arquivo_tipo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_posts_conteudo_cliente on posts_conteudo (cliente_id);
create index if not exists idx_posts_conteudo_data on posts_conteudo (data_publicacao);

alter table posts_conteudo enable row level security;
create policy "Usuarios autenticados - posts_conteudo" on posts_conteudo
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop trigger if exists trg_posts_conteudo_updated_at on posts_conteudo;
create trigger trg_posts_conteudo_updated_at before update on posts_conteudo
  for each row execute function set_updated_at();

create table if not exists posts_conteudo_comentarios (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts_conteudo(id) on delete cascade,
  autor text not null check (autor in ('equipe', 'cliente')),
  texto text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_comentarios_post on posts_conteudo_comentarios (post_id);

alter table posts_conteudo_comentarios enable row level security;
create policy "Usuarios autenticados - posts_conteudo_comentarios" on posts_conteudo_comentarios
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Token único por cliente pro link público do calendário (só leitura + comentário,
-- validado via rota de servidor com service role — não expõe o resto do banco)
alter table clientes add column if not exists link_publico_token uuid not null default gen_random_uuid() unique;

-- Bucket de storage pra mídia dos posts (público, já que é conteúdo que vai ser
-- publicado nas redes sociais mesmo — baixa sensibilidade)
insert into storage.buckets (id, name, public)
values ('conteudo-midia', 'conteudo-midia', true)
on conflict (id) do nothing;
