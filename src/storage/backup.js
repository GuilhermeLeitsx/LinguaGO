// Backup do progresso em arquivo. Serve para levar a conta de um endereço para outro
// (localhost, 127.0.0.1 e o IP da rede guardam dados separados) ou de um aparelho para outro.
import { loadLocalProgress as loadProgress, saveLocalProgress as saveProgress } from '../progress/localProgress.js'
import { mergeProgress, normalizeProgress } from '../progress/progress.js'
import { migrateData, PROGRESS_PREFIX, readPersistent, STORAGE_VERSION } from './migrations.js'

const APP = 'linguago'
const USERS_KEY = 'lg:users'

export function createBackup() {
  return {
    app: APP,
    version: STORAGE_VERSION,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    origin: location.origin,
    data: readPersistent(),
  }
}

export function downloadBackup() {
  const b = createBackup()
  const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `linguago-backup-${b.createdAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

// Restaura um backup juntando com o que já existe neste endereço.
// - Contas: as do backup substituem as daqui com o mesmo e-mail (nome, nível e senha do backup).
// - Progresso: é somado ao daqui; o mesmo backup restaurado duas vezes não soma de novo.
export function restoreBackup(text) {
  let b
  try {
    b = JSON.parse(text)
  } catch {
    throw new Error('Arquivo inválido: não é um backup do LinguaGo.')
  }
  if (b?.app !== APP || typeof b.data !== 'object' || !b.id) throw new Error('Arquivo inválido: não é um backup do LinguaGo.')
  const data = migrateData(b.data, Number(b.version) || 1)

  const users = JSON.parse(localStorage.getItem(USERS_KEY) || '{}')
  Object.assign(users, data[USERS_KEY] ?? {})
  localStorage.setItem(USERS_KEY, JSON.stringify(users))

  let merged = 0
  let skipped = 0
  for (const [k, value] of Object.entries(data)) {
    if (!k.startsWith(PROGRESS_PREFIX)) continue
    const email = k.slice(PROGRESS_PREFIX.length)
    const here = loadProgress(email)
    if (here.imports.includes(b.id)) {
      skipped++
      continue
    }
    const incoming = normalizeProgress(value)
    saveProgress(email, mergeProgress(here, { ...incoming, imports: [...incoming.imports, b.id] }))
    merged++
  }
  return { merged, skipped, from: b.origin }
}
