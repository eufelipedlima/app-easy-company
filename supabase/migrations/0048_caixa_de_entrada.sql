-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0048: Caixa de Entrada (central de notificações)
-- ============================================================

create table if not exists notificacoes (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  descricao text,
  link text,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notificacoes_destinatario on notificacoes (destinatario_id, lida, created_at desc);

alter table notificacoes enable row level security;

drop policy if exists "Cada um ve suas notificacoes" on notificacoes;
create policy "Cada um ve suas notificacoes" on notificacoes
  for select using (destinatario_id = auth.uid());

drop policy if exists "Autenticados criam notificacao" on notificacoes;
create policy "Autenticados criam notificacao" on notificacoes
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Cada um atualiza suas notificacoes" on notificacoes;
create policy "Cada um atualiza suas notificacoes" on notificacoes
  for update using (destinatario_id = auth.uid());

drop policy if exists "Cada um remove suas notificacoes" on notificacoes;
create policy "Cada um remove suas notificacoes" on notificacoes
  for delete using (destinatario_id = auth.uid());

alter publication supabase_realtime add table notificacoes;
