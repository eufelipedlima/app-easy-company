-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0095: Meu Time — restringir via Perfis de Acesso (não hardcoded)
-- ============================================================

-- A migration 0077 já tinha dado acesso completo ao perfil Administrador
-- pra área "equipe", mas nunca bloqueou explicitamente os outros perfis —
-- então eles ficavam sem registro, e a falta de registro estava sendo
-- tratada como acesso liberado. Esse insert fecha essa brecha: todo perfil
-- que não for Administrador passa a ter nível "nenhum" na área "equipe".
--
-- Isso substitui a checagem "hardcoded" feita direto no código (que só
-- reconhecia o nome literal "Administrador") pelo sistema de permissões já
-- existente — então, se no futuro alguém criar um perfil novo (ex.
-- "Gerente") que também deva ver Meu Time, basta liberar isso em
-- Configurações → Perfis de Acesso, sem precisar mexer em código.

insert into perfis_acesso_areas (perfil_id, area_id, nivel)
select p.id, a.id, 'nenhum'
from perfis_acesso p, areas_sistema a
where p.nome <> 'Administrador' and a.slug = 'equipe'
on conflict (perfil_id, area_id) do update set nivel = 'nenhum';
