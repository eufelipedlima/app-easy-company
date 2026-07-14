-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0006: arquivo do contrato + observações
-- ============================================================

alter table contratos add column if not exists arquivo_path text;
alter table contratos add column if not exists arquivo_nome text;
alter table contratos add column if not exists comentarios_extras text;
-- "descricao" já existe desde a migration 0003 e passa a ser usada como
-- "Contratado pelo cliente" no formulário

insert into storage.buckets (id, name, public)
values ('contratos', 'contratos', false)
on conflict (id) do nothing;

create policy "Usuarios autenticados podem ler arquivos de contratos"
on storage.objects for select
using (bucket_id = 'contratos' and auth.role() = 'authenticated');

create policy "Usuarios autenticados podem enviar arquivos de contratos"
on storage.objects for insert
with check (bucket_id = 'contratos' and auth.role() = 'authenticated');

create policy "Usuarios autenticados podem atualizar arquivos de contratos"
on storage.objects for update
using (bucket_id = 'contratos' and auth.role() = 'authenticated');

create policy "Usuarios autenticados podem deletar arquivos de contratos"
on storage.objects for delete
using (bucket_id = 'contratos' and auth.role() = 'authenticated');
