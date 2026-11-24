-- =============================================================================
-- LinguaGo · teste de RLS e permissões
-- Rodar no SQL Editor DEPOIS de 001_init.sql e 002_validate_lesson_day.sql.
-- Cria dois usuários de teste
-- (A e B), age como cada um, tenta o que deve e o que não deve funcionar,
-- e mostra uma tabela com OK/FALHOU. No fim apaga os usuários de teste.
-- Nenhuma linha de teste deve aparecer com ok = false.
-- =============================================================================

create temp table _r (n serial, test text, ok boolean, detail text);
create temp table _u (a uuid, b uuid);
grant select, insert on _r to authenticated, anon;
grant usage on sequence _r_n_seq to authenticated, anon;
grant select on _u to authenticated, anon;

insert into _u values (gen_random_uuid(), gen_random_uuid());

-- "hoje" no fuso do usuário A (America/Sao_Paulo): complete_lesson só aceita hoje ± 1 dia
create temp table _d as select (now() at time zone 'America/Sao_Paulo')::date as t;
grant select on _d to authenticated, anon;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
select a, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
       'rls-a-' || a || '@example.test', '{"name":"Teste A","declared_level":"basic","timezone":"America/Sao_Paulo"}'::jsonb, '{}'::jsonb, now(), now()
from _u
union all
select b, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
       'rls-b-' || b || '@example.test', '{"full_name":"Teste B Google","timezone":"Fuso/Invalido"}'::jsonb, '{}'::jsonb, now(), now()
from _u;

-- gatilho criou os perfis?
insert into _r (test, ok, detail)
select 'gatilho criou perfil A com nome e nível do cadastro', p.name = 'Teste A' and p.declared_level = 'basic', p.name || ' / ' || coalesce(p.declared_level, 'null')
from public.profiles p, _u where p.id = _u.a;
insert into _r (test, ok, detail)
select 'gatilho: nome do Google (full_name) e fuso inválido vira padrão', p.name = 'Teste B Google' and p.timezone = 'America/Sao_Paulo', p.name || ' / ' || p.timezone
from public.profiles p, _u where p.id = _u.b;


-- =============================================================================
-- Como usuário A
-- =============================================================================
select set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, false) from _u;
set role authenticated;

do $$ declare r jsonb; begin
  r := public.complete_lesson('u1-l1', 4, 8, (select t from _d));
  insert into _r (test, ok, detail) values ('A: complete_lesson grava 4 acertos = 40 XP', (r ->> 'xp')::int = 40, r::text);
exception when others then insert into _r (test, ok, detail) values ('A: complete_lesson grava 4 acertos = 40 XP', false, sqlerrm);
end $$;

do $$ declare r jsonb; begin
  r := public.complete_lesson('u1-l1', 8, 8, (select t from _d));
  insert into _r (test, ok, detail) values ('A: refazer a lição soma no dia e guarda o melhor XP',
    (select xp = 120 and lessons = 2 from public.daily_activity where day = (select t from _d))
    and (select best_xp = 80 and attempts = 2 from public.lesson_progress where lesson_id = 'u1-l1'), r::text);
exception when others then insert into _r (test, ok, detail) values ('A: refazer a lição soma no dia e guarda o melhor XP', false, sqlerrm);
end $$;

-- >>> pedido explícito: update direto em daily_activity.xp pelo cliente deve falhar
do $$ begin
  update public.daily_activity set xp = 99999;
  insert into _r (test, ok, detail) values ('A: UPDATE direto em daily_activity.xp é bloqueado', false, 'update foi aceito');
exception when insufficient_privilege then insert into _r (test, ok, detail) values ('A: UPDATE direto em daily_activity.xp é bloqueado', true, sqlerrm);
  when others then insert into _r (test, ok, detail) values ('A: UPDATE direto em daily_activity.xp é bloqueado', false, 'erro inesperado: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.daily_activity (user_id, day, xp) values ((select a from _u), '2026-11-25', 500);
  insert into _r (test, ok, detail) values ('A: INSERT direto em daily_activity é bloqueado', false, 'insert foi aceito');
exception when insufficient_privilege then insert into _r (test, ok, detail) values ('A: INSERT direto em daily_activity é bloqueado', true, sqlerrm);
  when others then insert into _r (test, ok, detail) values ('A: INSERT direto em daily_activity é bloqueado', false, 'erro inesperado: ' || sqlerrm);
end $$;

do $$ begin
  update public.lesson_progress set best_xp = 9999;
  insert into _r (test, ok, detail) values ('A: UPDATE direto em lesson_progress é bloqueado', false, 'update foi aceito');
exception when insufficient_privilege then insert into _r (test, ok, detail) values ('A: UPDATE direto em lesson_progress é bloqueado', true, sqlerrm);
  when others then insert into _r (test, ok, detail) values ('A: UPDATE direto em lesson_progress é bloqueado', false, 'erro inesperado: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.lesson_attempts (user_id, lesson_id, xp, score, total, day) values ((select a from _u), 'u1-l2', 200, 20, 20, '2026-11-24');
  insert into _r (test, ok, detail) values ('A: INSERT direto em lesson_attempts é bloqueado', false, 'insert foi aceito');
exception when insufficient_privilege then insert into _r (test, ok, detail) values ('A: INSERT direto em lesson_attempts é bloqueado', true, sqlerrm);
  when others then insert into _r (test, ok, detail) values ('A: INSERT direto em lesson_attempts é bloqueado', false, 'erro inesperado: ' || sqlerrm);
end $$;

do $$ begin
  delete from public.lesson_attempts;
  insert into _r (test, ok, detail) values ('A: DELETE em lesson_attempts é bloqueado', false, 'delete foi aceito');
exception when insufficient_privilege then insert into _r (test, ok, detail) values ('A: DELETE em lesson_attempts é bloqueado', true, sqlerrm);
  when others then insert into _r (test, ok, detail) values ('A: DELETE em lesson_attempts é bloqueado', false, 'erro inesperado: ' || sqlerrm);
end $$;

-- teto de XP: pontuação maior que o total, e lição gigante
do $$ begin
  perform public.complete_lesson('u1-l2', 50, 8, (select t from _d));
  insert into _r (test, ok, detail) values ('A: complete_lesson recusa acertos > total', false, 'aceitou');
exception when others then insert into _r (test, ok, detail) values ('A: complete_lesson recusa acertos > total', sqlstate = '22023', sqlerrm);
end $$;

do $$ begin
  perform public.complete_lesson('u1-l2', 999, 999, (select t from _d));
  insert into _r (test, ok, detail) values ('A: complete_lesson recusa lição acima do teto (20 exercícios)', false, 'aceitou');
exception when others then insert into _r (test, ok, detail) values ('A: complete_lesson recusa lição acima do teto (20 exercícios)', sqlstate = '22023', sqlerrm);
end $$;

-- >>> pedido explícito: data falsa deve ser recusada (só vale hoje ± 1 dia no fuso do perfil)
do $$ begin
  perform public.complete_lesson('u1-l2', 8, 8, (select t + 2 from _d));
  insert into _r (test, ok, detail) values ('A: complete_lesson recusa data falsa no futuro (hoje + 2)', false, 'aceitou');
exception when others then insert into _r (test, ok, detail) values ('A: complete_lesson recusa data falsa no futuro (hoje + 2)', sqlstate = '22023' and sqlerrm like 'Dia fora do permitido%', sqlerrm);
end $$;

do $$ begin
  perform public.complete_lesson('u1-l2', 8, 8, (select t - 2 from _d));
  insert into _r (test, ok, detail) values ('A: complete_lesson recusa data falsa no passado (hoje - 2)', false, 'aceitou');
exception when others then insert into _r (test, ok, detail) values ('A: complete_lesson recusa data falsa no passado (hoje - 2)', sqlstate = '22023' and sqlerrm like 'Dia fora do permitido%', sqlerrm);
end $$;

do $$ begin
  insert into _r (test, ok, detail)
  select 'A: datas recusadas não gravaram nada', count(*) = 0, count(*) || ' linha(s) fora de hoje'
  from public.daily_activity where day <> (select t from _d);
exception when others then insert into _r (test, ok, detail) values ('A: datas recusadas não gravaram nada', false, sqlerrm);
end $$;

-- profiles: colunas liberadas x colunas protegidas
do $$ declare n int; begin
  update public.profiles set name = 'A renomeado', timezone = 'America/Manaus', placement_level = 'A2', placement_score = 7, placement_total = 10, placed_on = '2026-11-24'
   where id = (select a from _u);
  get diagnostics n = row_count;
  insert into _r (test, ok, detail) values ('A: pode editar name, timezone e placement_* do próprio perfil', n = 1, n || ' linha(s)');
exception when others then insert into _r (test, ok, detail) values ('A: pode editar name, timezone e placement_* do próprio perfil', false, sqlerrm);
end $$;

do $$ begin
  update public.profiles set legacy_xp = 99999 where id = (select a from _u);
  insert into _r (test, ok, detail) values ('A: UPDATE em profiles.legacy_xp é bloqueado', false, 'update foi aceito');
exception when insufficient_privilege then insert into _r (test, ok, detail) values ('A: UPDATE em profiles.legacy_xp é bloqueado', true, sqlerrm);
  when others then insert into _r (test, ok, detail) values ('A: UPDATE em profiles.legacy_xp é bloqueado', false, 'erro inesperado: ' || sqlerrm);
end $$;

do $$ begin
  update public.profiles set legacy_imported_at = null where id = (select a from _u);
  insert into _r (test, ok, detail) values ('A: UPDATE em profiles.legacy_imported_at é bloqueado', false, 'update foi aceito');
exception when insufficient_privilege then insert into _r (test, ok, detail) values ('A: UPDATE em profiles.legacy_imported_at é bloqueado', true, sqlerrm);
  when others then insert into _r (test, ok, detail) values ('A: UPDATE em profiles.legacy_imported_at é bloqueado', false, 'erro inesperado: ' || sqlerrm);
end $$;

do $$ begin
  update public.profiles set timezone = 'Fuso/Invalido' where id = (select a from _u);
  insert into _r (test, ok, detail) values ('A: fuso inválido é recusado', false, 'aceitou');
exception when others then insert into _r (test, ok, detail) values ('A: fuso inválido é recusado', sqlstate = '22023', sqlerrm);
end $$;

do $$ begin
  insert into public.profiles (id, name) values (gen_random_uuid(), 'intruso');
  insert into _r (test, ok, detail) values ('A: INSERT direto em profiles é bloqueado', false, 'insert foi aceito');
exception when insufficient_privilege then insert into _r (test, ok, detail) values ('A: INSERT direto em profiles é bloqueado', true, sqlerrm);
  when others then insert into _r (test, ok, detail) values ('A: INSERT direto em profiles é bloqueado', false, 'erro inesperado: ' || sqlerrm);
end $$;

do $$ declare n int; begin
  update public.profiles set name = 'hackeado' where id = (select b from _u);
  get diagnostics n = row_count;
  insert into _r (test, ok, detail) values ('A: não altera o perfil de B (0 linhas)', n = 0, n || ' linha(s)');
exception when others then insert into _r (test, ok, detail) values ('A: não altera o perfil de B (0 linhas)', false, sqlerrm);
end $$;

-- importação: uma vez só (dias antigos: hoje - 3 e hoje - 2)
do $$ declare r jsonb; v_t date := (select t from _d); begin
  r := public.import_local_progress(jsonb_build_object(
    'completed', jsonb_build_array('u1-l1', 'u1-l2'),
    'days', jsonb_build_object((v_t - 3)::text, 0, (v_t - 2)::text, 140),
    'lessonXp', jsonb_build_object('u1-l2', 70),
    'legacyXp', 150,
    'placement', jsonb_build_object('level', 'B1', 'score', 8, 'total', 10, 'date', (v_t - 2)::text)));
  insert into _r (test, ok, detail) values ('A: import_local_progress importa dias, lições, XP antigo e nível',
    (select legacy_xp = 150 and legacy_imported_at is not null and placement_level = 'B1' from public.profiles where id = (select a from _u)), r::text);
exception when others then insert into _r (test, ok, detail) values ('A: import_local_progress importa dias, lições, XP antigo e nível', false, sqlerrm);
end $$;

do $$ begin
  perform public.import_local_progress('{"legacyXp":150}');
  insert into _r (test, ok, detail) values ('A: segunda importação é recusada', false, 'aceitou');
exception when others then insert into _r (test, ok, detail) values ('A: segunda importação é recusada', sqlstate = 'P0001', sqlerrm);
end $$;

-- XP total = 120 (hoje) + 140 (hoje - 2) + 0 (hoje - 3) + 150 (antigo) = 410
do $$ begin
  insert into _r (test, ok, detail)
  select 'A: user_stats.total_xp = soma dos dias + XP antigo (410)', total_xp = 410 and lessons_completed = 2, total_xp || ' XP, ' || lessons_completed || ' lições'
  from public.user_stats;
exception when others then insert into _r (test, ok, detail) values ('A: user_stats.total_xp = soma dos dias + XP antigo (410)', false, sqlerrm);
end $$;

reset role;


-- =============================================================================
-- Como usuário B: não enxerga nada de A
-- =============================================================================
select set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, false) from _u;
set role authenticated;

do $$ begin
  insert into _r (test, ok, detail) select 'B: não vê daily_activity de A', count(*) = 0, count(*) || ' linha(s)' from public.daily_activity;
  insert into _r (test, ok, detail) select 'B: não vê lesson_progress de A', count(*) = 0, count(*) || ' linha(s)' from public.lesson_progress;
  insert into _r (test, ok, detail) select 'B: não vê lesson_attempts de A', count(*) = 0, count(*) || ' linha(s)' from public.lesson_attempts;
  insert into _r (test, ok, detail) select 'B: só vê o próprio perfil', count(*) = 1, count(*) || ' linha(s)' from public.profiles;
  insert into _r (test, ok, detail) select 'B: user_stats só mostra B (0 XP)', count(*) = 1 and coalesce(sum(total_xp), -1) = 0, count(*) || ' linha(s)' from public.user_stats;
exception when others then insert into _r (test, ok, detail) values ('B: leitura isolada', false, sqlerrm);
end $$;

reset role;


-- =============================================================================
-- Sem login (anon): nada
-- =============================================================================
select set_config('request.jwt.claims', '{"role":"anon"}', false);
set role anon;

do $$ begin
  perform count(*) from public.profiles;
  insert into _r (test, ok, detail) values ('anon: não lê profiles', false, 'leitura aceita');
exception when insufficient_privilege then insert into _r (test, ok, detail) values ('anon: não lê profiles', true, sqlerrm);
  when others then insert into _r (test, ok, detail) values ('anon: não lê profiles', false, 'erro inesperado: ' || sqlerrm);
end $$;

do $$ begin
  perform public.complete_lesson('u1-l1', 8, 8, (select t from _d));
  insert into _r (test, ok, detail) values ('anon: não chama complete_lesson', false, 'chamada aceita');
exception when insufficient_privilege then insert into _r (test, ok, detail) values ('anon: não chama complete_lesson', true, sqlerrm);
  when others then insert into _r (test, ok, detail) values ('anon: não chama complete_lesson', false, 'erro inesperado: ' || sqlerrm);
end $$;

reset role;
select set_config('request.jwt.claims', '', false);


-- =============================================================================
-- Limpeza (apaga os usuários de teste e, em cascata, todos os dados deles)
-- =============================================================================
delete from auth.users where id in (select a from _u union select b from _u);
insert into _r (test, ok, detail)
select 'limpeza: dados de teste apagados em cascata', count(*) = 0, count(*) || ' perfil(is) restante(s)'
from public.profiles where id in (select a from _u union select b from _u);

select n, case when ok then 'OK' else 'FALHOU' end as resultado, test as teste, detail as detalhe
from _r order by ok, n;
