import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { LEVEL_CHOICES } from '../data/levels.js'
import Logo from './Logo.jsx'

const GoogleIcon = (
  <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
)

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
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function submit(e) {
    e.preventDefault()
    setError('')
    setNotice('')
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

          <button
            type="button"
            className="google-btn rise"
            style={{ '--d': '240ms' }}
            onClick={() => { setError(''); setNotice('O login com Google ainda não está disponível. Use e-mail e senha por enquanto.') }}
          >
            {GoogleIcon}
            {isRegister ? 'Cadastrar com Google' : 'Entrar com Google'}
          </button>
          {notice && <p className="auth-notice" role="status">{notice}</p>}

          <div className="divider rise" style={{ '--d': '300ms' }}><span>ou com e-mail</span></div>

          <form onSubmit={submit} className="rise" style={{ '--d': '360ms' }}>
            {isRegister && (
              <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>
            )}
            {isRegister && (
              <fieldset className="level-pick">
                <legend>Quanto inglês você já sabe?</legend>
                <div className="level-grid">
                  {LEVEL_CHOICES.map((c) => (
                    <label key={c.id} className={`level-opt ${level === c.id ? 'on' : ''}`}>
                      <input type="radio" name="level" value={c.id} checked={level === c.id} onChange={() => setLevel(c.id)} required />
                      <span className="level-top">
                        <strong>{c.label}</strong>
                        <span className="level-tag">{c.range}</span>
                      </span>
                      <small>{c.hint}</small>
                    </label>
                  ))}
                </div>
                {level && level !== 'none' && (
                  <small className="muted level-note">Depois do cadastro, um teste opcional de 10 perguntas libera as unidades do seu nível.</small>
                )}
              </fieldset>
            )}
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
