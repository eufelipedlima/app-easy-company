-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0074: Central de Clientes vira um interruptor próprio
-- (não depende mais só de "tem contrato ativo") — admin liga/desliga
-- manualmente, e o contrato recorrente pode ligar automaticamente
-- ============================================================

alter table clientes add column if not exists ativo_central_clientes boolean not null default false;

-- Preserva quem já aparecia hoje na Central (cliente com contrato ativo),
-- pra ninguém sumir da lista quando essa migration rodar.
update clientes
set ativo_central_clientes = true
where id in (select cliente_id from contratos where status = 'ativo');
