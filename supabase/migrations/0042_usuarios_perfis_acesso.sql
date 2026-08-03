-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0042: sistema de usuários e perfis de acesso
-- ============================================================

-- Áreas do sistema — lista extensível; conforme o sistema cresce, só se
-- adiciona uma linha nova aqui (e o código correspondente) pra que ela já
-- fique disponível pra configurar em qualquer perfil de acesso.
create table if not exists areas_sistema (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  ordem integer not null default 0
);

alter table areas_sistema enable row level security;
create policy "Usuarios autenticados - areas_sistema" on areas_sistema
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into areas_sistema (nome, slug, ordem) values
  ('Financeiro', 'financeiro', 1),
  ('Contratos', 'contratos', 2),
  ('Conteúdo', 'conteudo', 3),
  ('Pessoas', 'pessoas', 4),
  ('Configurações', 'configuracoes', 5)
on conflict (slug) do nothing;

create table if not exists perfis_acesso (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem integer not null default 0
);

alter table perfis_acesso enable row level security;
create policy "Usuarios autenticados - perfis_acesso" on perfis_acesso
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create table if not exists perfis_acesso_areas (
  perfil_id uuid not null references perfis_acesso(id) on delete cascade,
  area_id uuid not null references areas_sistema(id) on delete cascade,
  nivel text not null default 'nenhum' check (nivel in ('nenhum', 'visualizar', 'completo')),
  primary key (perfil_id, area_id)
);

alter table perfis_acesso_areas enable row level security;
create policy "Usuarios autenticados - perfis_acesso_areas" on perfis_acesso_areas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Seed dos dois perfis iniciais
insert into perfis_acesso (nome, ordem) values ('Administrador', 1), ('Criação', 2)
on conflict do nothing;

insert into perfis_acesso_areas (perfil_id, area_id, nivel)
select p.id, a.id, 'completo'
from perfis_acesso p, areas_sistema a
where p.nome = 'Administrador'
on conflict (perfil_id, area_id) do update set nivel = 'completo';

insert into perfis_acesso_areas (perfil_id, area_id, nivel)
select p.id, a.id, case when a.slug = 'conteudo' then 'completo' else 'nenhum' end
from perfis_acesso p, areas_sistema a
where p.nome = 'Criação'
on conflict (perfil_id, area_id) do nothing;

-- Liga o funcionário a uma conta de login de verdade
alter table funcionarios add column if not exists tem_acesso_sistema boolean not null default false;
alter table funcionarios add column if not exists email_acesso text;
alter table funcionarios add column if not exists perfil_acesso_id uuid references perfis_acesso(id);
alter table funcionarios add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
create unique index if not exists idx_funcionarios_auth_user_id on funcionarios (auth_user_id) where auth_user_id is not null;

-- Função auxiliar: qual o nível de acesso do usuário logado numa área,
-- usada tanto pela tela quanto pelas políticas de segurança das tabelas
create or replace function meu_nivel_acesso(area_slug text)
returns text
language plpgsql
security definer
stable
as $$
declare
  nivel text;
  existe_alguem_vinculado boolean;
begin
  select exists(select 1 from funcionarios where auth_user_id is not null) into existe_alguem_vinculado;

  -- Enquanto ninguém tiver vinculado a própria conta a um funcionário ainda
  -- (sistema novo, ninguém configurado), libera tudo — evita travar o
  -- primeiro acesso antes de existir um Administrador de verdade.
  if not existe_alguem_vinculado then
    return 'completo';
  end if;

  select pa.nivel into nivel
  from funcionarios f
  join perfis_acesso_areas pa on pa.perfil_id = f.perfil_acesso_id
  join areas_sistema a on a.id = pa.area_id
  where f.auth_user_id = auth.uid() and a.slug = area_slug;

  return coalesce(nivel, 'nenhum');
end;
$$;
