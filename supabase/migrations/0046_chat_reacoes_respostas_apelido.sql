-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0046: reações, respostas e apelido de exibição no chat
-- ============================================================

alter table pessoas add column if not exists apelido text;

alter table chat_mensagens add column if not exists resposta_a_id uuid references chat_mensagens(id) on delete set null;

create table if not exists chat_mensagens_reacoes (
  id uuid primary key default gen_random_uuid(),
  mensagem_id uuid not null references chat_mensagens(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (mensagem_id, autor_id, emoji)
);

create index if not exists idx_chat_reacoes_mensagem on chat_mensagens_reacoes (mensagem_id);

alter table chat_mensagens_reacoes enable row level security;

drop policy if exists "Participantes veem reacoes" on chat_mensagens_reacoes;
create policy "Participantes veem reacoes" on chat_mensagens_reacoes
  for select using (
    exists (
      select 1 from chat_mensagens m
      where m.id = chat_mensagens_reacoes.mensagem_id and sou_participante_do_canal(m.canal_id)
    )
  );

drop policy if exists "Participantes reagem" on chat_mensagens_reacoes;
create policy "Participantes reagem" on chat_mensagens_reacoes
  for insert with check (
    autor_id = auth.uid()
    and exists (
      select 1 from chat_mensagens m
      where m.id = chat_mensagens_reacoes.mensagem_id and sou_participante_do_canal(m.canal_id)
    )
  );

drop policy if exists "Cada um remove sua reacao" on chat_mensagens_reacoes;
create policy "Cada um remove sua reacao" on chat_mensagens_reacoes
  for delete using (autor_id = auth.uid());

alter publication supabase_realtime add table chat_mensagens_reacoes;
