-- Avisa os admins por e-mail quando alguém pede para vincular um nome de jogador.
-- O e-mail sai pelo Resend (o mesmo do SMTP do Supabase), de nao-responda@umbraarena.com.br.
--
-- ANTES de rodar este arquivo, guarde a chave do Resend no cofre do Supabase, uma vez só,
-- num SQL separado (troque pelo valor real; a chave nunca vai para o código):
--   select vault.create_secret('re_SUA_CHAVE_AQUI', 'resend_api_key');
-- Para trocar a chave depois:
--   select vault.update_secret((select id from vault.secrets where name = 'resend_api_key'), 're_NOVA');
--
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo.

begin;

create extension if not exists pg_net with schema extensions;

create or replace function public.avisar_admins_nome_pendente()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_chave text;
  v_admins text[];
  v_quem text;
begin
  if new.aprovado is distinct from false then
    return new;
  end if;

  select decrypted_secret into v_chave from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  select array_agg(u.email) into v_admins
    from public.admins a join auth.users u on u.id = a.user_id
    where u.email is not null;
  -- Sem chave ou sem admin, o pedido é gravado normalmente e só não sai e-mail
  if v_chave is null or v_admins is null then
    return new;
  end if;

  select email into v_quem from auth.users where id = new.user_id;

  -- Envio em segundo plano (pg_net): o pedido do jogador não espera nem falha por causa do e-mail.
  -- Só texto, sem HTML: o nome é digitado pelo usuário.
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_chave, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'Umbra Torneios <nao-responda@umbraarena.com.br>',
      'to', to_jsonb(v_admins),
      'subject', 'Nome aguardando aprovação: ' || left(new.nome_jogador, 60),
      'text',
        coalesce(v_quem, 'Uma conta') || ' pediu para vincular o nome de jogador "' || new.nome_jogador || '".' || E'\n\n' ||
        'Até a aprovação, essa conta não vê os torneios com esse nome.' || E'\n\n' ||
        'Aprove ou recuse na tela Usuários:' || E'\n' ||
        'https://torneios.umbraarena.com.br' || E'\n\n' ||
        '— Umbra Torneios'
    )
  );
  return new;
end;
$$;

revoke execute on function public.avisar_admins_nome_pendente() from public, anon, authenticated;

drop trigger if exists avisar_admins_nome_pendente on public.usuarios_jogadores;
create trigger avisar_admins_nome_pendente
  after insert on public.usuarios_jogadores
  for each row execute function public.avisar_admins_nome_pendente();

commit;

-- Conferência: a chave guardada (só o nome, nunca o valor) e o gatilho criado
select name from vault.secrets where name = 'resend_api_key';
select tgname from pg_trigger where tgname = 'avisar_admins_nome_pendente';
