import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import Exercise, { SpeakButton } from '../components/Exercise.jsx'
import { lessons } from '../data/course.js'
import { canCheck, grade, KEY_HINT, TYPE_LABEL } from '../exercises/grade.js'
import { stopSpeaking } from '../exercises/speech.js'
import { useCountUp } from '../hooks.js'
import { getStreak, XP_PER_CORRECT } from '../progress/progress.js'
import { useProgress, useProgressContext } from '../progress/ProgressContext.jsx'
const MAX_LIVES = 3
const PRAISE = ['Correto!', 'Mandou bem!', 'Isso aí!']
const AUDIO_KEY = 'lg:audioPausedUntil'
const AUDIO_PAUSE_MS = 15 * 60 * 1000

function audioPaused() {
  try {
    return Number(localStorage.getItem(AUDIO_KEY)) > Date.now()
  } catch {
    return false
  }
}

function pauseAudio() {
  try {
    localStorage.setItem(AUDIO_KEY, String(Date.now() + AUDIO_PAUSE_MS))
  } catch { /* sem armazenamento: vale só para esta lição */ }
}

const Heart = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.6 4.5c2.1 0 3.7 1.2 5.4 3.2 1.7-2 3.3-3.2 5.4-3.2 3.6 0 5.7 3.8 4.2 7.2C19.5 16.4 12 21 12 21z" /></svg>

export default function Lesson() {
  const { id } = useParams()
  const progress = useProgress()
  const { completeLesson } = useProgressContext()
  const navigate = useNavigate()
  const lesson = lessons.find((l) => l.id === id)
  const [round, setRound] = useState(0)
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState(null)
  const [result, setResult] = useState(null)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [summary, setSummary] = useState(null)
  const [askExit, setAskExit] = useState(false)
  const [noAudio, setNoAudio] = useState(audioPaused)

  // Com o áudio pausado, os exercícios de escuta saem da lição
  // (a não ser que a lição só tenha escuta, o que deixaria a lição vazia)
  const all = lesson?.exercises ?? []
  const withoutListen = all.filter((e) => e.type !== 'listen')
  const list = noAudio && withoutListen.length ? withoutListen : all
  const total = list.length
  const ex = list[index]
  const ready = !!ex && canCheck(ex, value)

  function check() {
    if (!ready || result) return
    const r = grade(ex, value)
    setResult(r)
    if (r.correct) setScore((s) => s + 1)
    else setLives((l) => l - 1)
  }

  function next() {
    stopSpeaking()
    if (lives <= 0) {
      setSummary({ passed: false, score, total })
      return
    }
    if (index + 1 < total) {
      setIndex(index + 1)
      setValue(null)
      setResult(null)
      return
    }
    finish(total)
  }

  function finish(answered) {
    // O servidor calcula o XP com a mesma regra (10 por acerto); aqui é só para exibir
    save({ passed: true, score, total: answered, xp: score * XP_PER_CORRECT, before: getStreak(progress) })
  }

  async function save(base) {
    setSummary({ ...base, saving: true })
    try {
      const after = getStreak(await completeLesson(lesson.id, base.score, base.total))
      setSummary({ ...base, streak: after, streakUp: after > base.before })
    } catch (err) {
      setSummary({ ...base, saveError: err.message })
    }
  }

  // "Não posso ouvir agora": pula sem perder vida e desliga a escuta por 15 minutos
  function cantListen() {
    stopSpeaking()
    pauseAudio()
    if (!withoutListen.length) return
    const nextIdx = list.slice(0, index).filter((e) => e.type !== 'listen').length
    setNoAudio(true)
    setValue(null)
    setResult(null)
    if (nextIdx < withoutListen.length) setIndex(nextIdx)
    else finish(withoutListen.length)
  }

  function restart() {
    setRound((r) => r + 1)
    setIndex(0)
    setValue(null)
    setResult(null)
    setScore(0)
    setLives(MAX_LIVES)
    setSummary(null)
  }

  function exit() {
    if (index === 0 && !result && value == null) navigate('/')
    else setAskExit(true)
  }

  // Enter verifica / continua; Esc abre ou fecha a confirmação de saída
  useEffect(() => {
    if (summary || !lesson) return
    const onKey = (e) => {
      if (e.key === 'Escape') { setAskExit((v) => !v); return }
      if (e.key !== 'Enter' || e.repeat || e.shiftKey || askExit) return
      if (e.target.closest?.('[data-own-enter]')) return
      e.preventDefault()
      if (result) next()
      else check()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!lesson) return <Navigate to="/" replace />
  if (summary) return <LessonEnd lesson={lesson} summary={summary} onRetry={restart} onSaveRetry={() => save(summary)} />

  const doneCount = index + (result ? 1 : 0)

  return (
    <div className="ex-screen">
      <header className="ex-top">
        <button className="ex-exit" data-own-enter onClick={exit} aria-label="Sair da lição">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <div className="ex-progress" role="progressbar" aria-label="Progresso da lição" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount}>
          <i style={{ width: `${(doneCount / total) * 100}%` }} />
        </div>
        <span className="ex-count" aria-hidden="true">{doneCount}/{total}</span>
        <span className="lives" role="img" aria-label={`${lives} de ${MAX_LIVES} vidas`}>
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <span key={i} className={i < lives ? 'heart' : 'heart lost'}>{Heart}</span>
          ))}
        </span>
      </header>

      <section className="ex-body" key={`${round}-${index}`}>
        <span className={`ex-tag t-${ex.type}`}>{TYPE_LABEL[ex.type]}</span>
        <Exercise exercise={ex} value={value} onChange={setValue} result={result} active={!askExit} />
      </section>

      <footer className={`ex-bar ${result ? (result.correct ? 'ok' : 'bad') : ''}`}>
        <div className="ex-bar-in">
          {result ? (
            <div className="fb" role="status">
              <span className="fb-icon" aria-hidden="true">{result.correct ? '✓' : '✕'}</span>
              <div>
                <p className="fb-title">
                  {result.correct ? PRAISE[index % PRAISE.length] : lives > 0 ? 'Quase!' : 'Acabaram as vidas'}
                  {result.correct && <span className="fb-xp">+{XP_PER_CORRECT} XP</span>}
                </p>
                {!result.correct && (
                  <p className="fb-answer">
                    Resposta certa: <strong>{result.answer}</strong>
                    {result.speak && <SpeakButton text={result.speak} />}
                  </p>
                )}
                {result.correct && result.speak && (
                  <p className="fb-answer"><span lang="en">{result.speak}</span><SpeakButton text={result.speak} /></p>
                )}
                {result.note && <p className="fb-explain"><strong>{result.note}</strong></p>}
                {ex.explain && <p className="fb-explain">{result.note ? <>Dica: {ex.explain}</> : ex.explain}</p>}
              </div>
            </div>
          ) : ex.type === 'listen' && withoutListen.length ? (
            <button className="ghost" data-own-enter onClick={cantListen}>Não posso ouvir agora</button>
          ) : (
            <p className="ex-hint">{KEY_HINT[ex.type]}</p>
          )}
          <button
            className={`primary ${result?.correct ? 'go' : ''}`}
            disabled={!result && !ready}
            onClick={result ? next : check}
          >
            {result ? (lives <= 0 ? 'Ver resultado' : 'Continuar') : 'Verificar'}
          </button>
        </div>
      </footer>

      {askExit && (
        <div className="modal-back" onClick={() => setAskExit(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="exit-t" onClick={(e) => e.stopPropagation()}>
            <span className="sticker" aria-hidden="true">Wait!</span>
            <h2 id="exit-t">Sair <em>agora?</em></h2>
            <p className="muted">Você perde o progresso desta lição. A trilha e o seu XP continuam salvos.</p>
            <button className="primary" autoFocus onClick={() => setAskExit(false)}>Continuar estudando</button>
            <Link to="/" className="text-link">Sair da lição</Link>
          </div>
        </div>
      )}
    </div>
  )
}

function LessonEnd({ lesson, summary, onRetry, onSaveRetry }) {
  const { passed, score, total, xp, streak, streakUp, saving, saveError } = summary
  const pct = Math.round((score / total) * 100)
  const shownXp = useCountUp(xp ?? 0, passed, 1100)

  if (!passed) {
    return (
      <div className="end">
        <div className="end-art" aria-hidden="true">
          <span className="sticker s1">Oops!</span>
          <span className="end-emoji">💔</span>
          <span className="sticker s3">Try again</span>
        </div>
        <h1>Acabaram as <em className="hl">vidas.</em></h1>
        <p className="end-sub muted">Errar faz parte. Você acertou {score} de {total} em “{lesson.title}”: tente de novo, agora você já viu as respostas.</p>
        <div className="end-actions">
          <button className="primary" onClick={onRetry}>Tentar de novo <span aria-hidden="true">→</span></button>
          <Link to="/" className="text-link">Voltar à trilha</Link>
        </div>
      </div>
    )
  }

  const verdict = pct === 100 ? 'Sem nenhum erro.' : pct >= 70 ? 'Ótimo ritmo.' : 'Cada lição deixa o inglês mais firme.'

  return (
    <div className="end">
      <div className="end-art" aria-hidden="true">
        <span className="sticker s1">Great job!</span>
        <span className="end-emoji">🎉</span>
        <span className="sticker s2">+{xp} XP</span>
        <span className="sticker s3">See you</span>
      </div>
      <p className="eyebrow">{lesson.title}</p>
      <h1>Lição <em className="hl">concluída!</em></h1>
      <p className="end-sub muted">{verdict}</p>

      <ul className="end-stats">
        <li className="st-xp">
          <span className="st-label">XP ganho</span>
          <strong>+{shownXp}</strong>
          <small>{XP_PER_CORRECT} por acerto</small>
        </li>
        <li className="st-acc">
          <span className="st-label">Acertos</span>
          <strong>{score}<small>/{total}</small></strong>
          <small>{pct}% de precisão</small>
        </li>
        <li className="st-streak">
          <span className="st-label">Sequência</span>
          <strong><span aria-hidden="true">🔥</span> {saving || saveError ? '…' : streak}</strong>
          <small>{saving ? 'Salvando…' : saveError ? 'Não salvo' : streakUp ? (streak === 1 ? 'Chama acesa hoje!' : '+1 dia hoje!') : 'Já contou hoje'}</small>
        </li>
      </ul>

      {saveError && (
        <div className="save-error" role="alert">
          <p><strong>Seu resultado ainda não foi salvo.</strong> {saveError}</p>
          <button className="primary" onClick={onSaveRetry}>Tentar salvar de novo</button>
        </div>
      )}

      <div className="end-actions">
        {saving || saveError
          ? <span className="pill is-disabled" aria-disabled="true">{saving ? 'Salvando…' : 'Continuar'} <span aria-hidden="true">→</span></span>
          : <Link to="/" className="pill">Continuar <span aria-hidden="true">→</span></Link>}
        <button className="link text-link" onClick={onRetry} disabled={saving}>Refazer lição</button>
      </div>
    </div>
  )
}
