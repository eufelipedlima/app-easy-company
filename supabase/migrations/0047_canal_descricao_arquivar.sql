-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0047: descrição do canal e arquivar conversa (por pessoa)
-- ============================================================

alter table chat_canais add column if not exists descricao text;

-- Arquivar é por pessoa (cada um pode "sumir" a conversa da própria lista
-- sem afetar os outros participantes, nem apagar o histórico)
alter table chat_participantes add column if not exists arquivado boolean not null default false;
