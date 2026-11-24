-- =============================================================================
-- LinguaGo · 002_validate_lesson_day
-- complete_lesson passa a recusar um dia fora de "hoje ± 1 dia", com "hoje"
-- calculado no fuso salvo no perfil do usuário (profiles.timezone).
--
-- A folga de 1 dia cobre a virada da meia-noite durante a lição e pequenas
-- diferenças entre o fuso do aparelho e o do perfil (o app sincroniza o fuso
-- do perfil com o do navegador a cada login).
--
-- Rodar uma vez no SQL Editor do Supabase (como postgres), depois de 001_init.sql.
-- Só troca o corpo da função: assinatura, dono e permissões continuam os mesmos.
-- =============================================================================

create or replace function public.complete_lesson(p_lesson_id text, p_score int, p_total int, p_day date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_xp_per_correct constant int := 10;
  c_max_exercises  constant int := 20;
  c_day_tolerance  constant int := 1;
  v_uid   uuid := auth.uid();
  v_xp    int;
  v_tz    text;
  v_today date;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if p_lesson_id is null or p_lesson_id !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'Lição inválida' using errcode = '22023';
  end if;
  if p_total is null or p_total < 1 or p_total > c_max_exercises then
    raise exception 'Total de exercícios inválido' using errcode = '22023';
  end if;
  if p_score is null or p_score < 0 or p_score > p_total then
    raise exception 'Pontuação inválida' using errcode = '22023';
  end if;
  if p_day is null then
    raise exception 'Dia obrigatório' using errcode = '22023';
  end if;

  -- garante o perfil (contas criadas antes do gatilho)
  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  -- "hoje" no fuso do perfil; o fuso já é validado ao ser gravado
  select timezone into v_tz from public.profiles where id = v_uid;
  v_today := (pg_catalog.now() at time zone coalesce(v_tz, 'America/Sao_Paulo'))::date;

  if p_day < v_today - c_day_tolerance or p_day > v_today + c_day_tolerance then
    raise exception 'Dia fora do permitido: % (hoje no fuso % é %)', p_day, v_tz, v_today
      using errcode = '22023', hint = 'invalid_day';
  end if;

  v_xp := p_score * c_xp_per_correct;

  insert into public.lesson_attempts (user_id, lesson_id, xp, score, total, day)
  values (v_uid, p_lesson_id, v_xp, p_score, p_total, p_day);

  insert into public.lesson_progress as lp (user_id, lesson_id, best_xp, attempts)
  values (v_uid, p_lesson_id, v_xp, 1)
  on conflict (user_id, lesson_id) do update
    set best_xp           = greatest(lp.best_xp, excluded.best_xp),
        attempts          = lp.attempts + 1,
        last_completed_at = pg_catalog.now();

  insert into public.daily_activity as d (user_id, day, xp, lessons)
  values (v_uid, p_day, v_xp, 1)
  on conflict (user_id, day) do update
    set xp         = d.xp + excluded.xp,
        lessons    = d.lessons + 1,
        updated_at = pg_catalog.now();

  return jsonb_build_object('xp', v_xp, 'day', p_day);
end;
$$;

-- Reforça as permissões (create or replace mantém as de 001, mas fica explícito)
revoke all on function public.complete_lesson(text, int, int, date) from public, anon, authenticated;
grant execute on function public.complete_lesson(text, int, int, date) to authenticated;
