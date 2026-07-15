-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0022: PIX de funcionário/prestador + detalhes do serviço
-- ============================================================

alter table funcionarios add column if not exists pix text;
alter table prestadores add column if not exists pix text;

alter table servicos add column if not exists descricao text;
alter table servicos add column if not exists entregaveis text;
alter table servicos add column if not exists valor numeric(10,2);
