-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0043: Chat interno (DMs, grupos e canais por cliente)
-- ============================================================

create table if not exists chat_canais (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('dm', 'grupo', 'cliente')),
  nome text,
  cliente_id uuid references clientes(id) on delete cascade,
  criado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists chat_participantes (
  canal_id uuid not null references chat_canais(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  ultima_leitura timestamptz not null default now(),
  primary key (canal_id, auth_user_id)
);

create table if not exists chat_mensagens (
  id uuid primary key default gen_random_uuid(),
  canal_id uuid not null references chat_canais(id) on delete cascade,
  autor_id uuid not null references auth.users(id),
  texto text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_mensagens_canal on chat_mensagens (canal_id, created_at);
create index if not exists idx_chat_participantes_user on chat_participantes (auth_user_id);

alter table chat_canais enable row level security;
alter table chat_participantes enable row level security;
alter table chat_mensagens enable row level security;

-- Só quem participa do canal consegue ver o canal, ver quem mais participa,
-- e ler/mandar mensagem nele — isso é uma conversa privada, não é
-- "qualquer autenticado vê tudo" como o resto do sistema até aqui.
drop policy if exists "Participantes veem seus canais" on chat_canais;
create policy "Participantes veem seus canais" on chat_canais
  for select using (
    exists (select 1 from chat_participantes cp where cp.canal_id = chat_canais.id and cp.auth_user_id = auth.uid())
  );

drop policy if exists "Autenticados criam canais" on chat_canais;
create policy "Autenticados criam canais" on chat_canais
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Criador edita canal" on chat_canais;
create policy "Criador edita canal" on chat_canais
  for update using (criado_por = auth.uid());

drop policy if exists "Criador remove canal" on chat_canais;
create policy "Criador remove canal" on chat_canais
  for delete using (criado_por = auth.uid());

drop policy if exists "Participantes veem participantes do canal" on chat_participantes;
create policy "Participantes veem participantes do canal" on chat_participantes
  for select using (
    exists (select 1 from chat_participantes cp2 where cp2.canal_id = chat_participantes.canal_id and cp2.auth_user_id = auth.uid())
  );

drop policy if exists "Autenticados adicionam participante" on chat_participantes;
create policy "Autenticados adicionam participante" on chat_participantes
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Cada um atualiza sua leitura" on chat_participantes;
create policy "Cada um atualiza sua leitura" on chat_participantes
  for update using (auth_user_id = auth.uid());

drop policy if exists "Cada um sai do canal" on chat_participantes;
create policy "Cada um sai do canal" on chat_participantes
  for delete using (auth_user_id = auth.uid());

drop policy if exists "Participantes leem mensagens" on chat_mensagens;
create policy "Participantes leem mensagens" on chat_mensagens
  for select using (
    exists (select 1 from chat_participantes cp where cp.canal_id = chat_mensagens.canal_id and cp.auth_user_id = auth.uid())
  );

drop policy if exists "Participantes mandam mensagem" on chat_mensagens;
create policy "Participantes mandam mensagem" on chat_mensagens
  for insert with check (
    autor_id = auth.uid()
    and exists (select 1 from chat_participantes cp where cp.canal_id = chat_mensagens.canal_id and cp.auth_user_id = auth.uid())
  );

-- Habilita tempo real nessa tabela (pra mensagem aparecer na hora, sem
-- precisar recarregar a página)
alter publication supabase_realtime add table chat_mensagens;
