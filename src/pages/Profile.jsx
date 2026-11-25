import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import units from '../data/course.js'
import { choiceById, LEVEL_NAME } from '../data/levels.js'
import { getStreak } from '../progress/progress.js'
import { useProgress } from '../progress/ProgressContext.jsx'

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
    </div>
  )
}
