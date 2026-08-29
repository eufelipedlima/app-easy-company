-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0099: Status independentes por área (Tarefas / Conteúdo / Projetos)
-- ============================================================

-- Até aqui, Tarefas, Conteúdo e Projetos compartilhavam a MESMA lista de
-- status (tabela status_conteudo, sem distinção). Essa migration separa
-- isso em três listas independentes, preservando tudo que já existe:
--
-- 1. A lista atual de status vira a lista de "tarefas" (ponto de partida).
-- 2. Duplica essa lista pra "conteudo" e "projetos" (mesmo nome/cor/ordem,
--    mas linhas novas, editáveis à parte a partir de agora).
-- 3. Reaponta os registros existentes pra continuarem enxergando o status
--    certo: conteúdos passam a apontar pra cópia de "conteudo"; PROJETOS
--    (tarefas com eh_projeto = true) passam a apontar pra cópia de
--    "projetos". Tarefas comuns e etapas dentro de um projeto continuam
--    na lista de "tarefas" original, sem precisar de nenhum ajuste.

alter table status_conteudo add column if not exists area text not null default 'tarefas';
alter table status_conteudo drop constraint if exists status_conteudo_area_check;
alter table status_conteudo add constraint status_conteudo_area_check check (area in ('tarefas', 'conteudo', 'projetos'));

-- Duplica a lista atual (todos com area='tarefas' pelo default acima) pras
-- outras duas áreas.
insert into status_conteudo (nome, cor, ordem, area)
select nome, cor, ordem, 'conteudo' from status_conteudo where area = 'tarefas';

insert into status_conteudo (nome, cor, ordem, area)
select nome, cor, ordem, 'projetos' from status_conteudo where area = 'tarefas';

-- Reaponta os conteúdos existentes pra cópia de "conteudo" (casando pelo
-- nome do status que eles já tinham).
update posts_conteudo pc
set status_id = novo.id
from status_conteudo antigo
join status_conteudo novo on novo.nome = antigo.nome and novo.area = 'conteudo'
where pc.status_id = antigo.id and antigo.area = 'tarefas';

-- O mesmo pra sub-conteúdos (se a coluna existir e forem registros na
-- mesma tabela posts_conteudo, o update acima já cobre — sub-conteúdos
-- são linhas normais de posts_conteudo).

-- Reaponta só os PROJETOS (não as tarefas comuns, nem as etapas dentro
-- deles) pra cópia de "projetos".
update tarefas t
set status_id = novo.id
from status_conteudo antigo
join status_conteudo novo on novo.nome = antigo.nome and novo.area = 'projetos'
where t.status_id = antigo.id and antigo.area = 'tarefas' and t.eh_projeto = true;

-- Modelos de projeto (eh_modelo_projeto = true) também usam status ao
-- criar — deixamos eles na lista de "tarefas" por padrão, já que servem
-- só de rascunho; a etapa criada a partir deles como projeto de verdade
-- é que precisa estar em "projetos" (já tratado acima).
