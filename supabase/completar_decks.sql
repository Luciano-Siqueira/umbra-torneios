-- Completa o deck vazio de um jogador com o deck que ele usou no torneio mais recente.
-- Compara os nomes sem diferenciar maiúsculas. Quem nunca informou um deck continua vazio.
--
-- 1. Rode só a PARTE 1 e confira a lista. Ela não altera nada.
-- 2. Faça um backup pelo site (Importar / Exportar > Backup completo).
-- 3. Selecione o que está entre as marcas da PARTE 2, sem as linhas de comentário
--    /* e */, e rode só esse trecho.
--
-- Cada torneio alterado ganha uma nova versão, para que um aparelho com cópia antiga
-- avise do conflito em vez de sobrescrever o deck.

-- PARTE 1: prévia ------------------------------------------------------------
with inscricoes as (
  select
    t.id,
    t.nome as torneio,
    j.valor->>'nome' as jogador,
    lower(trim(j.valor->>'nome')) as chave,
    nullif(trim(j.valor->>'deck'), '') as deck,
    coalesce(t.dados->>'dataCriacao', '') as data
  from public.torneios t
  cross join lateral jsonb_array_elements(coalesce(t.dados->'jogadores', '[]'::jsonb)) as j(valor)
),
deck_conhecido as (
  select distinct on (chave) chave, deck
  from inscricoes
  where deck is not null
  order by chave, data desc
)
select i.torneio, i.jogador, c.deck as deck_que_sera_usado
from inscricoes i
left join deck_conhecido c using (chave)
where i.deck is null
order by c.deck is null, i.torneio, i.jogador;
-- Linhas com deck_que_sera_usado vazio continuarão sem deck.

-- PARTE 2: alteração ---------------------------------------------------------
/*
begin;

with inscricoes as (
  select
    lower(trim(j.valor->>'nome')) as chave,
    nullif(trim(j.valor->>'deck'), '') as deck,
    coalesce(t.dados->>'dataCriacao', '') as data
  from public.torneios t
  cross join lateral jsonb_array_elements(coalesce(t.dados->'jogadores', '[]'::jsonb)) as j(valor)
),
deck_conhecido as (
  select distinct on (chave) chave, deck
  from inscricoes
  where deck is not null
  order by chave, data desc
),
novos as (
  select
    t.id,
    jsonb_agg(
      case
        when nullif(trim(j.valor->>'deck'), '') is null and c.deck is not null
          then j.valor || jsonb_build_object('deck', c.deck)
        else j.valor
      end
      order by j.ordem
    ) as jogadores
  from public.torneios t
  cross join lateral jsonb_array_elements(t.dados->'jogadores') with ordinality as j(valor, ordem)
  left join deck_conhecido c on c.chave = lower(trim(j.valor->>'nome'))
  where jsonb_typeof(t.dados->'jogadores') = 'array'
  group by t.id
  having bool_or(nullif(trim(j.valor->>'deck'), '') is null and c.deck is not null)
)
update public.torneios t
set dados = t.dados || jsonb_build_object(
  'jogadores', n.jogadores,
  'versao', coalesce((t.dados->>'versao')::int, 0) + 1
)
from novos n
where t.id = n.id;

commit;
*/
