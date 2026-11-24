import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { getStreak } from '../progress/progress.js'
import { useProgress } from '../progress/ProgressContext.jsx'
import Logo from './Logo.jsx'

export default function Navbar() {
  const { user, logout } = useAuth()
  const p = useProgress()
  return (
    <header className="navbar">
      <Link to="/" className="brand"><Logo /></Link>
      {user && p && (
        <nav>
          <span title="Sequência diária">🔥 {getStreak(p)}</span>
          <span title="XP">⭐ {p.xp}</span>
          <Link to="/profile">Perfil</Link>
          <button className="link" onClick={logout}>Sair</button>
        </nav>
      )}
    </header>
  )
}
