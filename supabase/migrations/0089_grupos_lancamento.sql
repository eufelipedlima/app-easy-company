-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0089: Grupos de lançamento — tabela própria pra gerenciar
-- ============================================================

-- Hoje "grupo" em lancamentos e despesas_fixas é só texto livre (sem
-- cadastro nenhum, cada um digita do jeito que quiser). Essa tabela vira o
-- catálogo oficial — a tela de Configurações usa ela pra criar/renomear/
-- excluir, e ao renomear/excluir já reflete automaticamente nos lançamentos
-- e despesas fixas que usam aquele grupo.

create table if not exists grupos_lancamento (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);

alter table grupos_lancamento enable row level security;
create policy "Usuarios autenticados - grupos_lancamento" on grupos_lancamento
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Preenche com os valores de grupo já usados hoje, pra não perder nada
insert into grupos_lancamento (nome)
select distinct grupo from lancamentos where grupo is not null and trim(grupo) <> ''
on conflict (nome) do nothing;

insert into grupos_lancamento (nome)
select distinct grupo from despesas_fixas where grupo is not null and trim(grupo) <> ''
on conflict (nome) do nothing;
