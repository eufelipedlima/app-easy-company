-- Substitui as policies abertas por policies que exigem usuário autenticado

drop policy if exists "Acesso total - pessoas" on pessoas;
drop policy if exists "Acesso total - responsaveis" on responsaveis;
drop policy if exists "Acesso total - papeis" on papeis;
drop policy if exists "Acesso total - clientes" on clientes;

create policy "Usuarios autenticados - pessoas" on pessoas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Usuarios autenticados - responsaveis" on responsaveis
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Usuarios autenticados - papeis" on papeis
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Usuarios autenticados - clientes" on clientes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
