// Leitura em voz alta com a Web Speech API (speechSynthesis), sem dependências.
// Só fala com voz em inglês (en-US ou en-GB). Sem voz em inglês, não fala:
// a tela mostra um aviso no lugar.

export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

export const DEFAULT_RATE = 0.9
const LOAD_TIMEOUT_MS = 2000

// Estado da voz: 'loading' até a lista carregar; depois 'ready' (com voz) ou 'none'
let state = { status: canSpeak ? 'loading' : 'none', voice: null }
const listeners = new Set()
let loading = null

const langOf = (v) => (v.lang || '').replace('_', '-').toLowerCase()
const isUS = (v) => langOf(v) === 'en-us'
const isEnglish = (v) => isUS(v) || langOf(v) === 'en-gb'

// Entre as vozes neurais do Edge, as adultas mais naturais primeiro.
// "Ana" é voz infantil: fica por último.
const NEURAL_FAVORITES = ['Aria', 'Jenny', 'Guy', 'Ava', 'Andrew', 'Emma', 'Brian']
const neuralRank = (v) => {
  const i = NEURAL_FAVORITES.findIndex((n) => new RegExp(`\\b${n}`).test(v.name))
  if (i >= 0) return i
  return /\bAna\b/.test(v.name) ? 99 : 50
}

// Ordem de preferência: vozes neurais do Edge ("Natural"/"Online"), depois a do
// Chrome ("Google US English"), depois qualquer en-US e, por último, en-GB.
export function pickVoice(voices) {
  const en = voices.filter(isEnglish)
  const neural = en.filter((v) => /natural|online/i.test(v.name))
  const best = (list) => [...list].sort((a, b) => neuralRank(a) - neuralRank(b))[0]
  return best(neural.filter(isUS)) ||
    best(neural) ||
    en.find((v) => v.name === 'Google US English') ||
    en.find(isUS) ||
    en[0] ||
    null
}

function setVoices(voices) {
  const voice = pickVoice(voices)
  state = { status: voice ? 'ready' : 'none', voice }
  if (import.meta.env.DEV) {
    console.info(voice ? `[LinguaGo] Voz escolhida: ${voice.name} (${voice.lang})` : '[LinguaGo] Nenhuma voz em inglês disponível neste navegador.')
  }
  listeners.forEach((fn) => fn())
}

// Espera a lista de vozes: no Chrome ela chega vazia e só vem no evento voiceschanged.
// Alguns navegadores nunca disparam o evento; por isso há um tempo limite.
export function loadVoices() {
  if (!canSpeak) return Promise.resolve(state)
  if (state.status !== 'loading') return Promise.resolve(state)
  if (loading) return loading
  const synth = window.speechSynthesis
  loading = new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener('voiceschanged', onChange)
      clearTimeout(timer)
      setVoices(synth.getVoices())
      resolve(state)
    }
    const onChange = () => { if (synth.getVoices().length) done() }
    const timer = setTimeout(done, LOAD_TIMEOUT_MS)
    synth.addEventListener('voiceschanged', onChange)
    if (synth.getVoices().length) done()
  })
  return loading
}

// Para componentes React (useSyncExternalStore)
export function subscribeVoice(fn) {
  listeners.add(fn)
  loadVoices()
  return () => listeners.delete(fn)
}
export const getVoiceState = () => state

// Cada fala nova (ou stopSpeaking) invalida uma fala que ainda esperava as vozes
let token = 0

// Fala o texto em inglês. Retorna false se não há como falar (sem suporte ou sem voz em inglês).
export function speak(text, { rate = DEFAULT_RATE, onStart, onEnd } = {}) {
  if (!canSpeak || !text || state.status === 'none') return false
  const my = ++token
  const say = () => {
    if (my !== token || !state.voice) return
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.voice = state.voice
    u.lang = state.voice.lang
    u.rate = rate
    if (onStart) u.onstart = onStart
    if (onEnd) { u.onend = onEnd; u.onerror = onEnd }
    synth.speak(u)
  }
  if (state.status === 'ready') say()
  else loadVoices().then(say)
  return true
}

export function stopSpeaking() {
  token++
  if (canSpeak) window.speechSynthesis.cancel()
}
