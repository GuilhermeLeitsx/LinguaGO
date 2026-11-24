// Níveis do QECR (CEFR) usados no curso e as opções mostradas no cadastro.
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']

export const LEVEL_NAME = {
  A1: 'Iniciante',
  A2: 'Básico',
  B1: 'Intermediário',
  B2: 'Intermediário avançado',
  C1: 'Avançado',
}

// Opções do cadastro: o que a pessoa declara saber → nível em que a trilha deveria começar
export const LEVEL_CHOICES = [
  { id: 'none', label: 'Nunca estudei', range: 'A1', start: 'A1', hint: 'Começo do zero' },
  { id: 'basic', label: 'Básico', range: 'A1–A2', start: 'A2', hint: 'Frases simples e o dia a dia' },
  { id: 'intermediate', label: 'Intermediário', range: 'B1–B2', start: 'B1', hint: 'Converso sobre assuntos comuns' },
  { id: 'advanced', label: 'Avançado', range: 'C1', start: 'C1', hint: 'Entendo quase tudo, quero refinar' },
]

export const rank = (level) => Math.max(0, LEVELS.indexOf(level))
export const choiceById = (id) => LEVEL_CHOICES.find((c) => c.id === id)
