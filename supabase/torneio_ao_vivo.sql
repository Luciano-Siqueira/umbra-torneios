-- Dados ao vivo dos torneios: timer e mesas da rodada atual.
-- Linha pequena para o Realtime não enviar o torneio inteiro a cada mudança.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo sem problema.

create table if not exists public.torneio_ao_vivo (
  torneio_id text primary key,
  rodada integer not null default 0,
  finalizado boolean not null default false,
  mesas jsonb not null default '[]'::jsonb,
  timer jsonb,
  atualizado_em timestamptz not null default now()
);

alter table public.torneio_ao_vivo enable row level security;

-- Só tem ids de jogadores e o timer: qualquer usuário logado pode ler
drop policy if exists "ao_vivo_leitura" on public.torneio_ao_vivo;
create policy "ao_vivo_leitura" on public.torneio_ao_vivo
  for select to authenticated
  using (true);

-- Só admin ou organizador altera
drop policy if exists "ao_vivo_escrita" on public.torneio_ao_vivo;
create policy "ao_vivo_escrita" on public.torneio_ao_vivo
  for all to authenticated
  using (
    public.eh_admin()
    or exists (select 1 from public.organizadores o where o.user_id = auth.uid())
  )
  with check (
    public.eh_admin()
    or exists (select 1 from public.organizadores o where o.user_id = auth.uid())
  );

-- Hora do servidor: mantém o relógio igual em todos os aparelhos
create or replace function public.agora_servidor()
returns timestamptz
language sql
stable
as $$ select now() $$;

grant execute on function public.agora_servidor() to authenticated;

-- Liga o Realtime na tabela
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'torneio_ao_vivo'
  ) then
    alter publication supabase_realtime add table public.torneio_ao_vivo;
  end if;
end $$;
