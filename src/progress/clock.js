// Relógio único do app. Toda data de "hoje" passa por aqui, então dá para
// simular outro dia (só em desenvolvimento) sem esperar dias reais.
const OFFSET_KEY = 'lg:debug:dayOffset'

export function dayOffset() {
  if (!import.meta.env.DEV) return 0
  try {
    return Number(localStorage.getItem(OFFSET_KEY)) || 0
  } catch {
    return 0
  }
}

export function setDayOffset(n) {
  try {
    if (n) localStorage.setItem(OFFSET_KEY, String(n))
    else localStorage.removeItem(OFFSET_KEY)
  } catch {
    /* sem storage: a simulação simplesmente não persiste */
  }
}

// "Agora", já com o deslocamento de dias simulado
export function now() {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset())
  return d
}

const pad = (n) => String(n).padStart(2, '0')

// Data no fuso LOCAL do usuário, formato AAAA-MM-DD (nunca UTC/toISOString)
export const dayStr = (d = now()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Converte AAAA-MM-DD em Date local (meia-noite local)
export function parseDay(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Soma n dias a uma data AAAA-MM-DD, no calendário local
export function addDays(s, n) {
  const d = parseDay(s)
  d.setDate(d.getDate() + n)
  return dayStr(d)
}
