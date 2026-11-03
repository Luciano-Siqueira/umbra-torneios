-- Auditoria das regras de acesso. Só lê, não altera nada.
-- Rode no SQL Editor do Supabase e envie o resultado para revisão.

select
  'tabela' as item,
  c.relname as nome,
  case when c.relrowsecurity then 'RLS ligado' else 'RLS DESLIGADO' end as detalhe,
  null as regra,
  null as condicao,
  null as verificacao
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'

union all

select
  'policy',
  p.tablename,
  p.policyname || ' (' || p.cmd || ', ' || array_to_string(p.roles, ',') || ')',
  p.permissive,
  p.qual,
  p.with_check
from pg_policies p
where p.schemaname = 'public'

union all

-- Funções que qualquer um pode chamar: as de admin precisam checar eh_admin() por dentro
select
  'funcao',
  f.proname,
  case when f.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end,
  case when position('eh_admin' in f.prosrc) > 0 then 'checa eh_admin' else 'NAO checa eh_admin' end,
  case when has_function_privilege('anon', f.oid, 'execute') then 'anon pode executar' else 'anon nao executa' end,
  null
from pg_proc f
join pg_namespace n on n.oid = f.pronamespace
where n.nspname = 'public'

order by 1 desc, 2, 3;
