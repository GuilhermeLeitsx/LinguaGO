import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import GoogleButton from './GoogleButton.jsx'
import LevelPicker from './LevelPicker.jsx'
import Logo from './Logo.jsx'

// Painel decorativo: mesmo cartão de quiz inclinado e adesivos da home
function AuthArt({ isRegister }) {
  return (
    <aside className="auth-art" aria-hidden="true">
      <div className="demo">
        <span className="sticker s1">Hello!</span>
        <span className="sticker s2">{isRegister ? 'Bem-vindo' : 'Obrigado'}</span>
        <span className="sticker s3">See you</span>
        <div className="demo-card">
          <div className="demo-top">
            <div className="demo-bar"><i style={{ width: '60%' }} /></div>
            <span>🔥 7</span>
          </div>
          <p className="demo-q">O que significa <b>“Nice to meet you”</b>?</p>
          <div className="demo-opts">
            <span className="demo-opt">Até amanhã</span>
            <span className="demo-opt ok">Prazer em conhecer você</span>
            <span className="demo-opt">De nada</span>
          </div>
          <div className="demo-fb show">Correto! +10 XP</div>
        </div>
      </div>
      <p className="auth-quote">
        “Cinco minutos por dia e a <em>chama</em> não apaga.”
      </p>
    </aside>
  )
}

export default function AuthForm({ mode }) {
  const isRegister = mode === 'register'
  const { user, login, register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [level, setLevel] = useState(null)
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleError, setGoogleError] = useState('')

  // inclui a entrada pelo Google: com a sessão criada, sai daqui (e quem é novo escolhe o nível)
  if (user) return <Navigate to="/" replace />

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (isRegister) {
        await register(name, email, password, level)
        // Quem já sabe algo é convidado para o teste de nivelamento (opcional)
        navigate(level === 'none' ? '/' : '/placement')
      } else {
        await login(email, password)
        navigate('/')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-split">
      <section className="auth-col">
        <Link to="/" className="brand"><Logo /></Link>

        <div className="auth-box">
          <p className="eyebrow rise">{isRegister ? 'Comece grátis' : 'Bem-vindo de volta'}</p>
          <h1 className="rise" style={{ '--d': '80ms' }}>
            {isRegister
              ? <>Seu primeiro <em className="hl">hello</em> começa aqui.</>
              : <>Que bom te ver <em className="hl">de novo.</em></>}
          </h1>
          <p className="muted auth-sub rise" style={{ '--d': '160ms' }}>
            {isRegister
              ? 'Crie sua conta em menos de um minuto e faça a primeira lição hoje.'
              : 'Entre para continuar sua trilha e manter a sequência acesa.'}
          </p>

          <GoogleButton mode={mode} onError={setGoogleError} />
          {googleError && <p className="error" role="alert">{googleError}</p>}

          <div className="divider rise" style={{ '--d': '300ms' }}><span>ou com e-mail</span></div>

          <form onSubmit={submit} className="rise" style={{ '--d': '360ms' }}>
            {isRegister && (
              <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>
            )}
            {isRegister && <LevelPicker value={level} onChange={setLevel} />}
            <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
            <label>
              Senha
              <span className="pass-field">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  minLength={isRegister ? 6 : undefined}
                  required
                />
                <button
                  type="button"
                  className="pass-toggle"
                  aria-pressed={showPass}
                  aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setShowPass((s) => !s)}
                >{showPass ? 'Ocultar' : 'Mostrar'}</button>
              </span>
              {isRegister && <small className="muted">Pelo menos 6 caracteres.</small>}
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary" disabled={busy}>
              {busy ? 'Aguarde…' : isRegister ? 'Criar conta' : 'Entrar'} <span aria-hidden="true">→</span>
            </button>
          </form>

          <p className="muted auth-switch">
            {isRegister
              ? <>Já tem conta? <Link to="/login" className="text-link">Entrar</Link></>
              : <>Novo por aqui? <Link to="/register" className="text-link">Criar conta grátis</Link></>}
          </p>
        </div>
      </section>

      <AuthArt isRegister={isRegister} />
    </div>
  )
}
