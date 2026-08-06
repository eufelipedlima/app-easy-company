-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0067: Lixeira (itens excluídos, restauráveis por 30 dias)
-- ============================================================

create table if not exists lixeira (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('tarefa', 'doc', 'conteudo')),
  item_id_original uuid not null,
  titulo text,
  dados jsonb not null,
  excluido_por uuid references auth.users(id),
  excluido_em timestamptz not null default now()
);
create index if not exists idx_lixeira_excluido_em on lixeira (excluido_em);

alter table lixeira enable row level security;

-- Só quem tem perfil "Administrador" pode ver ou mexer na lixeira
create policy "Somente administrador - lixeira select" on lixeira
  for select using (
    exists (
      select 1 from funcionarios f
      join perfis_acesso pa on pa.id = f.perfil_acesso_id
      where f.auth_user_id = auth.uid() and pa.nome = 'Administrador'
    )
  );
create policy "Somente administrador - lixeira insert" on lixeira
  for insert with check (auth.role() = 'authenticated');
create policy "Somente administrador - lixeira delete" on lixeira
  for delete using (
    exists (
      select 1 from funcionarios f
      join perfis_acesso pa on pa.id = f.perfil_acesso_id
      where f.auth_user_id = auth.uid() and pa.nome = 'Administrador'
    )
  );
