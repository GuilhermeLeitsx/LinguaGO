/*
  Direção visual: editorial + orgânico, com cara de caderno de idiomas.
  Fontes: Fraunces (títulos, com itálico expressivo) + DM Sans (texto).
  Cores: papel quente (fundo), verde-floresta (dominante), coral (CTA), mostarda (detalhes).
  Movimento: entrada escalonada no hero, revelações no scroll, contadores, cartão de exercício interativo.
*/
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import units from '../data/course.js'
import { useCountUp, useInView } from '../hooks.js'

const lessons = units.flatMap((u) => u.lessons)
const YEAR = new Date().getFullYear()
const exercises =lessons.reduce((n, l) => n + l.exercises.length, 0)

const FAQ = [
  ['O LinguaGo é grátis?', 'Sim. Você cria a conta e começa a estudar sem pagar nada.'],
  ['Quanto tempo dura cada lição?', 'Cerca de 5 minutos. Cada lição mistura múltipla escolha, ligar pares e tradução digitada.'],
  ['Preciso saber algum inglês antes?', 'Não. O curso começa em cumprimentos e apresentações, pensado para quem fala português.'],
  ['Meu progresso fica salvo?', 'Sim. Seu XP, sua sequência diária e as lições concluídas ficam salvos na sua conta.'],
  ['Funciona no celular?', 'Funciona. O site se adapta a qualquer tela, sem precisar instalar nada.'],
]

function Reveal({ children, delay = 0, as: Tag = 'div', className = '' }) {
  const [ref, seen] = useInView(0.15)
  return (
    <Tag ref={ref} className={`reveal ${seen ? 'in' : ''} ${className}`} style={{ '--d': `${delay}ms` }}>
      {children}
    </Tag>
  )
}

function Header() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header className={`lp-header ${scrolled ? 'scrolled' : ''}`}>
      <Link to="/" className="brand"><Logo /></Link>
      <nav>
        <a href="#como">Como funciona</a>
        <a href="#recursos">Recursos</a>
        <a href="#faq">Dúvidas</a>
        <Link to="/login" className="ghost-link">Entrar</Link>
        <Link to="/register" className="pill small">Começar</Link>
      </nav>
    </header>
  )
}

// Cartão de exercício de verdade: dá pra clicar e ver o feedback
function DemoCard() {
  const [picked, setPicked] = useState(null)
  const opts = ['Boa noite', 'Bom dia', 'Boa tarde', 'Até logo']
  const right = 'Bom dia'
  return (
    <div className="demo" aria-label="Exemplo de exercício">
      <span className="sticker s1" aria-hidden="true">Hello!</span>
      <span className="sticker s2" aria-hidden="true">Obrigado</span>
      <span className="sticker s3" aria-hidden="true">See you</span>
      <div className="demo-card">
        <div className="demo-top">
          <div className="demo-bar"><i style={{ width: picked ? '60%' : '40%' }} /></div>
          <span>🔥 7</span>
        </div>
        <p className="demo-q">O que significa <b>“Good morning”</b>?</p>
        <div className="demo-opts">
          {opts.map((o) => (
            <button
              key={o}
              disabled={!!picked}
              className={`demo-opt ${picked === o ? (o === right ? 'ok' : 'bad') : ''} ${picked && o === right ? 'ok' : ''}`}
              onClick={() => setPicked(o)}
            >{o}</button>
          ))}
        </div>
        <div className={`demo-fb ${picked ? 'show' : ''}`} role="status">
          {picked && (picked === right ? 'Correto! +10 XP' : `Quase! A resposta é “${right}”`)}
          {picked && <button className="link" onClick={() => setPicked(null)}>de novo</button>}
        </div>
        {!picked && <p className="demo-hint">↑ clique numa resposta</p>}
      </div>
    </div>
  )
}

function Stat({ value, suffix = '', label }) {
  const [ref, seen] = useInView(0.4)
  const n = useCountUp(value, seen)
  return (
    <div ref={ref} className="stat">
      <strong>{n}{suffix}</strong>
      <span>{label}</span>
    </div>
  )
}

const Icon = {
  bolt: <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M27 4 10 27h12l-3 17 19-25H26z" /></svg>,
  flame: <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4c2 8 12 12 12 24a12 12 0 0 1-24 0c0-5 3-8 5-11 1 4 3 5 4 5 0-6-1-11 3-18z" /></svg>,
  pairs: <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="15" cy="24" r="9" /><circle cx="33" cy="24" r="9" /></svg>,
  type: <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 12h32v6H27v22h-6V18H8z" /></svg>,
}

export default function Landing() {
  return (
    <div className="lp">
      <Header />

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow rise" style={{ '--d': '0ms' }}>Inglês para quem fala português</p>
          <h1>
            <span className="rise" style={{ '--d': '80ms' }}>Aprenda inglês</span>{' '}
            <span className="rise" style={{ '--d': '180ms' }}>em lições de</span>{' '}
            <em className="rise" style={{ '--d': '280ms' }}>5 minutos.</em>
          </h1>
          <p className="lede rise" style={{ '--d': '420ms' }}>
            Exercícios curtos, XP e uma sequência diária que faz o estudo virar hábito. Sem decoreba de lista, sem pressa.
          </p>
          <div className="cta-row rise" style={{ '--d': '540ms' }}>
            <Link to="/register" className="pill">Começar grátis <span aria-hidden="true">→</span></Link>
            <a href="#como" className="text-link">Ver como funciona</a>
          </div>
          <div className="proof rise" style={{ '--d': '660ms' }}>
            <Stat value={units.length} label="unidades" />
            <Stat value={lessons.length} label="lições" />
            <Stat value={exercises} label="exercícios" />
          </div>
        </div>
        <div className="hero-visual rise" style={{ '--d': '360ms' }}>
          <DemoCard />
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((k) => (
            <span key={k}>
              Hello ✦ Good morning ✦ Nice to meet you ✦ Thank you ✦ Please ✦ See you soon ✦ How are you? ✦
            </span>
          ))}
        </div>
      </div>

      <section id="como" className="how">
        <Reveal as="h2">Três passos, todo dia</Reveal>
        <ol>
          {[
            ['Escolha a lição', 'Siga o caminho da unidade. Cada lição libera a próxima.'],
            ['Resolva 5 exercícios', 'Escolha, ligue pares e traduza. Você vê na hora se acertou.'],
            ['Ganhe XP e mantenha a chama', 'Volte amanhã e a sequência cresce. É assim que o inglês fica.'],
          ].map(([t, d], i) => (
            <Reveal as="li" key={t} delay={i * 120}>
              <span className="num">{i + 1}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      <section id="recursos" className="features">
        <Reveal as="h2">O que tem dentro</Reveal>
        <div className="bento">
          <Reveal className="b b1">
            <span className="ico">{Icon.type}</span>
            <h3>Você digita, não só clica</h3>
            <p>Traduzir de cabeça fixa muito mais do que escolher a alternativa certa. A gente mistura os dois tipos.</p>
          </Reveal>
          <Reveal className="b b2" delay={100}>
            <span className="ico">{Icon.pairs}</span>
            <h3>Ligar pares</h3>
            <p>Vocabulário novo em formato de jogo.</p>
          </Reveal>
          <Reveal className="b b3" delay={200}>
            <span className="ico">{Icon.flame}</span>
            <h3>Sequência diária</h3>
            <p>Estude hoje, a chama continua acesa.</p>
          </Reveal>
          <Reveal className="b b4" delay={300}>
            <span className="ico">{Icon.bolt}</span>
            <h3>XP a cada acerto</h3>
            <p>Cada resposta certa vale 10 XP. Seu progresso fica salvo no perfil.</p>
          </Reveal>
        </div>
      </section>

      <section id="faq" className="faq">
        <Reveal as="h2">Dúvidas comuns</Reveal>
        <Faq />
      </section>

      <section className="final">
        <Reveal>
          <h2>Seu primeiro <em>“Hello”</em> está a uma lição de distância.</h2>
          <p>Crie sua conta em menos de um minuto.</p>
          <Link to="/register" className="pill big">Criar conta grátis <span aria-hidden="true">→</span></Link>
        </Reveal>
      </section>

      <footer className="lp-footer">
        <div className="f-brand">
          <span className="brand"><Logo /></span>
          <p>Inglês em lições curtas, todo dia.</p>
        </div>
        <div>
          <h4>Produto</h4>
          <a href="#como">Como funciona</a>
          <a href="#recursos">Recursos</a>
          <a href="#faq">Dúvidas</a>
        </div>
        <div>
          <h4>Conta</h4>
          <Link to="/login">Entrar</Link>
          <Link to="/register">Criar conta</Link>
        </div>
        <div>
          <h4>Legal</h4>
          <a href="#faq">Termos de uso</a>
          <a href="#faq">Privacidade</a>
        </div>
        <p className="copy">© {YEAR} LinguaGo</p>
      </footer>
    </div>
  )
}

function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <div className="acc">
      {FAQ.map(([q, a], i) => (
        <div key={q} className={`acc-item ${open === i ? 'open' : ''}`}>
          <button aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
            <span>{q}</span>
            <i aria-hidden="true" />
          </button>
          <div className="acc-body"><p>{a}</p></div>
        </div>
      ))}
    </div>
  )
}
