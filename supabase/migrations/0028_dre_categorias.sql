-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0028: DRE — categorias cadastráveis + vínculo com plano de conta
-- ============================================================

-- Os "grupos" são a estrutura fixa da cascata do DRE (Receita Bruta,
-- Deduções, Despesas Administrativas, etc). As categorias dentro de
-- cada grupo são 100% cadastráveis pelo usuário.
create table if not exists dre_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  grupo text not null check (grupo in (
    'receita_bruta',
    'deducoes',
    'custos_vendas',
    'despesas_vendas',
    'despesas_administrativas',
    'despesas_financeiras',
    'receitas_financeiras',
    'outras_receitas',
    'outras_despesas',
    'ir_csll'
  )),
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_dre_categorias_grupo on dre_categorias (grupo);

alter table dre_categorias enable row level security;
create policy "Usuarios autenticados - dre_categorias" on dre_categorias
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table planos_conta add column if not exists dre_categoria_id uuid references dre_categorias(id);

-- Categorias iniciais, já espelhando o exemplo de DRE que você mandou —
-- edite, renomeie ou remova à vontade depois
insert into dre_categorias (nome, grupo, ordem) values
  ('Recebimentos', 'receita_bruta', 1),
  ('Impostos sobre vendas', 'deducoes', 1),
  ('Custos de serviços prestados', 'custos_vendas', 1),
  ('Despesas Operacionais', 'despesas_vendas', 1),
  ('Despesas com Pessoal e Benefícios', 'despesas_administrativas', 1),
  ('Despesas Gerais', 'despesas_administrativas', 2),
  ('Despesas Tributárias/Sociais', 'despesas_administrativas', 3),
  ('Tarifas e juros bancários', 'despesas_financeiras', 1),
  ('Juros recebidos', 'receitas_financeiras', 1),
  ('Entradas não operacionais', 'outras_receitas', 1),
  ('Saídas não operacionais', 'outras_despesas', 1),
  ('IR/CSLL', 'ir_csll', 1)
on conflict do nothing;
