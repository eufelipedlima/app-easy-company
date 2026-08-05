-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0058: Docs (documentos/anotações por cliente ou internos)
-- ============================================================

create table if not exists docs (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  conteudo text,
  cliente_id uuid references clientes(id) on delete cascade,
  criado_por uuid references auth.users(id),
  atualizado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_docs_cliente on docs (cliente_id);

alter table docs enable row level security;
create policy "Usuarios autenticados - docs" on docs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop trigger if exists trg_docs_updated_at on docs;
create trigger trg_docs_updated_at before update on docs
  for each row execute function set_updated_at();

-- Nova área do sistema, já entrando no controle de permissões existente
insert into areas_sistema (nome, slug, ordem) values ('Docs', 'docs', 7)
on conflict (slug) do nothing;

insert into perfis_acesso_areas (perfil_id, area_id, nivel)
select p.id, a.id, 'completo'
from perfis_acesso p, areas_sistema a
where p.nome = 'Administrador' and a.slug = 'docs'
on conflict (perfil_id, area_id) do update set nivel = 'completo';
