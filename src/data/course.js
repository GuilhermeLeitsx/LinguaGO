// Monta o curso a partir dos arquivos JSON:
//   en/course.json       → ordem das unidades, nível (A1–C1) e quais lições cada uma tem
//   en/lessons/<id>.json → conteúdo de cada lição (título e exercícios)
// Para criar uma lição: adicione o arquivo em en/lessons/ e o id dela em course.json.
// O teste de nivelamento libera as unidades pelo "level" de cada uma.
import course from './en/course.json'
import { LEVELS, rank } from './levels.js'

const files = import.meta.glob('./en/lessons/*.json', { eager: true, import: 'default' })
const byId = Object.fromEntries(Object.values(files).map((l) => [l.id, l]))

const units = course.units.map((u) => {
  if (!LEVELS.includes(u.level)) {
    throw new Error(`Unidade "${u.id}" precisa de "level" (${LEVELS.join(', ')}) em course.json`)
  }
  return {
    ...u,
    lessons: u.lessons.map((id) => {
      if (!byId[id]) throw new Error(`Lição "${id}" está em course.json, mas não existe src/data/en/lessons/${id}.json`)
      return { ...byId[id], level: u.level }
    }),
  }
})

export const lessons = units.flatMap((u) => u.lessons)
export default units

// Situação de cada lição na trilha: 'done' | 'current' | 'open' | 'locked'.
//   - Unidades até o nível liberado pelo teste ficam abertas ('open').
//   - A lição atual é a primeira não concluída a partir do nível liberado
//     (ou, se já terminou dali para frente, a primeira pendente do curso).
//   - Depois dela, o resto segue bloqueado e vai abrindo em sequência.
//   - Sem teste (unlockedLevel null), tudo é sequencial desde a primeira lição.
export function lessonStatus(completed, unlockedLevel = null) {
  const unlocked = unlockedLevel ? rank(unlockedLevel) : -1
  const pending = (l) => !completed.includes(l.id)
  let current = lessons.findIndex((l) => pending(l) && rank(l.level) >= unlocked)
  if (current === -1) current = lessons.findIndex(pending)
  return (l) => {
    const i = lessons.indexOf(l)
    if (!pending(l)) return 'done'
    if (i === current) return 'current'
    if (rank(l.level) <= unlocked || i < current) return 'open'
    return 'locked'
  }
}
