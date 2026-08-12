-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0082: administrador remove membro do chat
-- ============================================================

-- Hoje a política de DELETE em chat_participantes só permite que a própria
-- pessoa saia do canal (auth_user_id = auth.uid()). Por isso, quando um
-- administrador tentava remover OUTRA pessoa pela tela de configurações do
-- canal, o banco simplesmente ignorava o delete (0 linhas afetadas, sem
-- erro) — parecia que o botão "Remover" não fazia nada.

create or replace function sou_administrador()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from funcionarios f
    join perfis_acesso pa on pa.id = f.perfil_acesso_id
    where f.auth_user_id = auth.uid() and pa.nome = 'Administrador'
  );
$$;

drop policy if exists "Cada um sai do canal" on chat_participantes;
create policy "Sai do canal, administrador ou criador remove" on chat_participantes
  for delete using (
    auth_user_id = auth.uid()
    or sou_administrador()
    or exists (
      select 1 from chat_canais cc
      where cc.id = chat_participantes.canal_id and cc.criado_por = auth.uid()
    )
  );
