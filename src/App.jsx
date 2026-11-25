import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.jsx'
import Logo from './components/Logo.jsx'
import Navbar from './components/Navbar.jsx'
import ChooseLevel from './pages/ChooseLevel.jsx'
import Home from './pages/Home.jsx'
import Landing from './pages/Landing.jsx'
import Lesson from './pages/Lesson.jsx'
import Login from './pages/Login.jsx'
import Placement from './pages/Placement.jsx'
import Privacy from './pages/Privacy.jsx'
import Profile from './pages/Profile.jsx'
import Register from './pages/Register.jsx'
import { useProgressContext } from './progress/ProgressContext.jsx'

function Protected({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

// Tela enquanto a sessão e o progresso chegam do Supabase
function Splash() {
  return (
    <div className="splash" role="status" aria-live="polite">
      <Logo />
      <span className="splash-dots" aria-hidden="true"><i /><i /><i /></span>
      <span className="sr-only">Carregando…</span>
    </div>
  )
}

function LoadError({ onRetry, onLogout }) {
  return (
    <div className="splash">
      <Logo />
      <p className="splash-msg">Não foi possível carregar seus dados. Verifique sua conexão.</p>
      <div className="splash-actions">
        <button className="primary" onClick={onRetry}>Tentar de novo</button>
        <button className="link text-link" onClick={onLogout}>Sair</button>
      </div>
    </div>
  )
}

export default function App() {
  return <Pages />
}

function Pages() {
  const { user, loading, profileError, retryProfile, logout, oauthError } = useAuth()
  const progress = useProgressContext()
  const { pathname } = useLocation()

  // Página pública: abre na hora, com ou sem login (e mesmo se o Supabase estiver fora do ar)
  if (pathname === '/privacidade') return <Privacy />
  if (loading) return <Splash />
  if (profileError) return <LoadError onRetry={retryProfile} onLogout={logout} />
  // Voltou do Google com erro (ex.: cancelou): mostra o aviso na tela de login
  if (!user && oauthError && pathname === '/') return <Navigate to="/login" replace />
  if (!user && pathname === '/') return <Landing />
  // Login e cadastro usam layout dividido em tela cheia, sem a navbar
  if (pathname === '/login') return <Login />
  if (pathname === '/register') return <Register />
  if (user && progress.error) return <LoadError onRetry={progress.retry} onLogout={logout} />
  if (user && !progress.progress) return <Splash />
  // Primeira entrada pelo Google: escolhe o nível antes da trilha
  if (user && !user.level) return <ChooseLevel />

  // Dentro da lição a navbar some para manter o foco no exercício
  const inLesson = pathname.startsWith('/lesson/') || pathname === '/placement'
  return (
    <>
      {!inLesson && <Navbar />}
      <main className={pathname === '/' ? 'wide' : inLesson ? 'focus' : undefined}>
        <Routes>
          <Route path="/" element={<Protected><Home /></Protected>} />
          <Route path="/lesson/:id" element={<Protected><Lesson /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/placement" element={<Protected><Placement /></Protected>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}
