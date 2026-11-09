-- Organizador Pro: assinatura paga por Pix (Mercado Pago), vendida só pelo site.
-- Cada pagamento aprovado soma os dias do plano à validade do Pro da conta.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo.

begin;

-- Preço e duração. Uma linha só; o admin muda aqui ou pelo SQL.
create table if not exists public.config_pro (
  id int primary key default 1 check (id = 1),
  preco_centavos int not null default 990 check (preco_centavos > 0),  -- R$ 9,90
  dias int not null default 30 check (dias > 0),
  vendas_abertas boolean not null default true,
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

-- Até quando cada conta tem o Pro. Só o servidor grava.
create table if not exists public.assinaturas_pro (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pro_ate timestamptz not null,
  atualizado_em timestamptz not null default now()
);
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
  user_id uuid not null references auth.users(id) on delete cascade,
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
create index if not exists pagamentos_pro_usuario on public.pagamentos_pro (user_id, criado_em desc);
alter table public.pagamentos_pro enable row level security;
revoke all on public.pagamentos_pro from public, anon, authenticated;
grant select on public.pagamentos_pro to authenticated;

drop policy if exists "pagamentos_pro_leitura" on public.pagamentos_pro;
create policy "pagamentos_pro_leitura" on public.pagamentos_pro
  for select to authenticated
  using (user_id = auth.uid() or public.eh_admin());

-- Soma os dias de um pagamento aprovado, uma vez só. Só a função pagamento-pro chama.
create or replace function public.creditar_pagamento_pro(p_id text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid;
  v_dias int;
  v_ate timestamptz;
begin
  update public.pagamentos_pro
     set creditado = true, status = 'approved', aprovado_em = coalesce(aprovado_em, now())
   where id = p_id and not creditado
  returning user_id, dias into v_usuario, v_dias;

  if v_usuario is null then
    -- Já creditado antes: só devolve a validade atual
    select a.pro_ate into v_ate
      from public.assinaturas_pro a
      join public.pagamentos_pro p on p.user_id = a.user_id
     where p.id = p_id;
    return v_ate;
  end if;

  insert into public.assinaturas_pro (user_id, pro_ate)
  values (v_usuario, now() + make_interval(days => v_dias))
  on conflict (user_id) do update
    set pro_ate = greatest(public.assinaturas_pro.pro_ate, now()) + make_interval(days => v_dias),
        atualizado_em = now()
  returning pro_ate into v_ate;
  return v_ate;
end;
$$;
revoke all on function public.creditar_pagamento_pro(text) from public, anon, authenticated;
grant execute on function public.creditar_pagamento_pro(text) to service_role;

-- Admin dá dias de cortesia (ou tira, com número negativo)
create or replace function public.conceder_pro(p_user uuid, p_dias int)
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
  insert into public.assinaturas_pro (user_id, pro_ate)
  values (p_user, now() + make_interval(days => p_dias))
  on conflict (user_id) do update
    set pro_ate = greatest(public.assinaturas_pro.pro_ate, now()) + make_interval(days => p_dias),
        atualizado_em = now()
  returning pro_ate into v_ate;
  return v_ate;
end;
$$;
revoke all on function public.conceder_pro(uuid, int) from public, anon;
grant execute on function public.conceder_pro(uuid, int) to authenticated;

commit;

-- Faz o site enxergar as tabelas novas na hora
notify pgrst, 'reload schema';

-- Conferência: preço e duração
select * from public.config_pro;
