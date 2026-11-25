import { useEffect, useState, useSyncExternalStore } from 'react'
import { emptyMatch, fillSentence } from '../exercises/grade.js'
import { DEFAULT_RATE, getVoiceState, speak, stopSpeaking, subscribeVoice } from '../exercises/speech.js'

// 'loading' | 'ready' | 'none' (sem suporte ou sem voz em inglês)
const useVoiceStatus = () => useSyncExternalStore(subscribeVoice, getVoiceState).status

// Palavras entre aspas viram itálico laranja, como os títulos da home
function rich(text) {
  return text.split(/"([^"]+)"/).map((part, i) => (i % 2 ? <em key={i}>“{part}”</em> : part))
}

function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Atalhos de teclado do exercício (ignorados enquanto se digita num campo)
function useKeys(onKey, active) {
  useEffect(() => {
    if (!active) return
    const handler = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea')) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= 9) {
        e.preventDefault()
        onKey({ number: n })
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        onKey({ backspace: true })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })
}

const SpeakerIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" /><path className="wave" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" /></svg>
)

// Botão pequeno para ouvir uma frase em inglês (usado na barra de feedback)
export function SpeakButton({ text }) {
  if (useVoiceStatus() === 'none') return null
  return (
    <button type="button" className="speak-mini" data-own-enter onClick={() => speak(text)} aria-label={`Ouvir: ${text}`}>
      {SpeakerIcon}
    </button>
  )
}

export default function Exercise({ exercise, value, onChange, result, active }) {
  const props = { ex: exercise, value, onChange, result, active: active && !result }
  switch (exercise.type) {
    case 'choice': return <Choice {...props} />
    case 'translate': return <Translate {...props} />
    case 'build': return <Build {...props} />
    case 'fill': return <Fill {...props} />
    case 'listen': return <Listen {...props} />
    default: return <Match {...props} />
  }
}

// Lista de opções numeradas, usada por múltipla escolha e lacuna
function Options({ options, answer, value, onChange, result, active, lang }) {
  useKeys(({ number }) => number && options[number - 1] && onChange(options[number - 1]), active)
  return (
    <div className="opts">
      {options.map((o, i) => {
        let st = o === value ? 'picked' : ''
        if (result) st = o === answer ? 'ok' : o === value ? 'bad' : 'dim'
        return (
          <button key={o} lang={lang} className={`opt ${st}`} disabled={!!result} aria-pressed={o === value} onClick={() => onChange(o)} style={{ '--i': i }}>
            <kbd>{i + 1}</kbd><span>{o}</span>
          </button>
        )
      })}
    </div>
  )
}

function Choice({ ex, ...rest }) {
  return (
    <>
      <h1 className="ex-q">{rich(ex.question)}</h1>
      <Options options={ex.options} answer={ex.answer} {...rest} />
    </>
  )
}

function Fill({ ex, value, result, ...rest }) {
  const [before, after] = ex.sentence.split('___')
  const state = result ? (result.correct ? 'ok' : 'bad') : ''
  const wrong = result && !result.correct
  const label = !value
    ? ex.sentence.replace('___', 'lacuna')
    : wrong
      ? `${fillSentence(ex, value)} (errado; o certo é “${ex.answer}”)`
      : fillSentence(ex, value)
  return (
    <>
      <h1 className="ex-q">Complete a <em>frase</em>.</h1>
      <div className="phrase-card fill-card">
        <span className="phrase-lang" aria-hidden="true">EN</span>
        <div>
          <p lang="en" aria-label={label}>
            {/* key muda a cada palavra para a animação rodar de novo ao trocar de opção */}
            {before}<span key={value ?? ''} className={`gap ${value ? 'filled' : ''} ${state}`} aria-hidden="true">{value ?? ' '}</span>
            {wrong && <span className="gap filled ok fix" aria-hidden="true">{ex.answer}</span>}
            {after}
          </p>
          <small lang="pt-BR">{ex.translation}</small>
        </div>
      </div>
      <Options options={ex.options} answer={ex.answer} value={value} result={result} lang="en" {...rest} />
    </>
  )
}

function Translate({ ex, value, onChange, result }) {
  const phrase = ex.prompt.replace(/^Traduza:\s*/i, '')
  return (
    <>
      <h1 className="ex-q">Como se diz isso em <em>inglês</em>?</h1>
      <div className="phrase-card">
        <span className="phrase-lang" aria-hidden="true">PT</span>
        <p lang="pt-BR">{phrase}</p>
      </div>
      <AnswerBox value={value} onChange={onChange} result={result} label="Sua tradução em inglês" />
    </>
  )
}

function AnswerBox({ value, onChange, result, label, placeholder = 'Digite em inglês…' }) {
  return (
    <>
      <label className="sr-only" htmlFor="answer">{label}</label>
      <textarea
        id="answer"
        className={`answer-box ${result ? (result.correct ? 'ok' : 'bad') : ''}`}
        rows={2}
        autoFocus
        lang="en"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={!!result}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </>
  )
}

// Montar frase: toca nos blocos para formar a frase; toca de novo para devolver
function Build({ ex, value, onChange, result, active }) {
  const [tiles] = useState(() => shuffle([...ex.words, ...(ex.distractors ?? [])]).map((w, i) => ({ i, w })))
  const chosen = value ?? []
  const used = (t) => chosen.some((c) => c.i === t.i)
  const add = (t) => !used(t) && onChange([...chosen, t])
  const remove = (t) => onChange(chosen.filter((c) => c.i !== t.i))

  useKeys(({ number, backspace }) => {
    if (backspace) { if (chosen.length) onChange(chosen.slice(0, -1)) }
    else if (tiles[number - 1]) add(tiles[number - 1])
  }, active)

  const state = result ? (result.correct ? 'ok' : 'bad') : ''
  return (
    <>
      <h1 className="ex-q">Monte a frase em <em>inglês</em>.</h1>
      <div className="phrase-card">
        <span className="phrase-lang" aria-hidden="true">PT</span>
        <p lang="pt-BR">{ex.prompt}</p>
      </div>
      <div className={`build-line ${state}`} aria-label="Sua frase" aria-live="polite">
        {chosen.length === 0 && <span className="build-empty">Toque nos blocos abaixo para montar a frase</span>}
        {chosen.map((t) => (
          <button key={t.i} lang="en" className="tile placed" disabled={!!result} onClick={() => remove(t)} aria-label={`Remover ${t.w}`}>{t.w}</button>
        ))}
      </div>
      <div className="bank" aria-label="Blocos de palavras">
        {tiles.map((t, k) => (
          <button key={t.i} lang="en" className={`tile ${used(t) ? 'used' : ''}`} disabled={!!result || used(t)} onClick={() => add(t)} style={{ '--i': k }}>
            <kbd>{k + 1}</kbd>{t.w}
          </button>
        ))}
      </div>
    </>
  )
}

// Ouvir: o navegador fala a frase em inglês e a pessoa escreve o que ouviu
function Listen({ ex, value, onChange, result }) {
  const [playing, setPlaying] = useState(null) // 'normal' | 'slow' | null
  const [reveal, setReveal] = useState(false)
  const voice = useVoiceStatus()

  const play = (mode) => speak(ex.text, {
    rate: mode === 'slow' ? 0.55 : DEFAULT_RATE,
    onStart: () => setPlaying(mode),
    onEnd: () => setPlaying(null),
  })

  useEffect(() => {
    // toca automaticamente ao abrir o exercício (espera as vozes carregarem, se preciso)
    speak(ex.text)
    return stopSpeaking
  }, [ex.text])

  return (
    <>
      <h1 className="ex-q">Escute e escreva em <em>inglês</em>.</h1>
      {voice !== 'none' ? (
        <div className="listen-row">
          <button className={`speak-btn ${playing === 'normal' ? 'playing' : ''}`} onClick={() => play('normal')} aria-label="Ouvir a frase">
            {SpeakerIcon}
          </button>
          <button className={`speak-btn slow ${playing === 'slow' ? 'playing' : ''}`} onClick={() => play('slow')} aria-label="Ouvir devagar">
            <span aria-hidden="true">🐢</span>
          </button>
          <span className="sticker listen-sticker" aria-hidden="true">Listen!</span>
        </div>
      ) : (
        <p className="auth-notice">
          Este navegador não tem uma voz em inglês para ler a frase.{' '}
          {reveal ? <>A frase é: <strong lang="en">{ex.text}</strong></> : <button className="link" onClick={() => setReveal(true)}>Mostrar a frase</button>}
        </p>
      )}
      <AnswerBox value={value} onChange={onChange} result={result} label="O que você ouviu, em inglês" placeholder="Escreva o que ouviu…" />
    </>
  )
}

function Match({ ex, value, onChange, result, active }) {
  const { matched, errors } = value ?? emptyMatch
  // Embaralha uma única vez por exercício
  const [right] = useState(() => shuffle(ex.pairs.map((p) => p[1])))
  const [sel, setSel] = useState({ left: null, right: null })
  const [wrong, setWrong] = useState(null)
  const n = ex.pairs.length
  const ptOf = (en) => ex.pairs.find((p) => p[0] === en)[1]
  const doneRight = matched.map(ptOf)

  useEffect(() => {
    if (!wrong) return
    const t = setTimeout(() => setWrong(null), 550)
    return () => clearTimeout(t)
  }, [wrong])

  function choose(side, val) {
    if (result || (side === 'left' ? matched.includes(val) : doneRight.includes(val))) return
    const next = { ...sel, [side]: sel[side] === val ? null : val }
    if (next.left && next.right) {
      if (ptOf(next.left) === next.right) onChange({ matched: [...matched, next.left], errors })
      else {
        onChange({ matched, errors: errors + 1 })
        setWrong(next)
      }
      setSel({ left: null, right: null })
    } else setSel(next)
  }

  useKeys(({ number: k }) => {
    if (!k) return
    if (k <= n) choose('left', ex.pairs[k - 1][0])
    else if (k <= 2 * n) choose('right', right[k - n - 1])
  }, active)

  const cls = (side, val, done) => {
    if (done) return 'opt matched'
    if (wrong?.[side] === val) return 'opt bad shake'
    return `opt ${sel[side] === val ? 'picked' : ''}`
  }

  return (
    <>
      <h1 className="ex-q">Associe cada palavra à sua <em>tradução</em>.</h1>
      <div className="match-grid">
        <div>
          {ex.pairs.map(([en], i) => (
            <button key={en} lang="en" className={cls('left', en, matched.includes(en))} disabled={!!result || matched.includes(en)} aria-pressed={sel.left === en} onClick={() => choose('left', en)} style={{ '--i': i }}>
              <kbd>{i + 1}</kbd><span>{en}</span>
            </button>
          ))}
        </div>
        <div>
          {right.map((pt, i) => (
            <button key={pt} className={cls('right', pt, doneRight.includes(pt))} disabled={!!result || doneRight.includes(pt)} aria-pressed={sel.right === pt} onClick={() => choose('right', pt)} style={{ '--i': i + n }}>
              <kbd>{i + n + 1}</kbd><span>{pt}</span>
            </button>
          ))}
        </div>
      </div>
      {errors > 0 && !result && <p className="match-err muted">{errors} {errors === 1 ? 'erro' : 'erros'} até agora</p>}
    </>
  )
}
