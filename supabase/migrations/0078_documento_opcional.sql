-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0078: documento (CPF/CNPJ) deixa de ser obrigatório
-- (permite cadastrar um cliente sem CNPJ ainda — ex: empresa nova
-- que por enquanto usa o CNPJ de outra do grupo — e atualizar depois)
-- ============================================================

alter table pessoas alter column documento drop not null;

-- A trava de "não repetir" continua valendo pra quem TEM documento
-- preenchido (o Postgres permite vários registros com documento em
-- branco ao mesmo tempo, sem quebrar a unicidade dos que têm).
