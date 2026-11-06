-- O que cada jogador vê dentro do torneio: a aba Mesas e o temporizador.
-- Sem linha, fica escondido. O admin liga e desliga na tela Usuários.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo.

begin;

create table if not exists public.permissoes_jogador (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ver_mesas boolean not null default false,
  ver_tempo boolean not null default false,
  atualizado_em timestamptz not null default now()
);

alter table public.permissoes_jogador enable row level security;
revoke all on public.permissoes_jogador from public, anon;
grant select, insert, update, delete on public.permissoes_jogador to authenticated;

-- Cada um lê só a própria linha; o admin lê todas
drop policy if exists "permissoes_leitura" on public.permissoes_jogador;
create policy "permissoes_leitura" on public.permissoes_jogador
  for select to authenticated
  using (user_id = auth.uid() or public.eh_admin());

-- Só o admin grava
drop policy if exists "permissoes_escrita_admin" on public.permissoes_jogador;
create policy "permissoes_escrita_admin" on public.permissoes_jogador
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

commit;

-- Conferência: mostra quem já tem algo liberado
select user_id, ver_mesas, ver_tempo from public.permissoes_jogador order by atualizado_em desc;
