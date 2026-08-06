-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0066: perfil "Criação" ganha acesso a Tarefas e Docs
-- (Central de Clientes usa essas duas áreas por baixo dos panos,
-- então liberando aqui ela já fica acessível também)
-- ============================================================

insert into perfis_acesso_areas (perfil_id, area_id, nivel)
select p.id, a.id, 'completo'
from perfis_acesso p, areas_sistema a
where p.nome = 'Criação' and a.slug in ('tarefas', 'docs')
on conflict (perfil_id, area_id) do update set nivel = 'completo';
