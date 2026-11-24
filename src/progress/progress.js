// Regras do progresso, sem depender de onde os dados ficam (Supabase ou localStorage).
//
// Formato usado pelas telas:
//   completed: ids das lições concluídas
//   days:      { 'AAAA-MM-DD': XP ganho naquele dia }  (dia LOCAL; presente = estudou)
//   lessonXp:  melhor XP já ganho em cada lição { lessonId: xp }
//   legacyXp:  XP antigo sem dia conhecido (conta no total, não na sequência)
//   placement: { level, score, total, date } ou null
//   xp:        total (derivado; nunca somado à parte)
import { rank } from '../data/levels.js'
import { progressV1toV2, STORAGE_VERSION } from '../storage/migrations.js'
import { addDays, dayStr } from './clock.js'

export { dayStr } from './clock.js'

export const DAILY_GOAL = 30
export const XP_PER_CORRECT = 10

const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0)

// XP total = XP de todos os dias com atividade + XP antigo sem data
export const totalXp = (p) => sum(p.days) + p.legacyXp

// XP ganho hoje
export const xpToday = (p, today = dayStr()) => p.days[today] ?? 0

// Dias seguidos com atividade, terminando hoje ou ontem.
// Se nem hoje nem ontem tiveram atividade, passou um dia inteiro sem estudo: 0.
// Única fonte da sequência: use em todos os lugares que mostram o foguinho.
export function getStreak(p, today = dayStr()) {
  let d = p.days[today] !== undefined ? today : addDays(today, -1)
  let n = 0
  while (p.days[d] !== undefined) {
    n++
    d = addDays(d, -1)
  }
  return n
}

// Melhor de dois resultados do teste de nivelamento (o nível liberado nunca diminui)
export function betterPlacement(a, b) {
  if (!a) return b ?? null
  if (!b) return a
  return rank(b.level) > rank(a.level) ? b : a
}

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x)

// Garante todos os campos, venham os dados de onde vierem (inclusive formato antigo)
export function normalizeProgress(raw) {
  const p = isObj(raw) && !raw.days && ('xp' in raw || 'lastDay' in raw) ? progressV1toV2(raw) : raw ?? {}
  const n = {
    v: STORAGE_VERSION,
    completed: Array.isArray(p.completed) ? p.completed : [],
    days: isObj(p.days) ? p.days : {},
    lessonXp: isObj(p.lessonXp) ? p.lessonXp : {},
    legacyXp: Number(p.legacyXp) || 0,
    placement: p.placement ?? null,
    imports: Array.isArray(p.imports) ? p.imports : [],
  }
  return { ...n, xp: totalXp(n) }
}

// Junta dois progressos do mesmo usuário (ex.: restaurar backup de outro endereço)
export function mergeProgress(a, b) {
  const days = { ...a.days }
  for (const [d, xp] of Object.entries(b.days)) days[d] = (days[d] ?? 0) + xp
  const lessonXp = { ...a.lessonXp }
  for (const [id, xp] of Object.entries(b.lessonXp)) lessonXp[id] = Math.max(lessonXp[id] ?? 0, xp)
  return normalizeProgress({
    completed: [...new Set([...a.completed, ...b.completed])],
    days,
    lessonXp,
    legacyXp: a.legacyXp + b.legacyXp,
    placement: betterPlacement(a.placement, b.placement),
    imports: [...new Set([...a.imports, ...b.imports])],
  })
}
