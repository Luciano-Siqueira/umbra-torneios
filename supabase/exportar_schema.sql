-- Exporta a estrutura do banco. Só lê, não traz dados de nenhum usuário.
-- Rode no SQL Editor do Supabase e salve o resultado em supabase/schema.sql.
-- Repita sempre que alterar tabelas, policies ou funções.

select trecho from (
  -- Tabelas e colunas
  select 1 as ordem, c.relname::text as nome,
    'create table public.' || c.relname || E' (\n' ||
    string_agg(
      '  ' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod) ||
      case when a.attnotnull then ' not null' else '' end ||
      coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), ''),
      E',\n' order by a.attnum
    ) || E'\n);' as trecho
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where n.nspname = 'public' and c.relkind = 'r'
  group by c.relname

  union all

  -- Chaves e restrições
  select 2, r.conrelid::regclass::text,
    'alter table ' || r.conrelid::regclass || ' add constraint ' || r.conname || ' ' || pg_get_constraintdef(r.oid) || ';'
  from pg_constraint r
  join pg_namespace n on n.oid = r.connamespace
  where n.nspname = 'public'

  union all

  -- RLS
  select 3, c.relname::text,
    'alter table public.' || c.relname || ' enable row level security;'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity

  union all

  -- Policies
  select 4, p.tablename::text,
    'create policy "' || p.policyname || '" on public.' || p.tablename ||
    ' for ' || p.cmd || ' to ' || array_to_string(p.roles, ', ') ||
    coalesce(' using (' || p.qual || ')', '') ||
    coalesce(' with check (' || p.with_check || ')', '') || ';'
  from pg_policies p
  where p.schemaname = 'public'

  union all

  -- Funções
  select 5, f.proname::text, pg_get_functiondef(f.oid) || ';'
  from pg_proc f
  join pg_namespace n on n.oid = f.pronamespace
  where n.nspname = 'public' and f.prokind = 'f'
) partes
order by ordem, nome, trecho;
