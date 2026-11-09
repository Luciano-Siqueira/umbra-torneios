-- Aparelhos que aceitaram receber avisos (notificações) do Umbra Torneios.
-- Cada aparelho tem um endereço próprio de notificação; o mesmo aparelho pode trocar de conta.
-- Quem envia é a função avisar-mesas (supabase/functions/avisar-mesas), com a chave de serviço.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo.

begin;

create table if not exists public.push_inscricoes (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now()
);
create index if not exists push_inscricoes_user on public.push_inscricoes (user_id);

alter table public.push_inscricoes enable row level security;
revoke all on public.push_inscricoes from public, anon, authenticated;

-- O app grava e apaga só pelas funções abaixo; ninguém lê a tabela direto
create or replace function public.registrar_push(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Entre na conta para receber avisos';
  end if;
  -- O mesmo aparelho passa para a conta que está usando agora
  insert into public.push_inscricoes (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, criado_em = now();
end;
$$;

create or replace function public.remover_push(p_endpoint text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.push_inscricoes where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke execute on function public.registrar_push(text, text, text) from public, anon;
revoke execute on function public.remover_push(text) from public, anon;
grant execute on function public.registrar_push(text, text, text) to authenticated;
grant execute on function public.remover_push(text) to authenticated;

commit;

-- Faz o site enxergar as funções novas na hora
notify pgrst, 'reload schema';

-- Conferência: quantos aparelhos inscritos
select count(*) as aparelhos from public.push_inscricoes;
