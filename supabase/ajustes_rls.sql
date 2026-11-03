-- Ajustes de acesso depois da auditoria. Rode uma vez no SQL Editor do Supabase.
-- Roda em uma transação: se der erro, nada é alterado. Pode rodar de novo.
--
-- 1. Organizador passa a ver, criar, editar e excluir os PRÓPRIOS torneios
-- 2. Ao vivo: organizador só publica nos próprios torneios
-- 3. Nomes de jogadores deixam de ficar abertos para quem não fez login
-- 4. Funções de admin deixam de aceitar chamadas sem login
-- 5. Remove uma policy duplicada

begin;

-- 1. Torneios ---------------------------------------------------------------
drop policy if exists "torneios_select_admin_ou_participante" on public.torneios;
create policy "torneios_select_admin_ou_participante" on public.torneios
  for select
  using (
    public.eh_admin()
    or public.eh_participante(dados)
    or (
      dados->>'criadoPor' = auth.uid()::text
      and exists (select 1 from public.organizadores o where o.user_id = auth.uid())
    )
  );

drop policy if exists "torneios_insert_admin" on public.torneios;
create policy "torneios_insert_admin" on public.torneios
  for insert
  with check (
    public.eh_admin()
    or (
      dados->>'criadoPor' = auth.uid()::text
      and exists (select 1 from public.organizadores o where o.user_id = auth.uid())
    )
  );

drop policy if exists "torneios_update_admin" on public.torneios;
create policy "torneios_update_admin" on public.torneios
  for update
  using (
    public.eh_admin()
    or (
      dados->>'criadoPor' = auth.uid()::text
      and exists (select 1 from public.organizadores o where o.user_id = auth.uid())
    )
  )
  with check (
    public.eh_admin()
    or (
      dados->>'criadoPor' = auth.uid()::text
      and exists (select 1 from public.organizadores o where o.user_id = auth.uid())
    )
  );

drop policy if exists "torneios_delete_admin" on public.torneios;
create policy "torneios_delete_admin" on public.torneios
  for delete
  using (
    public.eh_admin()
    or (
      dados->>'criadoPor' = auth.uid()::text
      and exists (select 1 from public.organizadores o where o.user_id = auth.uid())
    )
  );

-- 2. Ao vivo ----------------------------------------------------------------
drop policy if exists "ao_vivo_escrita" on public.torneio_ao_vivo;
create policy "ao_vivo_escrita" on public.torneio_ao_vivo
  for all to authenticated
  using (
    public.eh_admin()
    or exists (
      select 1 from public.torneios t
      where t.id::text = torneio_ao_vivo.torneio_id
        and t.dados->>'criadoPor' = auth.uid()::text
        and exists (select 1 from public.organizadores o where o.user_id = auth.uid())
    )
  )
  with check (
    public.eh_admin()
    or exists (
      select 1 from public.torneios t
      where t.id::text = torneio_ao_vivo.torneio_id
        and t.dados->>'criadoPor' = auth.uid()::text
        and exists (select 1 from public.organizadores o where o.user_id = auth.uid())
    )
  );

-- 3. Nomes cadastrados ------------------------------------------------------
drop policy if exists "nomes_select_todos" on public.nomes_cadastrados;
create policy "nomes_select_todos" on public.nomes_cadastrados
  for select to authenticated
  using (true);

-- 4. Funções de admin -------------------------------------------------------
-- eh_admin e eh_participante continuam abertas: as policies dependem delas
revoke execute on function public.listar_usuarios() from public, anon;
revoke execute on function public.definir_papel(uuid, boolean, boolean) from public, anon;
revoke execute on function public.admin_deletar_usuario(uuid) from public, anon;
grant execute on function public.listar_usuarios() to authenticated;
grant execute on function public.definir_papel(uuid, boolean, boolean) to authenticated;
grant execute on function public.admin_deletar_usuario(uuid) to authenticated;

-- 5. Policy duplicada -------------------------------------------------------
drop policy if exists "org_select_self" on public.organizadores;

commit;

-- Conferência: mostra as regras novas e quantos torneios ainda não têm criador
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename in ('torneios', 'torneio_ao_vivo', 'nomes_cadastrados', 'organizadores')
order by tablename, policyname;

select count(*) as torneios_sem_criador from public.torneios where dados->>'criadoPor' is null;
