-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0038: controla quais status aparecem pro cliente
-- no link público do calendário de conteúdo
-- ============================================================

alter table status_conteudo add column if not exists visivel_cliente boolean not null default false;

update status_conteudo set visivel_cliente = true
where nome in ('Aprovação', 'Em alteração', 'Agendamento', 'Concluído');
