// Datas do app, sempre a data real no calendário local do usuário.

const pad = (n) => String(n).padStart(2, '0')

// Data no fuso LOCAL do usuário, formato AAAA-MM-DD (nunca UTC/toISOString)
export const dayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

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
