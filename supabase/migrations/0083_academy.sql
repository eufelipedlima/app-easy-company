-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0083: Academy (treinamentos e processos da equipe)
-- ============================================================

create table if not exists academy_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  emoji text,
  ordem int not null default 0,
  -- null = todo mundo vê; senão, lista de cargos (ids da tabela cargos) que podem ver essa categoria
  cargos_permitidos uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists academy_paginas (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references academy_categorias(id) on delete cascade,
  titulo text not null,
  emoji text,
  conteudo text,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists academy_paginas_videos (
  id uuid primary key default gen_random_uuid(),
  pagina_id uuid not null references academy_paginas(id) on delete cascade,
  titulo text,
  url text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_academy_paginas_categoria on academy_paginas (categoria_id);
create index if not exists idx_academy_videos_pagina on academy_paginas_videos (pagina_id);

alter table academy_categorias enable row level security;
alter table academy_paginas enable row level security;
alter table academy_paginas_videos enable row level security;

-- Segue o mesmo padrão do resto do sistema: RLS permissiva pra quem está logado,
-- e o controle de "quem vê o quê" (por cargo) e "quem pode editar" (admin) fica
-- na tela, igual as outras áreas do sistema já fazem.
create policy "Usuarios autenticados - academy_categorias" on academy_categorias
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Usuarios autenticados - academy_paginas" on academy_paginas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Usuarios autenticados - academy_paginas_videos" on academy_paginas_videos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop trigger if exists trg_academy_categorias_updated_at on academy_categorias;
create trigger trg_academy_categorias_updated_at before update on academy_categorias
  for each row execute function set_updated_at();

drop trigger if exists trg_academy_paginas_updated_at on academy_paginas;
create trigger trg_academy_paginas_updated_at before update on academy_paginas
  for each row execute function set_updated_at();
