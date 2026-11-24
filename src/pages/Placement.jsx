import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import Exercise from '../components/Exercise.jsx'
import units from '../data/course.js'
import placement from '../data/en/placement.json'
import { choiceById, LEVEL_NAME, LEVELS } from '../data/levels.js'
import { grade, TYPE_LABEL } from '../exercises/grade.js'
import { useProgress, useProgressContext } from '../progress/ProgressContext.jsx'

const questions = placement.questions
const PER_LEVEL = questions.length / LEVELS.length

// Nível de partida: o primeiro nível em que a pessoa não acertou todas as perguntas.
// Quem acerta tudo começa no último nível (C1).
function placeLevel(answers) {
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, 0]))
  answers.forEach((ok, i) => { if (ok) byLevel[questions[i].level]++ })
  const level = LEVELS.find((l) => byLevel[l] < PER_LEVEL) ?? LEVELS.at(-1)
  return { level, byLevel, score: answers.filter(Boolean).length, total: questions.length }
}

export default function Placement() {
  const { user } = useAuth()
  const { savePlacement } = useProgressContext()
  const [stage, setStage] = useState('intro') // intro → quiz → saving → result
  const [result, setResult] = useState(null)
  const [saveError, setSaveError] = useState('')

  async function save(r) {
    setStage('saving')
    setSaveError('')
    try {
      const saved = await savePlacement({ level: r.level, score: r.score, total: r.total })
      setResult({ ...r, unlocked: saved.placement.level })
      setStage('result')
    } catch (err) {
      setResult(r)
      setSaveError(err.message)
    }
  }

  if (stage === 'intro') return <Intro user={user} onStart={() => setStage('quiz')} />
  if (stage === 'quiz') return <Quiz onFinish={(answers) => save(placeLevel(answers))} />
  if (stage === 'saving') {
    return (
      <div className="end" role="status">
        <p className="end-sub muted">{saveError ? '' : 'Salvando seu resultado…'}</p>
        {saveError && (
          <div className="save-error" role="alert">
            <p><strong>Seu resultado ainda não foi salvo.</strong> {saveError}</p>
            <button className="primary" onClick={() => save(result)}>Tentar salvar de novo</button>
          </div>
        )}
      </div>
    )
  }
  return <Result result={result} onRetry={() => setStage('quiz')} />
}

function Intro({ user, onStart }) {
  const declared = choiceById(user.level)
  const prev = useProgress().placement
  return (
    <div className="end placement-intro">
      <div className="end-art" aria-hidden="true">
        <span className="sticker s1">Level up!</span>
        <span className="end-emoji">🧭</span>
        <span className="sticker s3">10 questions</span>
      </div>
      <p className="eyebrow">Teste de nivelamento · opcional</p>
      <h1>Descubra seu <em className="hl">nível.</em></h1>
      <p className="end-sub muted">
        São 10 perguntas, do A1 ao C1, em uns 3 minutos. As unidades do nível que você alcançar
        (e as anteriores) ficam liberadas na trilha.
        {declared && declared.id !== 'none' && <> No cadastro você disse que tem nível <strong>{declared.label} ({declared.range})</strong>.</>}
      </p>
      {prev && (
        <p className="placement-prev">
          Último resultado: <strong>{prev.level}</strong> · {prev.score}/{prev.total} acertos
        </p>
      )}
      <ul className="placement-rules">
        <li>Não mostramos a resposta certa durante o teste.</li>
        <li>Não sabe? Toque em <b>Não sei</b>: chutar atrapalha o resultado.</li>
        <li>Pode refazer quando quiser. O que já foi liberado continua liberado.</li>
      </ul>
      <div className="end-actions">
        <button className="primary" onClick={onStart}>Começar teste <span aria-hidden="true">→</span></button>
        <Link to="/" className="text-link">{prev ? 'Voltar à trilha' : 'Pular e começar do A1'}</Link>
      </div>
    </div>
  )
}

function Quiz({ onFinish }) {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState(null)
  const [answers, setAnswers] = useState([])
  const q = questions[index]
  const total = questions.length

  function answer(skip = false) {
    if (!skip && value == null) return
    const next = [...answers, !skip && grade(q, value).correct]
    if (next.length === total) { onFinish(next); return }
    setAnswers(next)
    setIndex(index + 1)
    setValue(null)
  }

  // Enter avança; Esc sai do teste
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { navigate('/'); return }
      if (e.key !== 'Enter' || e.repeat || e.target.closest?.('[data-own-enter]')) return
      e.preventDefault()
      answer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="ex-screen">
      <header className="ex-top">
        <Link to="/" className="ex-exit" data-own-enter aria-label="Sair do teste">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </Link>
        <div className="ex-progress" role="progressbar" aria-label="Progresso do teste" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index}>
          <i style={{ width: `${(index / total) * 100}%` }} />
        </div>
        <span className="ex-count" aria-hidden="true">{index + 1}/{total}</span>
        <span className="level-tag dark" title={LEVEL_NAME[q.level]}>{q.level}</span>
      </header>

      <section className="ex-body" key={index}>
        <span className={`ex-tag t-${q.type}`}>{TYPE_LABEL[q.type]}</span>
        <Exercise exercise={q} value={value} onChange={setValue} result={null} active />
      </section>

      <footer className="ex-bar">
        <div className="ex-bar-in">
          <button className="ghost" data-own-enter onClick={() => answer(true)}>Não sei</button>
          <button className="primary" disabled={value == null} onClick={() => answer()}>
            {index + 1 === total ? 'Ver resultado' : 'Próxima'}
          </button>
        </div>
      </footer>
    </div>
  )
}

function Result({ result, onRetry }) {
  const { level, byLevel, score, total, unlocked } = result
  const opened = units.filter((u) => LEVELS.indexOf(u.level) <= LEVELS.indexOf(unlocked)).length
  return (
    <div className="end">
      <div className="end-art" aria-hidden="true">
        <span className="sticker s1">Well done!</span>
        <span className="end-emoji level-big">{level}</span>
        <span className="sticker s3">{LEVEL_NAME[level]}</span>
      </div>
      <p className="eyebrow">Resultado do nivelamento</p>
      <h1>Seu nível: <em className="hl">{level}</em></h1>
      <p className="end-sub muted">
        {level === 'A1'
          ? 'Vamos começar pelo começo: a trilha abre do A1 e vai liberando o resto conforme você avança.'
          : `Liberamos ${opened} ${opened === 1 ? 'unidade' : 'unidades'} até o ${unlocked}. Pode começar direto no seu nível ou revisar as anteriores quando quiser.`}
        {unlocked !== level && ` Seu melhor resultado (${unlocked}) continua valendo.`}
      </p>

      <ol className="level-scale" aria-label={`Acertos por nível: ${score} de ${total}`}>
        {LEVELS.map((l) => (
          <li key={l} className={`${l === level ? 'here' : ''} ${LEVELS.indexOf(l) <= LEVELS.indexOf(unlocked) ? 'on' : ''}`}>
            <strong>{l}</strong>
            <span>{byLevel[l]}/{PER_LEVEL}</span>
          </li>
        ))}
      </ol>

      <div className="end-actions">
        <Link to="/" className="pill">Ir para a trilha <span aria-hidden="true">→</span></Link>
        <button className="link text-link" onClick={onRetry}>Refazer teste</button>
      </div>
    </div>
  )
}
