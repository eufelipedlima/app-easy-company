-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0077: área "Meu Time" — visão da equipe, admin-only
-- ============================================================

insert into areas_sistema (nome, slug, ordem) values ('Meu Time', 'equipe', 10)
on conflict (slug) do nothing;

insert into perfis_acesso_areas (perfil_id, area_id, nivel)
select p.id, a.id, 'completo'
from perfis_acesso p, areas_sistema a
where p.nome = 'Administrador' and a.slug = 'equipe'
on conflict (perfil_id, area_id) do update set nivel = 'completo';
