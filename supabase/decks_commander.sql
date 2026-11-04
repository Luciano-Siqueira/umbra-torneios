-- Decks de Commander lançados depois da lista que acompanha o site.
-- Todos os logados leem; só admin grava, pelo botão "Atualizar decks".
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo.

begin;

create table if not exists public.decks_commander (
  colecao text not null,
  nome text not null,
  lancamento date not null,
  comandantes text not null,
  cartas integer not null default 100 check (cartas >= 0),
  tokens integer not null default 0 check (tokens >= 0),
  cores text not null default '' check (cores ~ '^W?U?B?R?G?$'),
  atualizado_em timestamptz not null default now(),
  primary key (colecao, nome)
);

alter table public.decks_commander enable row level security;
revoke all on public.decks_commander from public, anon;
grant select, insert, update, delete on public.decks_commander to authenticated;

drop policy if exists "decks_leitura" on public.decks_commander;
create policy "decks_leitura" on public.decks_commander
  for select to authenticated
  using (true);

drop policy if exists "decks_escrita_admin" on public.decks_commander;
create policy "decks_escrita_admin" on public.decks_commander
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

commit;

-- Conferência: deve mostrar 0 decks enquanto nenhum lançamento novo for adicionado
select count(*) as decks_adicionados from public.decks_commander;
