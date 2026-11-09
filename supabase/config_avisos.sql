-- Quais avisos (notificações) o Umbra Torneios envia, escolhidos pelo admin na tela Usuários,
-- e o registro dos avisos já enviados, para "faltam 10 minutos" e afins não chegarem repetidos.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo.

begin;

-- Uma linha só, com um interruptor por tipo de aviso. Tudo ligado de início.
create table if not exists public.config_avisos (
  id int primary key default 1 check (id = 1),
  mesa boolean not null default true,        -- a mesa de cada jogador quando a rodada começa
  faltam10 boolean not null default true,    -- faltam 10 minutos para o fim da rodada
  esgotado boolean not null default true,    -- tempo da rodada esgotado
  finalizado boolean not null default true,  -- torneio finalizado: ver o ranking
  aprovacao boolean not null default true,   -- aos admins: nome de jogador aguardando aprovação
  atualizado_em timestamptz not null default now()
);
insert into public.config_avisos (id) values (1) on conflict do nothing;

alter table public.config_avisos enable row level security;
revoke all on public.config_avisos from public, anon;
grant select, update on public.config_avisos to authenticated;

drop policy if exists "config_avisos_leitura" on public.config_avisos;
create policy "config_avisos_leitura" on public.config_avisos
  for select to authenticated using (true);

drop policy if exists "config_avisos_admin" on public.config_avisos;
create policy "config_avisos_admin" on public.config_avisos
  for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- Avisos que só saem uma vez por rodada (ou por torneio). Só a função avisar-mesas mexe aqui.
create table if not exists public.avisos_enviados (
  torneio_id text not null,
  rodada int not null,
  tipo text not null,
  enviado_em timestamptz not null default now(),
  primary key (torneio_id, rodada, tipo)
);
alter table public.avisos_enviados enable row level security;
revoke all on public.avisos_enviados from public, anon, authenticated;

commit;

-- Faz o site enxergar as tabelas novas na hora
notify pgrst, 'reload schema';

-- Conferência: a linha de configuração
select * from public.config_avisos;
