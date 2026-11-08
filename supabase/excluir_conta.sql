-- Exclusão da própria conta, exigida pela Google Play para apps com cadastro.
-- A pessoa confirma com a senha. Saem o login, os nomes vinculados, os papéis e as permissões.
-- Os torneios ficam, pois têm resultados de outros jogadores; os que ela criou passam a não ter dono
-- (o admin continua gerenciando).
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo.

begin;

create extension if not exists pgcrypto with schema extensions;

create or replace function public.excluir_minha_conta(p_senha text)
returns void
language plpgsql
security definer
set search_path = extensions, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Entre na conta para excluí-la';
  end if;

  if p_senha is null or not exists (
    select 1 from auth.users u
    where u.id = v_uid
      and u.encrypted_password = crypt(p_senha, u.encrypted_password)
  ) then
    raise exception 'Senha incorreta';
  end if;

  -- Sem nenhum admin, ninguém mais gerencia o site
  if exists (select 1 from public.admins where user_id = v_uid)
     and (select count(*) from public.admins) <= 1 then
    raise exception 'Você é o único admin. Torne outra pessoa admin antes de excluir a sua conta';
  end if;

  delete from public.usuarios_jogadores where user_id = v_uid;
  delete from public.admins where user_id = v_uid;
  delete from public.organizadores where user_id = v_uid;
  if to_regclass('public.permissoes_jogador') is not null then
    delete from public.permissoes_jogador where user_id = v_uid;
  end if;
  if to_regclass('public.torneio_privado') is not null then
    update public.torneio_privado set criado_por = null where criado_por = v_uid;
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.excluir_minha_conta(text) from public, anon;
grant execute on function public.excluir_minha_conta(text) to authenticated;

commit;

-- Faz o site enxergar a função nova na hora (sem isso pode dar "Could not find the function")
notify pgrst, 'reload schema';

-- Conferência: deve mostrar a função
select proname from pg_proc where proname = 'excluir_minha_conta';
