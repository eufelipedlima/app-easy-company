-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0032: motivos de encerramento cadastráveis + serviço ligado a plano de conta
-- ============================================================

create table if not exists motivos_encerramento (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);

alter table motivos_encerramento enable row level security;
create policy "Usuarios autenticados - motivos_encerramento" on motivos_encerramento
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into motivos_encerramento (nome) values
  ('Insatisfação com o serviço'),
  ('Preço'),
  ('Encerrou atividades / fechou empresa'),
  ('Passou a fazer internamente'),
  ('Contratou concorrente'),
  ('Inadimplência'),
  ('Outro')
on conflict do nothing;

alter table servicos add column if not exists plano_conta_id uuid references planos_conta(id);
