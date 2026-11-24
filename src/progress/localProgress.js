// Progresso antigo, salvo no localStorage antes do Supabase.
// Hoje só serve para a importação ("Importar progresso deste navegador") e para o backup em arquivo.
import { PROGRESS_PREFIX } from '../storage/migrations.js'
import { normalizeProgress } from './progress.js'

const key = (email) => `${PROGRESS_PREFIX}${email}`

export function loadLocalProgress(email) {
  try {
    return normalizeProgress(JSON.parse(localStorage.getItem(key(email))))
  } catch {
    return normalizeProgress(null)
  }
}

export function saveLocalProgress(email, p) {
  const { v, completed, days, lessonXp, legacyXp, placement, imports } = normalizeProgress(p)
  localStorage.setItem(key(email), JSON.stringify({ v, completed, days, lessonXp, legacyXp, placement, imports }))
}

// Há algo que valha importar?
export function hasLocalProgress(email) {
  const p = loadLocalProgress(email)
  return p.xp > 0 || p.completed.length > 0 || !!p.placement
}
