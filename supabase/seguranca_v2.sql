-- Segurança: dados privados do torneio, aprovação de nomes e senha de admin no banco.
-- Rode uma vez no SQL Editor do Supabase, ANTES de publicar a versão do site que usa isto.
-- Roda em uma transação: se der erro, nada é alterado. Pode rodar de novo.

begin;

-- 1. Dados que só admin e quem organizou podem ler ---------------------------
create table if not exists public.torneio_privado (
  torneio_id text primary key,
  criado_por uuid,
  pagamentos jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);
alter table public.torneio_privado enable row level security;
revoke all on public.torneio_privado from public, anon;
grant select, insert, update, delete on public.torneio_privado to authenticated;

-- Copia dono e pagamentos que estão dentro do torneio
insert into public.torneio_privado (torneio_id, criado_por, pagamentos)
select
  t.id::text,
  nullif(t.dados->>'criadoPor', '')::uuid,
  coalesce((
    select jsonb_object_agg(
      j->>'id',
      jsonb_build_object('pago', coalesce((j->>'pago')::boolean, false), 'premioPago', coalesce(j->'premioPago', 'null'::jsonb))
    )
    from jsonb_array_elements(coalesce(t.dados->'jogadores', '[]'::jsonb)) j
  ), '{}'::jsonb)
from public.torneios t
where t.dados ? 'criadoPor'
   or exists (select 1 from jsonb_array_elements(coalesce(t.dados->'jogadores', '[]'::jsonb)) j where j ? 'pago')
on conflict (torneio_id) do nothing;

-- A coluna user_id, se existir, também revelaria o dono
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'torneios' and column_name = 'user_id'
  ) then
    execute $q$
      update public.torneio_privado p set criado_por = t.user_id
      from public.torneios t
      where t.id::text = p.torneio_id and p.criado_por is null
    $q$;
    execute 'alter table public.torneios alter column user_id drop default';
    execute 'alter table public.torneios alter column user_id drop not null';
    execute 'update public.torneios set user_id = null';
  end if;
end $$;

-- Tira do torneio o que agora é privado
update public.torneios t
set dados = (t.dados - 'criadoPor') || jsonb_build_object('jogadores', (
  select coalesce(jsonb_agg(j.valor - 'pago' - 'premioPago' order by j.ordem), '[]'::jsonb)
  from jsonb_array_elements(coalesce(t.dados->'jogadores', '[]'::jsonb)) with ordinality j(valor, ordem)
))
where t.dados ? 'criadoPor'
   or exists (
     select 1 from jsonb_array_elements(coalesce(t.dados->'jogadores', '[]'::jsonb)) j
     where j ? 'pago' or j ? 'premioPago'
   );

-- 2. Aprovação do vínculo de nomes -------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'usuarios_jogadores' and column_name = 'aprovado'
  ) then
    alter table public.usuarios_jogadores add column aprovado boolean not null default false;
    -- Quem já tinha nome continua com acesso
    update public.usuarios_jogadores set aprovado = true;
  end if;
end $$;

create or replace function public.eh_participante_aprovado(p_dados jsonb)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.usuarios_jogadores uj
    join jsonb_array_elements(coalesce(p_dados->'jogadores', '[]'::jsonb)) j
      on lower(trim(j->>'nome')) = lower(trim(uj.nome_jogador))
    where uj.user_id = auth.uid() and uj.aprovado
  )
$$;

drop policy if exists "uj_insert" on public.usuarios_jogadores;
create policy "uj_insert" on public.usuarios_jogadores
  for insert
  with check (public.eh_admin() or (user_id = auth.uid() and not aprovado));

drop policy if exists "uj_update" on public.usuarios_jogadores;
create policy "uj_update" on public.usuarios_jogadores
  for update
  using (public.eh_admin())
  with check (public.eh_admin());

-- 3. Regras de acesso usando a tabela privada --------------------------------
create or replace function public.pode_gerir_torneio(p_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.eh_admin() or exists (
    select 1
    from public.torneio_privado p
    join public.organizadores o on o.user_id = auth.uid()
    where p.torneio_id = p_id and p.criado_por = auth.uid()
  )
$$;

drop policy if exists "privado_leitura" on public.torneio_privado;
create policy "privado_leitura" on public.torneio_privado
  for select to authenticated
  using (public.eh_admin() or criado_por = auth.uid());

drop policy if exists "privado_criar" on public.torneio_privado;
create policy "privado_criar" on public.torneio_privado
  for insert to authenticated
  with check (
    public.eh_admin()
    or (
      criado_por = auth.uid()
      and exists (select 1 from public.organizadores o where o.user_id = auth.uid())
    )
  );

drop policy if exists "privado_alterar" on public.torneio_privado;
create policy "privado_alterar" on public.torneio_privado
  for update to authenticated
  using (public.pode_gerir_torneio(torneio_id))
  with check (public.eh_admin() or criado_por = auth.uid());

drop policy if exists "privado_excluir" on public.torneio_privado;
create policy "privado_excluir" on public.torneio_privado
  for delete to authenticated
  using (public.pode_gerir_torneio(torneio_id));

drop policy if exists "torneios_select_admin_ou_participante" on public.torneios;
create policy "torneios_select_admin_ou_participante" on public.torneios
  for select
  using (public.pode_gerir_torneio(id::text) or public.eh_participante_aprovado(dados));

drop policy if exists "torneios_insert_admin" on public.torneios;
create policy "torneios_insert_admin" on public.torneios
  for insert
  with check (public.pode_gerir_torneio(id::text));

drop policy if exists "torneios_update_admin" on public.torneios;
create policy "torneios_update_admin" on public.torneios
  for update
  using (public.pode_gerir_torneio(id::text))
  with check (public.pode_gerir_torneio(id::text));

drop policy if exists "torneios_delete_admin" on public.torneios;
create policy "torneios_delete_admin" on public.torneios
  for delete
  using (public.pode_gerir_torneio(id::text));

drop policy if exists "ao_vivo_escrita" on public.torneio_ao_vivo;
create policy "ao_vivo_escrita" on public.torneio_ao_vivo
  for all to authenticated
  using (public.pode_gerir_torneio(torneio_id))
  with check (public.pode_gerir_torneio(torneio_id));

-- 4. Senha para mudar admin, conferida no banco ------------------------------
create extension if not exists pgcrypto with schema extensions;

create or replace function public.definir_papel_seguro(
  p_user_id uuid,
  p_eh_admin boolean,
  p_eh_organizador boolean,
  p_senha text default null
)
returns void
language plpgsql
security definer
set search_path = extensions, public, pg_temp
as $$
begin
  if not public.eh_admin() then
    raise exception 'Apenas administradores podem alterar papéis';
  end if;

  if p_eh_admin <> exists (select 1 from public.admins a where a.user_id = p_user_id) then
    if p_user_id = auth.uid() then
      raise exception 'Você não pode alterar o próprio acesso de admin';
    end if;
    if p_senha is null or not exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and u.encrypted_password = crypt(p_senha, u.encrypted_password)
    ) then
      raise exception 'Senha incorreta';
    end if;
    if p_eh_admin then
      insert into public.admins (user_id) values (p_user_id) on conflict do nothing;
    else
      delete from public.admins where user_id = p_user_id;
    end if;
  end if;

  if p_eh_organizador then
    insert into public.organizadores (user_id) values (p_user_id) on conflict do nothing;
  else
    delete from public.organizadores where user_id = p_user_id;
  end if;
end;
$$;

revoke execute on function public.definir_papel_seguro(uuid, boolean, boolean, text) from public, anon;
grant execute on function public.definir_papel_seguro(uuid, boolean, boolean, text) to authenticated;

-- Sem estes caminhos, a senha não pode ser evitada
revoke execute on function public.definir_papel(uuid, boolean, boolean) from public, anon, authenticated;
drop policy if exists "admins_insert_admin" on public.admins;
drop policy if exists "admins_delete_admin" on public.admins;

commit;

-- Conferência: nenhuma das duas colunas deve mostrar dados privados
select
  count(*) as torneios,
  count(*) filter (where dados ? 'criadoPor') as com_dono_visivel,
  count(*) filter (where exists (
    select 1 from jsonb_array_elements(coalesce(dados->'jogadores', '[]'::jsonb)) j where j ? 'pago'
  )) as com_pagamento_visivel
from public.torneios;

select count(*) as torneios_sem_dono from public.torneio_privado where criado_por is null;
