-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0062: autor da notificação (pra mostrar avatar na Caixa de Entrada)
-- ============================================================

alter table notificacoes add column if not exists autor_id uuid references auth.users(id);
alter table notificacoes add column if not exists autor_nome text;
alter table notificacoes add column if not exists autor_foto_url text;
