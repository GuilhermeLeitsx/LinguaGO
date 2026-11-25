import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import LevelPicker from '../components/LevelPicker.jsx'
import Logo from '../components/Logo.jsx'

// Primeira entrada pelo Google: o Google não informa o nível, então a pessoa escolhe aqui,
// antes de ver a trilha (no cadastro por e-mail essa escolha já faz parte do formulário).
export default function ChooseLevel() {
  const { user, saveLevel, logout } = useAuth()
  const navigate = useNavigate()
  const [level, setLevel] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const firstName = user.name?.split(' ')[0]

  async function submit(e) {
    e.preventDefault()
    if (!level) return
    setBusy(true)
    setError('')
    try {
      await saveLevel(level)
      // como no cadastro: quem já sabe algo é convidado para o teste de nivelamento (opcional)
      navigate(level === 'none' ? '/' : '/placement', { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="choose-level">
      <Logo />
      <form className="card" onSubmit={submit}>
        <p className="eyebrow">Falta só um passo</p>
        <h1>{firstName ? <>Oi, <em className="hl">{firstName}</em>!</> : <>Boas-<em className="hl">vindas</em>!</>}</h1>
        <p className="muted">Conte quanto inglês você já sabe para a trilha começar no ponto certo.</p>
        <LevelPicker value={level} onChange={setLevel} />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={!level || busy}>
          {busy ? 'Salvando…' : 'Começar'} <span aria-hidden="true">→</span>
        </button>
        <button type="button" className="link text-link" onClick={logout}>Sair</button>
      </form>
    </div>
  )
}
