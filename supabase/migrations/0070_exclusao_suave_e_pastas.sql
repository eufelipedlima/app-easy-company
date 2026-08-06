-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0070: exclusão suave de verdade (mantém subtarefas,
-- comentários e histórico intactos, só esconde da listagem normal)
-- ============================================================

alter table tarefas add column if not exists excluido_em timestamptz;
alter table tarefas add column if not exists excluido_por uuid references auth.users(id);

alter table docs add column if not exists excluido_em timestamptz;
alter table docs add column if not exists excluido_por uuid references auth.users(id);

alter table posts_conteudo add column if not exists excluido_em timestamptz;
alter table posts_conteudo add column if not exists excluido_por uuid references auth.users(id);

-- Pasta explícita (pra já mostrar o ícone de pasta assim que criada, mesmo vazia)
alter table tarefas add column if not exists eh_pasta boolean not null default false;
alter table modelos_projeto_etapas add column if not exists eh_pasta boolean not null default false;
