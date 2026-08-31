-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0103: Reparo — visível pro cliente sumiu após separar status por área
-- ============================================================
-- Ao duplicar os status de "tarefas" pra "conteudo" e "projetos" (migration
-- 0099), esquecemos de copiar a marcação "visivel_cliente" — as cópias
-- novas nasceram todas como não-visíveis (valor padrão da coluna), e foi
-- pra essas cópias que os conteúdos existentes passaram a apontar. Por
-- isso a página pública de aprovação parou de mostrar qualquer conteúdo.
--
-- Esse reparo copia a marcação original (que continua certa na área
-- "tarefas", nunca foi tocada) pras cópias de "conteudo" e "projetos",
-- casando pelo nome do status.

update status_conteudo novo
set visivel_cliente = antigo.visivel_cliente
from status_conteudo antigo
where antigo.area = 'tarefas'
  and novo.area = 'conteudo'
  and novo.nome = antigo.nome;

update status_conteudo novo
set visivel_cliente = antigo.visivel_cliente
from status_conteudo antigo
where antigo.area = 'tarefas'
  and novo.area = 'projetos'
  and novo.nome = antigo.nome;

-- Conferência: mostra quais status de "conteudo" ficaram visíveis pro
-- cliente depois do reparo — confira se bate com o que fazia sentido
-- antes (normalmente algo como "Aprovação", "Agendamento", "Concluído").
select nome, visivel_cliente from status_conteudo where area = 'conteudo' order by ordem;
