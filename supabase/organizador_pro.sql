-- Assinaturas Pro: Organizador Pro e Jogador Pro, pagas por Pix (Mercado Pago), vendidas só pelo site.
-- Cada pagamento aprovado soma os dias do plano à validade daquele plano na conta.
--   jogador     — mesas, tempo e notificações (com a liberação do admin), Decks e Analytics
--   organizador — tudo do jogador + escolher as notificações de cada torneio
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo (também atualiza a versão anterior).

begin;

-- Preço e duração (iguais para os dois planos). Uma linha só.
create table if not exists public.config_pro (
  id int primary key default 1 check (id = 1),
  preco_centavos int not null default 990 check (preco_centavos > 0),  -- R$ 9,90
  dias int not null default 30 check (dias > 0),
  vendas_abertas boolean not null default false,  -- abra quando o Mercado Pago estiver configurado
  atualizado_em timestamptz not null default now()
);
insert into public.config_pro (id) values (1) on conflict do nothing;

alter table public.config_pro enable row level security;
revoke all on public.config_pro from public, anon;
grant select, update on public.config_pro to authenticated;

drop policy if exists "config_pro_leitura" on public.config_pro;
create policy "config_pro_leitura" on public.config_pro
  for select to authenticated using (true);

drop policy if exists "config_pro_admin" on public.config_pro;
create policy "config_pro_admin" on public.config_pro
  for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- Até quando cada conta tem cada plano. Só o servidor grava.
create table if not exists public.assinaturas_pro (
  user_id uuid not null references auth.users(id) on delete cascade,
  plano text not null default 'jogador',
  pro_ate timestamptz not null,
  atualizado_em timestamptz not null default now()
);
-- Quem rodou a versão anterior (só Organizador Pro): ganha a coluna do plano
alter table public.assinaturas_pro add column if not exists plano text not null default 'organizador';
alter table public.assinaturas_pro alter column plano set default 'jogador';
alter table public.assinaturas_pro drop constraint if exists assinaturas_pro_pkey;
alter table public.assinaturas_pro add primary key (user_id, plano);
alter table public.assinaturas_pro drop constraint if exists assinaturas_pro_plano;
alter table public.assinaturas_pro add constraint assinaturas_pro_plano check (plano in ('jogador', 'organizador'));

alter table public.assinaturas_pro enable row level security;
revoke all on public.assinaturas_pro from public, anon, authenticated;
grant select on public.assinaturas_pro to authenticated;

drop policy if exists "assinaturas_pro_leitura" on public.assinaturas_pro;
create policy "assinaturas_pro_leitura" on public.assinaturas_pro
  for select to authenticated
  using (user_id = auth.uid() or public.eh_admin());

-- Cada cobrança Pix criada. O id é o do pagamento no Mercado Pago.
create table if not exists public.pagamentos_pro (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,  -- sem dono depois que a conta é excluída
  plano text not null default 'jogador',
  valor_centavos int not null,
  dias int not null,
  status text not null default 'pending',
  qr_code text,
  qr_code_base64 text,
  expira_em timestamptz,
  criado_em timestamptz not null default now(),
  aprovado_em timestamptz,
  creditado boolean not null default false
);
alter table public.pagamentos_pro add column if not exists plano text not null default 'organizador';
alter table public.pagamentos_pro alter column plano set default 'jogador';
alter table public.pagamentos_pro drop constraint if exists pagamentos_pro_plano;
alter table public.pagamentos_pro add constraint pagamentos_pro_plano check (plano in ('jogador', 'organizador'));
create index if not exists pagamentos_pro_usuario on public.pagamentos_pro (user_id, criado_em desc);

-- LGPD: ao excluir a conta, o pagamento continua registrado (obrigação fiscal), mas sem ligação com
-- a pessoa e sem o código Pix. Vale para a exclusão pelo app e pela tela Usuários.
alter table public.pagamentos_pro alter column user_id drop not null;
alter table public.pagamentos_pro drop constraint if exists pagamentos_pro_user_id_fkey;
alter table public.pagamentos_pro add constraint pagamentos_pro_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

create or replace function public.pagamento_pro_sem_dono()
returns trigger
language plpgsql
as $fn$
begin
  new.qr_code := null;
  new.qr_code_base64 := null;
  return new;
end;
$fn$;

drop trigger if exists pagamento_pro_sem_dono on public.pagamentos_pro;
create trigger pagamento_pro_sem_dono
  before update of user_id on public.pagamentos_pro
  for each row
  when (old.user_id is not null and new.user_id is null)
  execute function public.pagamento_pro_sem_dono();

alter table public.pagamentos_pro enable row level security;
revoke all on public.pagamentos_pro from public, anon, authenticated;
grant select on public.pagamentos_pro to authenticated;

drop policy if exists "pagamentos_pro_leitura" on public.pagamentos_pro;
create policy "pagamentos_pro_leitura" on public.pagamentos_pro
  for select to authenticated
  using (user_id = auth.uid() or public.eh_admin());

-- Soma os dias de um pagamento aprovado ao plano dele, uma vez só. Só a função pagamento-pro chama.
create or replace function public.creditar_pagamento_pro(p_id text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid;
  v_plano text;
  v_dias int;
  v_ate timestamptz;
begin
  update public.pagamentos_pro
     set creditado = true, status = 'approved', aprovado_em = coalesce(aprovado_em, now())
   where id = p_id and not creditado
  returning user_id, plano, dias into v_usuario, v_plano, v_dias;

  if v_usuario is null then
    -- Já creditado antes: só devolve a validade atual
    select a.pro_ate into v_ate
      from public.assinaturas_pro a
      join public.pagamentos_pro p on p.user_id = a.user_id and p.plano = a.plano
     where p.id = p_id;
    return v_ate;
  end if;

  insert into public.assinaturas_pro (user_id, plano, pro_ate)
  values (v_usuario, v_plano, now() + make_interval(days => v_dias))
  on conflict (user_id, plano) do update
    set pro_ate = greatest(public.assinaturas_pro.pro_ate, now()) + make_interval(days => v_dias),
        atualizado_em = now()
  returning pro_ate into v_ate;
  return v_ate;
end;
$$;
revoke all on function public.creditar_pagamento_pro(text) from public, anon, authenticated;
grant execute on function public.creditar_pagamento_pro(text) to service_role;

-- Admin dá dias de cortesia (ou tira, com número negativo): select conceder_pro('<user_id>', 30, 'jogador');
drop function if exists public.conceder_pro(uuid, int);
create or replace function public.conceder_pro(p_user uuid, p_dias int, p_plano text default 'jogador')
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ate timestamptz;
begin
  if not public.eh_admin() then
    raise exception 'Só administradores podem dar dias de Pro';
  end if;
  if p_plano not in ('jogador', 'organizador') then
    raise exception 'Plano deve ser jogador ou organizador';
  end if;
  insert into public.assinaturas_pro (user_id, plano, pro_ate)
  values (p_user, p_plano, now() + make_interval(days => p_dias))
  on conflict (user_id, plano) do update
    set pro_ate = greatest(public.assinaturas_pro.pro_ate, now()) + make_interval(days => p_dias),
        atualizado_em = now()
  returning pro_ate into v_ate;
  return v_ate;
end;
$$;
revoke all on function public.conceder_pro(uuid, int, text) from public, anon;
grant execute on function public.conceder_pro(uuid, int, text) to authenticated;

-- Admin encerra um plano na hora (a validade passa a ser agora)
create or replace function public.revogar_pro(p_user uuid, p_plano text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.eh_admin() then
    raise exception 'Só administradores podem tirar o Pro';
  end if;
  update public.assinaturas_pro
     set pro_ate = least(pro_ate, now()), atualizado_em = now()
   where user_id = p_user and plano = p_plano;
end;
$$;
revoke all on function public.revogar_pro(uuid, text) from public, anon;
grant execute on function public.revogar_pro(uuid, text) to authenticated;

commit;

-- Faz o site enxergar as tabelas novas na hora
notify pgrst, 'reload schema';

-- Conferência: preço, duração e se as vendas estão abertas
select * from public.config_pro;
