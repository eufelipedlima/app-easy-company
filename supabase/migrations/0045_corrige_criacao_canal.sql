-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0045: corrige erro ao criar canal de chat
-- ============================================================

-- O criador de um canal precisa conseguir vê-lo assim que cria, mesmo antes
-- de ele próprio ser inserido como participante (isso acontece no passo
-- seguinte, separado). Sem isso, o "insert ... returning" trava na política
-- de segurança.
drop policy if exists "Participantes veem seus canais" on chat_canais;
create policy "Participantes veem seus canais" on chat_canais
  for select using (sou_participante_do_canal(id) or criado_por = auth.uid());
