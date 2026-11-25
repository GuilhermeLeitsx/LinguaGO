import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { friendlyError, supabase } from '../lib/supabase.js'
import { betterPlacement, dayStr, normalizeProgress } from './progress.js'

// Progresso do usuário logado, lido do Supabase.
// Leitura: direto das tabelas (o RLS só devolve as linhas do próprio usuário).
// Escrita do XP: só pela função complete_lesson, que calcula e limita o XP
// no servidor. O dia enviado é sempre o dia LOCAL (dayStr).

const ProgressContext = createContext(null)

async function fetchProgress(uid) {
  const [prof, stats, lessons, days] = await Promise.all([
    supabase.from('profiles').select('placement_level, placement_score, placement_total, placed_on').eq('id', uid).single(),
    supabase.from('user_stats').select('total_xp').eq('user_id', uid).single(),
    supabase.from('lesson_progress').select('lesson_id, best_xp'),
    // a sequência e a semana só precisam dos dias recentes; o total vem de user_stats
    supabase.from('daily_activity').select('day, xp').order('day', { ascending: false }).limit(400),
  ])
  for (const r of [prof, stats, lessons, days]) if (r.error) throw r.error

  const pr = prof.data
  const p = normalizeProgress({
    completed: lessons.data.map((l) => l.lesson_id),
    lessonXp: Object.fromEntries(lessons.data.map((l) => [l.lesson_id, l.best_xp])),
    days: Object.fromEntries(days.data.map((d) => [d.day, d.xp])),
    placement: pr.placement_level
      ? { level: pr.placement_level, score: pr.placement_score, total: pr.placement_total, date: pr.placed_on }
      : null,
  })
  return { ...p, xp: stats.data.total_xp }
}

export function ProgressProvider({ children }) {
  const { user } = useAuth()
  const uid = user?.id ?? null
  // estado amarrado ao id que o carregou, para nunca mostrar o progresso de outra conta
  const [state, setState] = useState({ uid: null, progress: null, error: null })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!uid) return
    let alive = true
    fetchProgress(uid)
      .then((progress) => alive && setState({ uid, progress, error: null }))
      .catch((error) => alive && setState({ uid, progress: null, error }))
    return () => { alive = false }
  }, [uid, reloadKey])

  const reload = useCallback(async () => {
    const progress = await fetchProgress(uid)
    setState({ uid, progress, error: null })
    return progress
  }, [uid])

  // Registra uma lição concluída. O XP é calculado no servidor (10 por acerto).
  const completeLesson = useCallback(async (lessonId, score, total) => {
    const { error } = await supabase.rpc('complete_lesson', { p_lesson_id: lessonId, p_score: score, p_total: total, p_day: dayStr() })
    if (error) throw new Error(friendlyError(error))
    return reload()
  }, [reload])

  // Salva o teste de nivelamento. O nível liberado nunca diminui.
  const savePlacement = useCallback(async (result) => {
    const current = state.uid === uid ? state.progress?.placement : null
    const best = betterPlacement(current, { ...result, date: dayStr() })
    if (best !== current) {
      const { error } = await supabase.from('profiles').update({
        placement_level: best.level,
        placement_score: best.score,
        placement_total: best.total,
        placed_on: best.date,
      }).eq('id', uid)
      if (error) throw new Error(friendlyError(error))
    }
    return reload()
  }, [state, uid, reload])

  const mine = state.uid === uid
  const progress = mine ? state.progress : null
  const value = {
    progress,
    loading: !!uid && !mine,
    error: mine ? state.error : null,
    retry: () => setReloadKey((k) => k + 1),
    completeLesson,
    savePlacement,
  }
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProgressContext() {
  return useContext(ProgressContext)
}

// Progresso já carregado (as telas protegidas só renderizam depois do carregamento)
// eslint-disable-next-line react-refresh/only-export-components
export function useProgress() {
  return useContext(ProgressContext).progress
}
