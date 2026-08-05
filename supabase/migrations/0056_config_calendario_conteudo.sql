-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0056: configuração de exibição do Calendário de Conteúdo
-- ============================================================

create table if not exists configuracoes_conteudo (
  id boolean primary key default true,
  mostrar_subconteudos_no_calendario boolean not null default true,
  constraint configuracoes_conteudo_singleton check (id)
);

insert into configuracoes_conteudo (id, mostrar_subconteudos_no_calendario)
values (true, true)
on conflict (id) do nothing;

alter table configuracoes_conteudo enable row level security;
create policy "Usuarios autenticados - configuracoes_conteudo" on configuracoes_conteudo
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
