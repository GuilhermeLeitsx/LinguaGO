// Regras do progresso, sem depender de onde os dados ficam.
//
// Formato usado pelas telas:
//   completed: ids das lições concluídas
//   days:      { 'AAAA-MM-DD': XP ganho naquele dia }  (dia LOCAL; presente = estudou)
//   lessonXp:  melhor XP já ganho em cada lição { lessonId: xp }
//   placement: { level, score, total, date } ou null
//   xp:        total (derivado; nunca somado à parte)
import { rank } from '../data/levels.js'
import { addDays, dayStr } from './clock.js'

export { dayStr } from './clock.js'

export const DAILY_GOAL = 30
export const XP_PER_CORRECT = 10

const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0)

// XP total = XP de todos os dias com atividade
export const totalXp = (p) => sum(p.days)

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

// Garante todos os campos com o tipo certo
export function normalizeProgress(raw) {
  const p = raw ?? {}
  const n = {
    completed: Array.isArray(p.completed) ? p.completed : [],
    days: isObj(p.days) ? p.days : {},
    lessonXp: isObj(p.lessonXp) ? p.lessonXp : {},
    placement: p.placement ?? null,
  }
  return { ...n, xp: totalXp(n) }
}
