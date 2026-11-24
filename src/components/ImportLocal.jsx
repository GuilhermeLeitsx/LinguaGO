import { useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { loadLocalProgress } from '../progress/localProgress.js'
import { useProgressContext } from '../progress/ProgressContext.jsx'

const dismissKey = (uid) => `lg:ui:importDismissed:${uid}`

function readDismissed(uid) {
  try {
    return localStorage.getItem(dismissKey(uid)) === '1'
  } catch {
    return false
  }
}

// Oferece trazer o progresso salvo neste navegador (antes do Supabase) para a conta.
// banner: aviso na Home, que pode ser dispensado. section: bloco fixo no Perfil.
export default function ImportLocal({ variant = 'banner' }) {
  const { user } = useAuth()
  const { canImportLocal, importLocal } = useProgressContext()
  const [dismissed, setDismissed] = useState(() => readDismissed(user.id))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  if (msg?.ok) return <p className={`import-local ${variant} done`} role="status">{msg.text}</p>
  if (!canImportLocal || (variant === 'banner' && dismissed)) return null

  const local = loadLocalProgress(user.email)

  async function run() {
    setBusy(true)
    setMsg(null)
    try {
      await importLocal()
      setMsg({ ok: true, text: `Pronto! Trouxemos ${local.xp} XP e ${local.completed.length} ${local.completed.length === 1 ? 'lição' : 'lições'} para a sua conta.` })
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(dismissKey(user.id), '1')
    } catch {
      /* sem storage: some só nesta visita */
    }
    setDismissed(true)
  }

  return (
    <section className={`import-local ${variant}`} aria-labelledby="import-local-title">
      <div>
        <strong id="import-local-title">Progresso salvo neste navegador</strong>
        <p className="muted">
          Encontramos {local.xp} XP e {local.completed.length} {local.completed.length === 1 ? 'lição concluída' : 'lições concluídas'} de
          antes da sua conta. Quer somar à sua conta? Isso só pode ser feito uma vez.
        </p>
        {msg && !msg.ok && <p className="import-error" role="alert">{msg.text}</p>}
      </div>
      <div className="import-actions">
        <button className="pill small" onClick={run} disabled={busy}>{busy ? 'Importando…' : 'Importar'}</button>
        {variant === 'banner' && <button className="link text-link" onClick={dismiss} disabled={busy}>Agora não</button>}
      </div>
    </section>
  )
}
