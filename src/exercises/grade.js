// Rótulos, dicas de teclado e correção de cada tipo de exercício.
//
// Formato de cada tipo nos arquivos src/data/en/lessons/*.json:
//   choice    { question, options[], answer }
//   translate { prompt: "Traduza: …", answer[] (aceitas, minúsculas) }
//   match     { pairs: [[inglês, português], …] }
//   build     { prompt, words[] (frase certa, em ordem), distractors[]?, answer[]? (outras ordens aceitas) }
//   fill      { sentence: "… ___ …", translation, options[], answer }
//   listen    { text (o que é falado), answer[]? (outras grafias aceitas) }
// Todos aceitam "explain", mostrado na barra de feedback.

export const TYPE_LABEL = {
  choice: 'Múltipla escolha',
  translate: 'Tradução',
  match: 'Associe os pares',
  build: 'Monte a frase',
  fill: 'Complete a lacuna',
  listen: 'Escute e escreva',
}

export const KEY_HINT = {
  choice: 'Teclas 1–4 escolhem · Enter verifica',
  translate: 'Escreva em inglês · Enter verifica',
  match: 'Teclas 1–4 e 5–8 associam os pares · Enter verifica',
  build: 'Números escolhem blocos · Backspace desfaz · Enter verifica',
  fill: 'Teclas 1–4 escolhem · Enter verifica',
  listen: 'Escreva o que ouviu · Enter verifica',
}

const norm = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/[.!?,;:"“”]/g, '').replace(/\s+/g, ' ').trim()
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
export const emptyMatch = { matched: [], errors: 0 }
export const fillSentence = (ex, word) => ex.sentence.replace('___', word)

export function canCheck(ex, value) {
  switch (ex.type) {
    case 'choice':
    case 'fill': return value != null
    case 'translate':
    case 'listen': return !!value?.trim()
    case 'build': return !!value?.length
    default: return (value ?? emptyMatch).matched.length === ex.pairs.length
  }
}

// Explica o erro de um "Monte a frase": quais blocos sobraram, quais faltaram ou se foi só a ordem
function buildMistake(words, used) {
  const q = (list) => list.map((w) => `“${w}”`).join(', ')
  const extra = [...used]
  const missing = []
  for (const w of words) {
    const i = extra.findIndex((u) => norm(u) === norm(w))
    if (i === -1) missing.push(w)
    else extra.splice(i, 1)
  }
  if (extra.length === 1 && missing.length === 1) {
    return `O erro foi “${extra[0]}”: o certo é “${missing[0]}”. O resto estava certo.`
  }
  const parts = []
  if (extra.length) parts.push(`${extra.length === 1 ? 'Não entra' : 'Não entram'} nesta frase: ${q(extra)}.`)
  if (missing.length) parts.push(`Faltou: ${q(missing)}.`)
  if (!parts.length) parts.push('As palavras estavam certas, só a ordem que não.')
  return parts.join(' ')
}

// Corrige a resposta: { correct, answer, note?, speak? }
//   answer: texto da resposta certa · speak: frase em inglês que pode ser ouvida no feedback
export function grade(ex, value) {
  switch (ex.type) {
    case 'choice':
      return { correct: value === ex.answer, answer: ex.answer }
    case 'translate': {
      const a = cap(ex.answer[0])
      return { correct: ex.answer.map(norm).includes(norm(value)), answer: a, speak: a }
    }
    case 'build': {
      const right = ex.words.join(' ')
      const used = value.map((t) => t.w)
      const ok = [right, ...(ex.answer ?? [])].map(norm)
      const correct = ok.includes(norm(used.join(' ')))
      return { correct, answer: right, speak: right, note: correct ? null : buildMistake(ex.words, used) }
    }
    case 'fill': {
      const full = fillSentence(ex, ex.answer)
      return { correct: value === ex.answer, answer: full, speak: full }
    }
    case 'listen': {
      const ok = [ex.text, ...(ex.answer ?? [])].map(norm)
      return { correct: ok.includes(norm(value)), answer: ex.text, speak: ex.text }
    }
    default: {
      const { errors } = value ?? emptyMatch
      return {
        correct: errors === 0,
        answer: ex.pairs.map(([en, pt]) => `${en} = ${pt}`).join(' · '),
        note: errors ? `Você errou ${errors} ${errors === 1 ? 'associação' : 'associações'} antes de completar.` : null,
      }
    }
  }
}
