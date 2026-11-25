-- =============================================================================
-- LinguaGo · 003_remove_local_import
-- Remove a importação do progresso antigo do navegador (localStorage), que o
-- app não usa mais: a função import_local_progress e as colunas
-- profiles.legacy_xp e profiles.legacy_imported_at.
-- O XP total (view user_stats) passa a ser só a soma de daily_activity.
--
-- Rodar uma vez no SQL Editor do Supabase (como postgres), depois de
-- 002_validate_lesson_day.sql e DEPOIS de publicar o site que não lê mais
-- essas colunas (o site antigo quebraria ao carregar o progresso).
--
-- Trava: se algum perfil tiver legacy_xp > 0, nada é alterado. Apagar a coluna
-- tiraria esse XP do total da pessoa, sem volta.
-- =============================================================================

begin;

do $$
declare
  v_perfis int;
  v_xp     bigint;
begin
  select count(*), coalesce(sum(legacy_xp), 0) into v_perfis, v_xp
  from public.profiles where legacy_xp > 0;
  if v_perfis > 0 then
    raise exception 'Abortado: % perfil(is) com legacy_xp > 0 (% XP no total). Decida o que fazer com esse XP antes de rodar esta migração.', v_perfis, v_xp;
  end if;
end $$;

-- 1. A view deixa de usar legacy_xp. Mesmas colunas: create or replace mantém
--    dono e permissões (select só para authenticated).
create or replace view public.user_stats with (security_invoker = true) as
select
  p.id as user_id,
  coalesce((select sum(d.xp) from public.daily_activity d where d.user_id = p.id), 0)::int as total_xp,
  (select count(*) from public.lesson_progress lp where lp.user_id = p.id)::int as lessons_completed
from public.profiles p;

-- 2. Sem a função de importação, toda gravação de XP passa só por complete_lesson().
drop function public.import_local_progress(jsonb);

-- 3. Colunas que só a importação usava. Nunca foram editáveis pelo cliente
--    (fora do GRANT UPDATE por coluna), então as permissões não mudam.
alter table public.profiles
  drop column legacy_xp,
  drop column legacy_imported_at;

comment on column public.lesson_progress.attempts is
  'Conclusões reais. Linhas criadas pela antiga importação do navegador (removida em 003) podem ter 0.';

commit;
