import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import units, { lessonStatus } from '../data/course.js'
import { choiceById, LEVEL_NAME } from '../data/levels.js'
import { parseDay } from '../progress/clock.js'
import { DAILY_GOAL, dayStr, getStreak, xpToday } from '../progress/progress.js'
import { useProgress } from '../progress/ProgressContext.jsx'
import ImportLocal from '../components/ImportLocal.jsx'

const XP_PER_CORRECT = 10
const ZIGZAG = [0, 24, 0, -24] // deslocamento horizontal de cada nó, em % da trilha
const ROW = 150 // altura de uma linha comum da trilha (px)
const ROW_CURRENT = 236 // a lição atual ganha mais espaço para o cartão com botão
const NODE_C = 44 // centro vertical do nó dentro da linha
const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const all = units.flatMap((u) => u.lessons)

// XP mostrado na trilha: o que o usuário ganhou de fato (melhor tentativa) ou o máximo possível
function XpTag({ lesson, st, earned }) {
  const max = lesson.exercises.length * XP_PER_CORRECT
  if (st === 'done' && earned !== undefined) {
    return <span className="xp" title={`Melhor resultado: ${earned} de ${max} XP possíveis`}>⭐ {earned}/{max} XP</span>
  }
  return <span className="xp xp-max" title="XP máximo, acertando todos os exercícios">até +{max} XP</span>
}

function Trail({ unit, status, lessonXp }) {
  // posição de cada nó, com altura variável para a lição atual
  const nodes = unit.lessons.reduce((acc, l) => {
    const prev = acc.at(-1)
    const y = prev ? prev.y + (prev.st === 'current' ? ROW_CURRENT : ROW) : 0
    return [...acc, { lesson: l, st: status(l), x: ZIGZAG[all.indexOf(l) % ZIGZAG.length], y }]
  }, [])
  const last = nodes.at(-1)
  const height = last.y + (last.st === 'current' ? ROW_CURRENT : ROW - 20)

  return (
    <div className="trail" style={{ height }}>
      <svg className="trail-line" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {nodes.slice(1).map((b, i) => {
          const a = nodes[i]
          const y1 = a.y + NODE_C
          const y2 = b.y + NODE_C
          const m = (y1 + y2) / 2
          return (
            <path
              key={b.lesson.id}
              className={a.st === 'done' && b.st !== 'locked' ? 'done' : ''}
              d={`M${50 + a.x} ${y1} C${50 + a.x} ${m} ${50 + b.x} ${m} ${50 + b.x} ${y2}`}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>

      <ol>
        {nodes.map(({ lesson: l, st, x, y: top }) => {
          const idx = all.indexOf(l)
          return (
            <li key={l.id} className={`node-row ${st}`} style={{ top, '--x': `${x}%`, '--i': idx }}>
              {st === 'locked' ? (
                <span className="node" aria-hidden="true">🔒</span>
              ) : (
                <Link to={`/lesson/${l.id}`} className="node" aria-label={`${st === 'done' ? 'Refazer' : 'Começar'}: ${l.title}`} tabIndex={st === 'current' ? -1 : undefined}>
                  {st === 'done' ? '✓' : '▶'}
                </Link>
              )}
              {st === 'current' && <span className="sticker here" aria-hidden="true">Você está aqui</span>}
              <div className="node-card">
                <strong>{l.title}</strong>
                <span className="node-meta">
                  {st === 'done' && 'Concluída · '}
                  {st === 'locked' && 'Bloqueada · '}
                  {st === 'open' && 'Liberada · '}
                  <XpTag lesson={l} st={st} earned={lessonXp?.[l.id]} />
                </span>
                {st === 'current' && (
                  <Link to={`/lesson/${l.id}`} className="pill small">Começar <span aria-hidden="true">→</span></Link>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function StreakCard({ progress }) {
  const today = dayStr()
  const streak = getStreak(progress, today)
  // semana atual, de segunda a domingo; acesos nos dias com atividade registrada
  const monday = parseDay(today)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, k) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + k)
    return d
  })
  const lit = (d) => progress.days[dayStr(d)] !== undefined
  const studiedToday = progress.days[today] !== undefined

  return (
    <section className="side-card streak-card">
      <span className="sticker side-sticker" aria-hidden="true">Keep going!</span>
      <p className="side-label">Sequência</p>
      <p className="streak-num"><span aria-hidden="true">🔥</span> {streak}<small>{streak === 1 ? ' dia' : ' dias'}</small></p>
      <ol className="week" aria-label="Esta semana">
        {days.map((d) => (
          <li key={dayStr(d)} className={`${lit(d) ? 'on' : ''} ${dayStr(d) === today ? 'today' : ''} ${dayStr(d) > today ? 'future' : ''}`} title={d.toLocaleDateString('pt-BR')}>
            <span>{WEEK[d.getDay()]}</span>
            <i aria-label={dayStr(d) > today ? 'ainda não chegou' : lit(d) ? 'estudou' : 'não estudou'} />
          </li>
        ))}
      </ol>
      <p className="muted side-note">
        {studiedToday ? 'Chama acesa hoje. Volte amanhã!' : streak ? 'Faça uma lição hoje para não perder a sequência.' : 'Faça uma lição hoje para acender a chama.'}
      </p>
    </section>
  )
}

function GoalCard({ progress }) {
  const today = xpToday(progress)
  const pct = Math.min(today / DAILY_GOAL, 1)
  const C = 2 * Math.PI * 42
  return (
    <section className="side-card goal-card">
      <p className="side-label">Meta diária</p>
      <div className="goal">
        <svg viewBox="0 0 100 100" className="ring" aria-hidden="true">
          <circle cx="50" cy="50" r="42" className="ring-bg" />
          <circle cx="50" cy="50" r="42" className="ring-fg" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
        </svg>
        <div>
          <p className="goal-num">{today}<small>/{DAILY_GOAL} XP</small></p>
          <p className="muted side-note">{pct >= 1 ? 'Meta batida! 🎉' : `Faltam ${DAILY_GOAL - today} XP hoje.`}</p>
        </div>
      </div>
      <div className="goal-total"><span>XP total</span><strong>⭐ {progress.xp}</strong></div>
    </section>
  )
}

export default function Home() {
  const { user } = useAuth()
  const progress = useProgress()
  const nextIdx = all.findIndex((l) => !progress.completed.includes(l.id))
  const status = lessonStatus(progress.completed, progress.placement?.level)
  const declared = choiceById(user.level)
  // Convite ao teste: só para quem disse que já sabe algo e ainda não fez
  const inviteTest = !progress.placement && declared && declared.start !== 'A1'

  return (
    <div className="learn">
      <div className="learn-main">
        <header className="learn-head">
          <p className="eyebrow rise">Inglês para quem fala português</p>
          <h1 className="rise" style={{ '--d': '80ms' }}>Olá, <em className="hl">{user.name}</em></h1>
          <p className="muted rise" style={{ '--d': '160ms' }}>
            {nextIdx === -1 ? 'Você concluiu todas as lições. Pode refazer qualquer uma!' : 'Siga a trilha: cada lição libera a próxima.'}
          </p>
        </header>

        <ImportLocal />

        {inviteTest && (
          <section className="test-invite rise" style={{ '--d': '200ms' }}>
            <span className="level-tag">{declared.range}</span>
            <div>
              <strong>Pule o que você já sabe</strong>
              <p className="muted">Você disse que tem nível {declared.label.toLowerCase()}. Faça o teste de 10 perguntas para liberar as unidades do seu nível.</p>
            </div>
            <Link to="/placement" className="pill small">Fazer teste <span aria-hidden="true">→</span></Link>
          </section>
        )}

        {units.map((unit, u) => {
          const done = unit.lessons.filter((l) => progress.completed.includes(l.id)).length
          const total = unit.lessons.length
          const [label, title] = unit.title.split(/:\s*/)
          return (
            <section key={unit.id} className="unit-block">
              <div className="unit-banner rise" style={{ '--d': `${200 + u * 80}ms` }}>
                <div>
                  <p className="unit-label">{label} <span className="unit-level" title={LEVEL_NAME[unit.level]}>{unit.level}</span></p>
                  <h2>{title ?? label}</h2>
                </div>
                <div className="unit-progress">
                  <span>{done}/{total} lições</span>
                  <div className="unit-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={`Progresso da ${label}`}>
                    <i style={{ width: `${(done / total) * 100}%` }} />
                  </div>
                </div>
              </div>
              <Trail unit={unit} status={status} lessonXp={progress.lessonXp} />
            </section>
          )
        })}
      </div>

      <aside className="learn-side">
        <StreakCard progress={progress} />
        <GoalCard progress={progress} />
      </aside>
    </div>
  )
}
