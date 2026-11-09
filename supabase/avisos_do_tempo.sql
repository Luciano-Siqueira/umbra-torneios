-- Avisos de "tempo extra" e "último turno" saindo do servidor, a cada minuto, sem depender do
-- celular de quem organiza estar com a tela acesa. O app do organizador continua pedindo também,
-- como reserva; a função avisar-mesas só manda cada aviso uma vez (avisos_enviados).
--
-- ANTES de rodar este arquivo, guarde o endereço do projeto no cofre, uma vez só, num SQL separado
-- (o mesmo endereço de VITE_SUPABASE_URL; não é segredo):
--   select vault.create_secret('https://SEU-PROJETO.supabase.co', 'url_projeto');
-- E publique de novo a função avisar-mesas com "Verify JWT" DESLIGADO (ela confere o login sozinha).
--
-- Precisa de config_avisos.sql já rodado (tabela avisos_enviados).
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

begin;

-- Segredo que só o banco e a função conhecem: prova que o pedido veio daqui. Criado sozinho.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'avisos_tempo_segredo') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'avisos_tempo_segredo'
    );
  end if;
end;
$$;

-- A função avisar-mesas confere o segredo por aqui (só com a chave de serviço)
create or replace function public.segredo_avisos_confere(p_segredo text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from vault.decrypted_secrets
     where name = 'avisos_tempo_segredo' and decrypted_secret = p_segredo
  );
$$;
revoke all on function public.segredo_avisos_confere(text) from public, anon, authenticated;
grant execute on function public.segredo_avisos_confere(text) to service_role;

-- Procura rodadas com o relógio correndo que acabaram de entrar no tempo extra ou de terminar,
-- e pede o aviso à função avisar-mesas. Mesma conta do app (src/core/timer.ts e AvisosDoTempo.tsx):
-- segundos até o fim = (tempo normal + extra) - (agora - início - segundos pausados).
-- Janela de 2 minutos: não avisa atrasado quem ficou muito tempo sem conferir.
create or replace function public.conferir_avisos_do_tempo()
returns int
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_url text;
  v_segredo text;
  r record;
  v_tipo text;
  v_pedidos int := 0;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'url_projeto' limit 1;
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'avisos_tempo_segredo' limit 1;
  if v_url is null or v_segredo is null then
    return 0;
  end if;

  for r in
    select
      t.id::text as torneio_id,
      (t.dados->>'rodadaAtual')::int as rodada,
      coalesce((t.dados->>'tempoExtraMin')::numeric, 0) * 60 as extra_seg,
      (coalesce((t.dados->>'tempoRodadaMin')::numeric, 0) + coalesce((t.dados->>'tempoExtraMin')::numeric, 0)) * 60
        - (extract(epoch from now() - (t.dados->'timer'->>'iniciadoEm')::timestamptz)
           - coalesce((t.dados->'timer'->>'segundosPausados')::numeric, 0)) as ate_o_fim
    from public.torneios t
    where coalesce((t.dados->>'finalizado')::boolean, false) = false
      and jsonb_typeof(t.dados->'timer') = 'object'
      and t.dados->'timer'->>'iniciadoEm' is not null
      and coalesce(t.dados->'timer'->>'pausadoEm', '') = ''
      and coalesce((t.dados->'timer'->>'parado')::boolean, false) = false
  loop
    v_tipo := case
      when r.ate_o_fim <= 0 and r.ate_o_fim > -120 then 'ultimo_turno'
      when r.extra_seg > 0 and r.ate_o_fim <= r.extra_seg and r.ate_o_fim > r.extra_seg - 120 then 'extra'
    end;
    continue when v_tipo is null;
    continue when exists (
      select 1 from public.avisos_enviados a
       where a.torneio_id = r.torneio_id and a.rodada = r.rodada and a.tipo = v_tipo
    );

    perform net.http_post(
      url := rtrim(v_url, '/') || '/functions/v1/avisar-mesas',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-avisos-segredo', v_segredo),
      body := jsonb_build_object('tipo', v_tipo, 'torneio_id', r.torneio_id, 'rodada', r.rodada)
    );
    v_pedidos := v_pedidos + 1;
  end loop;
  return v_pedidos;
end;
$$;
revoke all on function public.conferir_avisos_do_tempo() from public, anon, authenticated;

commit;

-- Agenda a conferência a cada minuto (troca a anterior, se existir)
select cron.unschedule(jobid) from cron.job where jobname = 'avisos-do-tempo';
select cron.schedule('avisos-do-tempo', '* * * * *', 'select public.conferir_avisos_do_tempo()');

-- Conferência: o endereço guardado, o segredo criado e o agendamento
select name from vault.secrets where name in ('url_projeto', 'avisos_tempo_segredo');
select jobname, schedule, active from cron.job where jobname = 'avisos-do-tempo';

-- Para conferir com uma rodada em andamento: os minutos que faltam devem bater com o relógio do app
-- select t.dados->>'nome' as torneio, t.dados->>'rodadaAtual' as rodada,
--        round(((coalesce((t.dados->>'tempoRodadaMin')::numeric, 0) + coalesce((t.dados->>'tempoExtraMin')::numeric, 0)) * 60
--          - (extract(epoch from now() - (t.dados->'timer'->>'iniciadoEm')::timestamptz)
--             - coalesce((t.dados->'timer'->>'segundosPausados')::numeric, 0))) / 60, 1) as minutos_ate_o_fim
--   from public.torneios t
--  where jsonb_typeof(t.dados->'timer') = 'object' and coalesce((t.dados->>'finalizado')::boolean, false) = false;
--
-- Últimas execuções do agendamento e respostas da função:
-- select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
-- select status_code, content, created from net._http_response order by created desc limit 5;
