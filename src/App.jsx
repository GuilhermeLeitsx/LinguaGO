import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.jsx'
import DebugClock from './components/DebugClock.jsx'
import Logo from './components/Logo.jsx'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import Landing from './pages/Landing.jsx'
import Lesson from './pages/Lesson.jsx'
import Login from './pages/Login.jsx'
import Placement from './pages/Placement.jsx'
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
  return (
    <>
      <Pages />
      {import.meta.env.DEV && <DebugClock />}
    </>
  )
}

function Pages() {
  const { user, loading, profileError, retryProfile, logout } = useAuth()
  const progress = useProgressContext()
  const { pathname } = useLocation()

  if (loading) return <Splash />
  if (profileError) return <LoadError onRetry={retryProfile} onLogout={logout} />
  if (!user && pathname === '/') return <Landing />
  // Login e cadastro usam layout dividido em tela cheia, sem a navbar
  if (pathname === '/login') return <Login />
  if (pathname === '/register') return <Register />
  if (user && progress.error) return <LoadError onRetry={progress.retry} onLogout={logout} />
  if (user && !progress.progress) return <Splash />

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
