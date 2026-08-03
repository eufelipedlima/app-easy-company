-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0044: corrige recursão infinita nas políticas do chat
-- ============================================================

-- O erro "infinite recursion detected" acontece porque a política de
-- chat_participantes consultava a própria chat_participantes dentro de si
-- mesma. A solução é isolar essa checagem numa função "security definer",
-- que roda sem aplicar a política de novo por cima dela mesma.
create or replace function sou_participante_do_canal(p_canal_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from chat_participantes cp
    where cp.canal_id = p_canal_id and cp.auth_user_id = auth.uid()
  );
$$;

drop policy if exists "Participantes veem seus canais" on chat_canais;
create policy "Participantes veem seus canais" on chat_canais
  for select using (sou_participante_do_canal(id));

drop policy if exists "Participantes veem participantes do canal" on chat_participantes;
create policy "Participantes veem participantes do canal" on chat_participantes
  for select using (sou_participante_do_canal(canal_id));

drop policy if exists "Participantes leem mensagens" on chat_mensagens;
create policy "Participantes leem mensagens" on chat_mensagens
  for select using (sou_participante_do_canal(canal_id));

drop policy if exists "Participantes mandam mensagem" on chat_mensagens;
create policy "Participantes mandam mensagem" on chat_mensagens
  for insert with check (autor_id = auth.uid() and sou_participante_do_canal(canal_id));
