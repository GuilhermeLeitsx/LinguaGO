import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import units from '../data/course.js'
import { choiceById, LEVEL_NAME } from '../data/levels.js'
import { getStreak } from '../progress/progress.js'
import { useProgress } from '../progress/ProgressContext.jsx'
import ImportLocal from '../components/ImportLocal.jsx'
import { downloadBackup, restoreBackup } from '../storage/backup.js'

export default function Profile() {
  const { user } = useAuth()
  const p = useProgress()
  const total = units.reduce((n, u) => n + u.lessons.length, 0)
  const declared = choiceById(user.level)
  const placed = p.placement
  return (
    <div className="card">
      <h1>{user.name}</h1>
      <p className="muted">{user.email}</p>
      <ul className="stats">
        <li><strong>{getStreak(p)}</strong><span>🔥 dias seguidos</span></li>
        <li><strong>{p.xp}</strong><span>⭐ XP total</span></li>
        <li><strong>{p.completed.length}/{total}</strong><span>📚 lições</span></li>
      </ul>

      <section className="profile-level">
        <div>
          <p className="side-label">Nível</p>
          {placed ? (
            <p><strong className="level-tag">{placed.level}</strong> {LEVEL_NAME[placed.level]} · teste com {placed.score}/{placed.total} acertos</p>
          ) : (
            <p className="muted">Sem teste de nivelamento. A trilha começa no A1.</p>
          )}
          {declared && <p className="muted small-note">No cadastro: {declared.label} ({declared.range})</p>}
        </div>
        <Link to="/placement" className="pill small">{placed ? 'Refazer teste' : 'Fazer teste'}</Link>
      </section>

      <ImportLocal variant="section" />
      <BackupSection />
    </div>
  )
}

function BackupSection() {
  const [msg, setMsg] = useState(null)

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const r = restoreBackup(await file.text())
      if (!r.merged) {
        setMsg({ ok: true, text: 'Esse backup já tinha sido restaurado aqui. Nada mudou.' })
        return
      }
      setMsg({ ok: true, text: 'Progresso restaurado! Recarregando…' })
      setTimeout(() => window.location.reload(), 900)
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    }
  }

  return (
    <section className="profile-level profile-backup">
      <div>
        <p className="side-label">Backup do progresso antigo (navegador)</p>
        <p className="muted small-note">
          Cobre só o progresso de antes da conta, salvo neste navegador ({window.location.host}). O progresso da conta fica no servidor e não precisa de backup.
        </p>
        {msg && <p className={`backup-msg ${msg.ok ? 'ok' : 'bad'}`} role="status">{msg.text}</p>}
      </div>
      <div className="backup-actions">
        <button className="pill small" onClick={downloadBackup}>Baixar backup</button>
        <label className="pill small ghost">
          Restaurar backup
          <input type="file" accept="application/json,.json" onChange={onFile} hidden />
        </label>
      </div>
    </section>
  )
}
