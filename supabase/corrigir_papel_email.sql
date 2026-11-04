-- Corrige "null value in column email" ao tornar alguém admin ou organizador.
-- A tabela exige o email, e definir_papel_seguro não o enviava.
-- Rode uma vez no SQL Editor do Supabase. Não altera dados e pode rodar de novo.

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
    if not p_eh_admin then
      delete from public.admins where user_id = p_user_id;
    elsif exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'admins' and column_name = 'email'
    ) then
      insert into public.admins (user_id, email)
      select u.id, u.email from auth.users u where u.id = p_user_id
      on conflict do nothing;
    else
      insert into public.admins (user_id) values (p_user_id) on conflict do nothing;
    end if;
  end if;

  if not p_eh_organizador then
    delete from public.organizadores where user_id = p_user_id;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organizadores' and column_name = 'email'
  ) then
    insert into public.organizadores (user_id, email)
    select u.id, u.email from auth.users u where u.id = p_user_id
    on conflict do nothing;
  else
    insert into public.organizadores (user_id) values (p_user_id) on conflict do nothing;
  end if;
end;
$$;

-- Conferência: além de user_id e email, nenhuma coluna deve aparecer com obrigatoria = true e sem padrão
select
  table_name,
  column_name,
  is_nullable = 'NO' as obrigatoria,
  column_default as padrao
from information_schema.columns
where table_schema = 'public' and table_name in ('admins', 'organizadores')
order by table_name, ordinal_position;
