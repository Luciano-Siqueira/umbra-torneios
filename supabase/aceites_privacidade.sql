-- Quem aceitou a política de privacidade, para a tela Usuários.
-- O aceite fica na própria conta (user_metadata), que só o dono lê; esta função mostra ao admin.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo.

begin;

create or replace function public.listar_aceites_privacidade()
returns table (user_id uuid, versao text, aceita_em timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.eh_admin() then
    raise exception 'Apenas administradores podem ver os aceites';
  end if;

  return query
  select u.id,
         u.raw_user_meta_data->>'privacidade_versao',
         nullif(u.raw_user_meta_data->>'privacidade_aceita_em', '')::timestamptz
  from auth.users u;
end;
$$;

revoke execute on function public.listar_aceites_privacidade() from public, anon;
grant execute on function public.listar_aceites_privacidade() to authenticated;

commit;

-- Conferência: quantas contas já aceitaram alguma versão
-- (direto na tabela: no SQL Editor não há usuário logado, e a função exige admin)
select count(*) filter (where raw_user_meta_data ? 'privacidade_versao') as aceitaram, count(*) as contas
from auth.users;
