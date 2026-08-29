-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0100: Reparo — status por área (idempotente)
-- ============================================================
-- Essa migration é segura de rodar quantas vezes precisar, mesmo que a
-- 0099 já tenha rodado (inteira, pela metade, ou nem tenha rodado). Ela
-- confere o que já existe antes de agir, e só completa o que falta —
-- nunca duplica, nunca perde o status que uma tarefa/conteúdo já tinha.

-- 1) Garante que a coluna e a trava de valores existem.
alter table status_conteudo add column if not exists area text not null default 'tarefas';
alter table status_conteudo drop constraint if exists status_conteudo_area_check;
alter table status_conteudo add constraint status_conteudo_area_check check (area in ('tarefas', 'conteudo', 'projetos'));

-- 2) Pra cada status que existe em "tarefas" mas ainda não tem uma cópia
-- com o mesmo nome em "conteudo", cria essa cópia agora.
insert into status_conteudo (nome, cor, ordem, area)
select t1.nome, t1.cor, t1.ordem, 'conteudo'
from status_conteudo t1
where t1.area = 'tarefas'
  and not exists (
    select 1 from status_conteudo t2 where t2.area = 'conteudo' and t2.nome = t1.nome
  );

-- 3) O mesmo pra "projetos".
insert into status_conteudo (nome, cor, ordem, area)
select t1.nome, t1.cor, t1.ordem, 'projetos'
from status_conteudo t1
where t1.area = 'tarefas'
  and not exists (
    select 1 from status_conteudo t2 where t2.area = 'projetos' and t2.nome = t1.nome
  );

-- 4) Reaponta qualquer conteúdo que ainda esteja usando um status de
-- "tarefas" (sinal de que a etapa 3 anterior não tinha rodado ainda) pra
-- versão de "conteudo" com o mesmo nome — preserva exatamente o status
-- que o conteúdo já tinha, só na lista certa agora.
update posts_conteudo pc
set status_id = novo.id
from status_conteudo antigo
join status_conteudo novo on novo.nome = antigo.nome and novo.area = 'conteudo'
where pc.status_id = antigo.id and antigo.area = 'tarefas';

-- 5) O mesmo só pros PROJETOS (eh_projeto = true) — tarefas comuns e
-- etapas dentro de projetos continuam de propósito na lista de
-- "tarefas", já que é lá que elas aparecem no dia a dia.
update tarefas t
set status_id = novo.id
from status_conteudo antigo
join status_conteudo novo on novo.nome = antigo.nome and novo.area = 'projetos'
where t.status_id = antigo.id and antigo.area = 'tarefas' and t.eh_projeto = true;

-- 6) Conferência: mostra quantos status cada área tem agora. Depois de
-- rodar, as três colunas devem estar com o mesmo número (ou próximo,
-- se você já tiver editado alguma antes desse reparo).
select area, count(*) as total_status from status_conteudo group by area order by area;
