import { useState } from 'react'
import { dayOffset, dayStr } from '../progress/clock.js'
import { shiftDay as shift } from '../progress/debug.js'

// Painel flutuante, só em desenvolvimento
export default function DebugClock() {
  const [open, setOpen] = useState(false)
  const off = dayOffset()
  const label = new Date(dayStr() + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })

  return (
    <div className={`debug-clock ${off ? 'shifted' : ''}`}>
      {open ? (
        <>
          <span title="Data simulada usada pelo app">📅 {label}{off ? ` (${off > 0 ? '+' : ''}${off}d)` : ''}</span>
          <button onClick={() => shift(off - 1)} aria-label="Voltar um dia">−1 dia</button>
          <button onClick={() => shift(off + 1)} aria-label="Avançar um dia">+1 dia</button>
          {off !== 0 && <button onClick={() => shift(0)}>Hoje real</button>}
          <button onClick={() => setOpen(false)} aria-label="Fechar painel de debug">×</button>
        </>
      ) : (
        <button onClick={() => setOpen(true)} title="Simular outra data (debug)">📅{off ? ` ${off > 0 ? '+' : ''}${off}d` : ''}</button>
      )}
    </div>
  )
}
