// Versionamento dos dados salvos no localStorage.
//
// Toda mudança de formato precisa:
//   1. aumentar STORAGE_VERSION;
//   2. adicionar em `migrations` a função que converte da versão anterior para a nova.
// Na abertura do app, runMigrations() leva os dados da versão salva até a atual,
// guardando antes uma cópia intacta em lg:backup:v<versão antiga>.
//
// Histórico:
//   v1: progresso { xp, completed, streak, lastDay, todayXp, xpDay, placement }
//   v2: progresso { v, completed, days, lessonXp, legacyXp, placement, imports }

export const STORAGE_VERSION = 2
export const VERSION_KEY = 'lg:version'
export const PROGRESS_PREFIX = 'lg:progress:'

// Chaves que não são dados do usuário (sessão, preferências temporárias, cópias)
const isPersistent = (k) =>
  k.startsWith('lg:') && k !== VERSION_KEY && k !== 'lg:session' && k !== 'lg:audioPausedUntil' && !k.startsWith('lg:backup:') && !k.startsWith('lg:ui:')

// Data AAAA-MM-DD somada de n dias (calendário local)
function addDays(s, n) {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

// v1 -> v2: o progresso passa a ter um registro por dia
export function progressV1toV2(old) {
  const days = {}
  let legacyXp = old.xp || 0
  if (/^\d{4}-\d{2}-\d{2}$/.test(old.lastDay ?? '')) {
    // dias da sequência que estava em andamento (sem XP conhecido)
    const n = Math.max(old.streak || 1, 1)
    for (let k = 0; k < n; k++) days[addDays(old.lastDay, -k)] = 0
    // o XP do último dia é conhecido; o resto não tem dia certo e fica como XP antigo
    if (old.xpDay && days[old.xpDay] !== undefined && old.todayXp) {
      days[old.xpDay] = old.todayXp
      legacyXp -= old.todayXp
    }
  }
  return {
    v: 2,
    completed: Array.isArray(old.completed) ? old.completed : [],
    days,
    lessonXp: {},
    legacyXp: Math.max(legacyXp, 0),
    placement: old.placement ?? null,
    imports: [],
  }
}

// migrations[n]: recebe { chave: objeto } na versão n e devolve na versão n + 1
const migrations = {
  1: (data) => {
    const out = { ...data }
    for (const k of Object.keys(out)) {
      if (k.startsWith(PROGRESS_PREFIX) && out[k] && !out[k].days) out[k] = progressV1toV2(out[k])
    }
    return out
  },
}

// Leva um conjunto de dados de qualquer versão até a atual
export function migrateData(data, from) {
  if (from > STORAGE_VERSION) throw new Error(`Dados da versão ${from}, mais nova que a deste app (${STORAGE_VERSION}).`)
  let out = data
  for (let v = from; v < STORAGE_VERSION; v++) out = migrations[v](out)
  return out
}

// Lê todas as chaves persistentes, já convertidas de JSON
export function readPersistent() {
  const data = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!isPersistent(k)) continue
    try {
      data[k] = JSON.parse(localStorage.getItem(k))
    } catch {
      /* valor ilegível: fica como está no storage e não entra na migração */
    }
  }
  return data
}

// Roda uma vez na abertura do app
export function runMigrations() {
  try {
    const data = readPersistent()
    const hasData = Object.keys(data).length > 0
    const saved = Number(localStorage.getItem(VERSION_KEY))
    // sem número de versão: dados de antes do versionamento (v1), ou instalação nova
    const from = saved || (hasData ? 1 : STORAGE_VERSION)
    if (from > STORAGE_VERSION) {
      console.warn(`[LinguaGo] Dados salvos na versão ${from}; este app conhece até a ${STORAGE_VERSION}. Nada foi alterado.`)
      return
    }
    if (from < STORAGE_VERSION) {
      const backupKey = `lg:backup:v${from}`
      if (!localStorage.getItem(backupKey)) localStorage.setItem(backupKey, JSON.stringify({ version: from, savedAt: new Date().toISOString(), data }))
      const migrated = migrateData(data, from)
      for (const [k, v] of Object.entries(migrated)) localStorage.setItem(k, JSON.stringify(v))
    }
    localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION))
  } catch (err) {
    // sem storage ou erro inesperado: o app abre mesmo assim, sem apagar nada
    console.error('[LinguaGo] Falha ao migrar dados salvos', err)
  }
}
