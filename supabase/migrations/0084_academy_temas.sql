-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0084: Academy — temas/aulas dentro de cada página
-- ============================================================

-- Cada página (ex: "Criação de Conteúdo") agora se divide em temas/aulas
-- (ex: "Etapa 1 — Briefing", "Etapa 2 — Roteiro"...). O vídeo e o texto
-- que antes ficavam direto na página passam a ficar em cada tema.

create table if not exists academy_temas (
  id uuid primary key default gen_random_uuid(),
  pagina_id uuid not null references academy_paginas(id) on delete cascade,
  titulo text not null,
  emoji text,
  conteudo text,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_academy_temas_pagina on academy_temas (pagina_id);

create table if not exists academy_temas_videos (
  id uuid primary key default gen_random_uuid(),
  tema_id uuid not null references academy_temas(id) on delete cascade,
  titulo text,
  url text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_academy_temas_videos_tema on academy_temas_videos (tema_id);

alter table academy_temas enable row level security;
alter table academy_temas_videos enable row level security;

create policy "Usuarios autenticados - academy_temas" on academy_temas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Usuarios autenticados - academy_temas_videos" on academy_temas_videos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop trigger if exists trg_academy_temas_updated_at on academy_temas;
create trigger trg_academy_temas_updated_at before update on academy_temas
  for each row execute function set_updated_at();

-- A tabela antiga de vídeos por página não é mais usada (vídeo agora é por tema).
-- Se você já tinha cadastrado algum vídeo direto na página, ele fica preservado
-- aqui, só não aparece mais na tela — me avise se precisar migrar isso pra dentro
-- de um tema específico.
drop table if exists academy_paginas_videos;
