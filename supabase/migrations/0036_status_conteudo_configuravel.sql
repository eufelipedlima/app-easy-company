-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0036: status do calendário de conteúdo vira cadastrável
-- (nome, cor e ordem configuráveis pelo usuário)
-- ============================================================

create table if not exists status_conteudo (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cor text not null default 'cinza',
  ordem integer not null default 0
);

alter table status_conteudo enable row level security;
create policy "Usuarios autenticados - status_conteudo" on status_conteudo
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into status_conteudo (nome, cor, ordem) values
  ('Ideia', 'cinza', 1),
  ('Planejamento', 'indigo', 2),
  ('Captação', 'ciano', 3),
  ('Criação', 'azul', 4),
  ('Revisão', 'roxo', 5),
  ('Aprovação', 'amarelo', 6),
  ('Em alteração', 'vermelho', 7),
  ('Agendamento', 'verde-agua', 8),
  ('Concluído', 'verde', 9)
on conflict do nothing;

alter table posts_conteudo add column if not exists status_id uuid references status_conteudo(id);

-- Associa cada post ao status novo equivalente, usando o nome como ponte
update posts_conteudo p
set status_id = s.id
from status_conteudo s
where p.status_id is null
  and (
    (p.status = 'ideia' and s.nome = 'Ideia') or
    (p.status = 'planejamento' and s.nome = 'Planejamento') or
    (p.status = 'captacao' and s.nome = 'Captação') or
    (p.status = 'criacao' and s.nome = 'Criação') or
    (p.status = 'revisao' and s.nome = 'Revisão') or
    (p.status = 'aprovacao' and s.nome = 'Aprovação') or
    (p.status = 'em_alteracao' and s.nome = 'Em alteração') or
    (p.status = 'agendamento' and s.nome = 'Agendamento') or
    (p.status = 'concluido' and s.nome = 'Concluído')
  );

-- Post sem status válido cai no primeiro da lista (Ideia), pra nunca ficar sem
update posts_conteudo
set status_id = (select id from status_conteudo order by ordem limit 1)
where status_id is null;

alter table posts_conteudo alter column status_id set not null;
alter table posts_conteudo drop column if exists status;
