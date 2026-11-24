-- =============================================================================
-- LinguaGo · 001_init
-- Perfis, progresso das lições, histórico de tentativas e atividade por dia.
--
-- Regras de segurança:
--   * RLS ativado em todas as tabelas.
--   * O cliente (role authenticated) só LÊ os próprios dados de progresso.
--     Toda gravação passa por complete_lesson() e import_local_progress(),
--     SECURITY DEFINER, com search_path = '' e usando auth.uid() (nunca um
--     user_id vindo do cliente). Assim o teto de XP vale de verdade.
--   * Em profiles, o cliente só edita name, declared_level, timezone e placement_*
--     (GRANT UPDATE por coluna; o RLS limita linhas, não colunas).
--   * anon não tem acesso a nada.
--
-- Datas: o dia de atividade (day) é calculado NO NAVEGADOR, no fuso local do
-- usuário (AAAA-MM-DD), e enviado como date. O servidor não converte de UTC.
-- A validação do dia (hoje ± 1 no fuso do perfil) vem em 002_validate_lesson_day.sql.
--
-- Rodar uma vez no SQL Editor do Supabase (como postgres).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  name               text not null default '' check (char_length(name) <= 80),
  declared_level     text check (declared_level in ('none', 'basic', 'intermediate', 'advanced')),
  timezone           text not null default 'America/Sao_Paulo' check (char_length(timezone) <= 64),
  placement_level    text check (placement_level in ('A1', 'A2', 'B1', 'B2', 'C1')),
  placement_score    int  check (placement_score >= 0),
  placement_total    int  check (placement_total > 0),
  placed_on          date,
  legacy_xp          int  not null default 0 check (legacy_xp >= 0),
  legacy_imported_at timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint placement_score_le_total check (placement_score is null or placement_total is null or placement_score <= placement_total)
);
comment on column public.profiles.declared_level is 'Opção escolhida no cadastro (LEVEL_CHOICES em src/data/levels.js).';
comment on column public.profiles.legacy_xp is 'XP importado do localStorage sem dia conhecido. Só import_local_progress() altera.';
comment on column public.profiles.legacy_imported_at is 'Quando o progresso local foi importado. Preenchido = importação já feita (roda uma vez só).';

-- Uma linha por lição concluída: alimenta a trilha (⭐ melhor XP / máximo)
create table public.lesson_progress (
  user_id            uuid not null references public.profiles (id) on delete cascade,
  lesson_id          text not null check (lesson_id ~ '^[a-z0-9-]{1,40}$'),
  best_xp            int  not null default 0 check (best_xp >= 0),
  attempts           int  not null default 0 check (attempts >= 0),
  first_completed_at timestamptz not null default now(),
  last_completed_at  timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
comment on column public.lesson_progress.attempts is 'Conclusões reais. Lições vindas da importação começam com 0.';

-- Histórico: uma linha por lição terminada (só recebe inserts, via complete_lesson)
create table public.lesson_attempts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  lesson_id  text not null check (lesson_id ~ '^[a-z0-9-]{1,40}$'),
  xp         int  not null check (xp >= 0),
  score      int  not null check (score >= 0),
  total      int  not null check (total > 0),
  day        date not null,
  created_at timestamptz not null default now(),
  constraint attempt_score_le_total check (score <= total)
);
create index lesson_attempts_user_created_idx on public.lesson_attempts (user_id, created_at desc);

-- Um registro por dia com estudo (dia local do usuário): streak, bolinhas e meta diária
create table public.daily_activity (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  day        date not null,
  xp         int  not null default 0 check (xp >= 0),
  lessons    int  not null default 0 check (lessons >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
comment on column public.daily_activity.day is 'Dia no fuso LOCAL do usuário, calculado no navegador.';

-- XP total = soma dos dias + XP antigo importado. Nunca é guardado em coluna.
create view public.user_stats with (security_invoker = true) as
select
  p.id as user_id,
  (p.legacy_xp + coalesce((select sum(d.xp) from public.daily_activity d where d.user_id = p.id), 0))::int as total_xp,
  (select count(*) from public.lesson_progress lp where lp.user_id = p.id)::int as lessons_completed
from public.profiles p;


-- -----------------------------------------------------------------------------
-- Permissões (o Supabase dá ALL para anon/authenticated em tabelas novas: tiramos)
-- -----------------------------------------------------------------------------

revoke all on table public.profiles, public.lesson_progress, public.lesson_attempts, public.daily_activity, public.user_stats
  from anon, authenticated;

grant select on table public.profiles, public.lesson_progress, public.lesson_attempts, public.daily_activity, public.user_stats
  to authenticated;

-- Única escrita direta permitida ao cliente: estas colunas do próprio perfil
grant update (name, declared_level, timezone, placement_level, placement_score, placement_total, placed_on)
  on table public.profiles to authenticated;


-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.lesson_attempts enable row level security;
alter table public.daily_activity  enable row level security;

create policy "profiles: ler o próprio" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "profiles: editar o próprio" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "lesson_progress: ler o próprio" on public.lesson_progress
  for select to authenticated using (user_id = (select auth.uid()));

create policy "lesson_attempts: ler o próprio" on public.lesson_attempts
  for select to authenticated using (user_id = (select auth.uid()));

create policy "daily_activity: ler o próprio" on public.daily_activity
  for select to authenticated using (user_id = (select auth.uid()));

-- Sem políticas de insert/update/delete nas tabelas de progresso: de propósito.


-- -----------------------------------------------------------------------------
-- Gatilhos de profiles
-- -----------------------------------------------------------------------------

-- Valida o fuso e atualiza updated_at em toda escrita
create function public.profiles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Fuso horário inválido: %', new.timezone using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_before_write
  before insert or update on public.profiles
  for each row execute function public.profiles_before_write();

-- Cria o perfil quando uma conta nasce no Supabase Auth.
-- Nome: "name" (cadastro por e-mail) ou "full_name" (Google). Nível e fuso vêm do cadastro.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name  text  := left(coalesce(
                     nullif(trim(v_meta ->> 'name'), ''),
                     nullif(trim(v_meta ->> 'full_name'), ''),
                     split_part(coalesce(new.email, ''), '@', 1)
                   ), 80);
  v_level text  := v_meta ->> 'declared_level';
  v_tz    text  := v_meta ->> 'timezone';
begin
  if v_level is not null and v_level not in ('none', 'basic', 'intermediate', 'advanced') then
    v_level := null;
  end if;
  -- fuso inválido não pode impedir o cadastro: cai no padrão
  if v_tz is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    v_tz := 'America/Sao_Paulo';
  end if;

  insert into public.profiles (id, name, declared_level, timezone)
  values (new.id, v_name, v_level, v_tz)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- complete_lesson: única forma de registrar uma lição concluída
-- -----------------------------------------------------------------------------
-- O XP é calculado aqui (10 por acerto), não recebido do cliente.
-- Teto: até 20 exercícios por lição => no máximo 200 XP por chamada.

create function public.complete_lesson(p_lesson_id text, p_score int, p_total int, p_day date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_xp_per_correct constant int := 10;
  c_max_exercises  constant int := 20;
  v_uid uuid := auth.uid();
  v_xp  int;
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

  v_xp := p_score * c_xp_per_correct;

  -- garante o perfil (contas criadas antes do gatilho)
  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  insert into public.lesson_attempts (user_id, lesson_id, xp, score, total, day)
  values (v_uid, p_lesson_id, v_xp, p_score, p_total, p_day);

  insert into public.lesson_progress as lp (user_id, lesson_id, best_xp, attempts)
  values (v_uid, p_lesson_id, v_xp, 1)
  on conflict (user_id, lesson_id) do update
    set best_xp           = greatest(lp.best_xp, excluded.best_xp),
        attempts          = lp.attempts + 1,
        last_completed_at = now();

  insert into public.daily_activity as d (user_id, day, xp, lessons)
  values (v_uid, p_day, v_xp, 1)
  on conflict (user_id, day) do update
    set xp         = d.xp + excluded.xp,
        lessons    = d.lessons + 1,
        updated_at = now();

  return jsonb_build_object('xp', v_xp, 'day', p_day);
end;
$$;


-- -----------------------------------------------------------------------------
-- import_local_progress: traz o progresso do localStorage, uma única vez
-- -----------------------------------------------------------------------------
-- Payload = progresso no formato v2 do app:
--   { completed: [..], days: { 'AAAA-MM-DD': xp }, lessonXp: { id: xp },
--     legacyXp: n, placement: { level, score, total, date } | null }
-- Tudo é validado e limitado. Dias e lições são SOMADOS ao que já existir.

create function public.import_local_progress(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_days        constant int := 3660;
  c_max_day_xp      constant int := 2000;
  c_max_lessons     constant int := 500;
  c_max_lesson_xp   constant int := 200;
  c_max_legacy_xp   constant int := 100000;
  c_levels          constant text[] := array['A1', 'A2', 'B1', 'B2', 'C1'];
  v_uid       uuid := auth.uid();
  v_imported  timestamptz;
  v_days      jsonb;
  v_lesson_xp jsonb;
  v_completed jsonb;
  v_place     jsonb;
  v_legacy    int;
  v_xp        int;
  v_n_days    int := 0;
  v_n_lessons int := 0;
  v_cur_level text;
  r record;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload inválido' using errcode = '22023';
  end if;

  v_days      := coalesce(p_payload -> 'days', '{}'::jsonb);
  v_lesson_xp := coalesce(p_payload -> 'lessonXp', '{}'::jsonb);
  v_completed := coalesce(p_payload -> 'completed', '[]'::jsonb);
  v_place     := p_payload -> 'placement';
  if jsonb_typeof(v_days) <> 'object' or jsonb_typeof(v_lesson_xp) <> 'object' or jsonb_typeof(v_completed) <> 'array' then
    raise exception 'Payload inválido' using errcode = '22023';
  end if;

  -- trava o perfil: duas importações simultâneas não passam juntas
  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;
  select legacy_imported_at into v_imported from public.profiles where id = v_uid for update;
  if v_imported is not null then
    raise exception 'Progresso local já importado em %', v_imported using errcode = 'P0001', hint = 'already_imported';
  end if;

  -- XP antigo sem dia
  if p_payload ? 'legacyXp' and jsonb_typeof(p_payload -> 'legacyXp') <> 'number' then
    raise exception 'legacyXp inválido' using errcode = '22023';
  end if;
  v_legacy := coalesce((p_payload ->> 'legacyXp')::int, 0);
  if v_legacy < 0 or v_legacy > c_max_legacy_xp then
    raise exception 'legacyXp fora do limite' using errcode = '22023';
  end if;

  -- dias
  if (select count(*) from jsonb_object_keys(v_days)) > c_max_days then
    raise exception 'Dias demais' using errcode = '22023';
  end if;
  for r in select key, value from jsonb_each(v_days) loop
    if r.key !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(r.value) <> 'number' then
      raise exception 'Dia inválido: %', r.key using errcode = '22023';
    end if;
    v_xp := (r.value #>> '{}')::int;
    if v_xp < 0 or v_xp > c_max_day_xp then
      raise exception 'XP do dia % fora do limite', r.key using errcode = '22023';
    end if;
    insert into public.daily_activity as d (user_id, day, xp, lessons)
    values (v_uid, r.key::date, v_xp, 0)
    on conflict (user_id, day) do update
      set xp = d.xp + excluded.xp, updated_at = now();
    v_n_days := v_n_days + 1;
  end loop;

  -- lições: concluídas + as que têm XP registrado
  for r in
    select s.id
    from (
      select jsonb_array_elements_text(v_completed) as id
      union
      select jsonb_object_keys(v_lesson_xp)
    ) s
  loop
    if r.id !~ '^[a-z0-9-]{1,40}$' then
      raise exception 'Lição inválida: %', r.id using errcode = '22023';
    end if;
    if v_lesson_xp ? r.id and jsonb_typeof(v_lesson_xp -> r.id) <> 'number' then
      raise exception 'XP da lição % inválido', r.id using errcode = '22023';
    end if;
    v_xp := coalesce((v_lesson_xp ->> r.id)::int, 0);
    if v_xp < 0 or v_xp > c_max_lesson_xp then
      raise exception 'XP da lição % fora do limite', r.id using errcode = '22023';
    end if;
    v_n_lessons := v_n_lessons + 1;
    if v_n_lessons > c_max_lessons then
      raise exception 'Lições demais' using errcode = '22023';
    end if;
    insert into public.lesson_progress as lp (user_id, lesson_id, best_xp, attempts)
    values (v_uid, r.id, v_xp, 0)
    on conflict (user_id, lesson_id) do update
      set best_xp = greatest(lp.best_xp, excluded.best_xp);
  end loop;

  -- teste de nivelamento: só sobe de nível, nunca desce
  if v_place is not null and jsonb_typeof(v_place) = 'object' and (v_place ->> 'level') = any (c_levels) then
    select placement_level into v_cur_level from public.profiles where id = v_uid;
    if v_cur_level is null or array_position(c_levels, v_place ->> 'level') > array_position(c_levels, v_cur_level) then
      update public.profiles set
        placement_level = v_place ->> 'level',
        placement_score = case when jsonb_typeof(v_place -> 'score') = 'number' then greatest((v_place ->> 'score')::int, 0) end,
        placement_total = case when jsonb_typeof(v_place -> 'total') = 'number' and (v_place ->> 'total')::int > 0 then (v_place ->> 'total')::int end,
        placed_on       = case when (v_place ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$' then (v_place ->> 'date')::date end
      where id = v_uid;
    end if;
  end if;

  update public.profiles
     set legacy_xp = legacy_xp + v_legacy,
         legacy_imported_at = now()
   where id = v_uid;

  return jsonb_build_object('days', v_n_days, 'lessons', v_n_lessons, 'legacy_xp', v_legacy);
end;
$$;


-- -----------------------------------------------------------------------------
-- Quem pode chamar as funções
-- -----------------------------------------------------------------------------
-- Por padrão, funções novas podem ser executadas por PUBLIC (e o Supabase ainda
-- concede a anon/authenticated). Fechamos tudo e liberamos só o necessário.

revoke all on function public.complete_lesson(text, int, int, date)  from public, anon, authenticated;
revoke all on function public.import_local_progress(jsonb)           from public, anon, authenticated;
revoke all on function public.handle_new_user()                      from public, anon, authenticated;
revoke all on function public.profiles_before_write()                from public, anon, authenticated;

grant execute on function public.complete_lesson(text, int, int, date) to authenticated;
grant execute on function public.import_local_progress(jsonb)          to authenticated;
