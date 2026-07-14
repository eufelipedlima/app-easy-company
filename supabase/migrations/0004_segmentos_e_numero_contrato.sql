-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0004: segmentos + número do contrato automático
-- ============================================================

create table if not exists segmentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);

insert into segmentos (nome) values
  ('Saúde'), ('Educação'), ('Varejo'), ('Serviços Financeiros'),
  ('Alimentação'), ('Imobiliário'), ('Automotivo'), ('Indústria'), ('Consultoria')
on conflict (nome) do nothing;

alter table segmentos enable row level security;
create policy "Usuarios autenticados - segmentos" on segmentos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table pessoas add column if not exists segmento_id uuid references segmentos(id);

-- Número do contrato: gerado automaticamente (EC-ANO-0001) quando não informado
create sequence if not exists contratos_numero_seq;

alter table contratos add column if not exists numero_contrato text unique;

create or replace function gerar_numero_contrato()
returns trigger as $$
begin
  if new.numero_contrato is null or new.numero_contrato = '' then
    new.numero_contrato := 'EC-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('contratos_numero_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_contratos_numero on contratos;
create trigger trg_contratos_numero before insert on contratos
  for each row execute function gerar_numero_contrato();
