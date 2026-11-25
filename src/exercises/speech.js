// Leitura em voz alta das frases em inglês.
//
// 1. Áudio pré-gerado: public/audio/manifest.json liga cada frase a um MP3
//    (gerado pelo script scripts/audio/generate-audio.mjs).
// 2. Reserva: speechSynthesis do navegador, só com voz em inglês (en-US ou en-GB).
// 3. Sem MP3 e sem voz em inglês: não fala; a tela mostra um aviso no lugar.

export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
const canPlayAudio = typeof window !== 'undefined' && typeof Audio !== 'undefined'

export const DEFAULT_RATE = 0.9
const SLOW_PLAYBACK = 0.75 // o MP3 já foi gerado na velocidade 0.9; "devagar" toca a 0.75x
const LOAD_TIMEOUT_MS = 2000
const AUDIO_BASE = `${import.meta.env.BASE_URL}audio/`

// Estado compartilhado:
//   status: 'loading' até a lista de vozes carregar; depois 'ready' (com voz em inglês) ou 'none'
//   files:  null enquanto o manifest carrega; depois { frase: arquivo.mp3 } (vazio se não houver)
let state = { status: canSpeak ? 'loading' : 'none', voice: null, files: canPlayAudio ? null : {} }
const listeners = new Set()
const update = (patch) => {
  state = { ...state, ...patch }
  listeners.forEach((fn) => fn())
}

// ---------------------------------------------------------------------------
// Áudios pré-gerados
// ---------------------------------------------------------------------------

let manifestLoading = null
function loadManifest() {
  if (state.files) return Promise.resolve(state.files)
  manifestLoading ??= fetch(`${AUDIO_BASE}manifest.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((m) => m.files ?? {})
    .catch(() => ({}))
    .then((files) => {
      update({ files })
      return files
    })
  return manifestLoading
}

// ---------------------------------------------------------------------------
// Voz do navegador (reserva)
// ---------------------------------------------------------------------------

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
  const status = voice ? 'ready' : 'none'
  if (voice === state.voice && status === state.status) return
  if (import.meta.env.DEV) {
    console.info(voice ? `[LinguaGo] Voz de reserva: ${voice.name} (${voice.lang})` : '[LinguaGo] Nenhuma voz em inglês no navegador; só os áudios pré-gerados vão tocar.')
  }
  update({ status, voice })
}

// A lista de vozes pode chegar vazia e em partes (no Chrome: primeiro as do sistema,
// depois as do Google), sempre pelo evento voiceschanged. Por isso:
//   - a escolha é refeita a cada mudança da lista;
//   - a primeira espera termina quando aparece uma voz em inglês ou no tempo limite
//     (alguns navegadores nunca disparam o evento).
let voicesLoading = null
export function loadVoices() {
  if (!canSpeak) return Promise.resolve(state)
  const synth = window.speechSynthesis
  voicesLoading ??= new Promise((resolve) => {
    let settled = false
    const settle = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      setVoices(synth.getVoices())
      resolve(state)
    }
    const onChange = () => {
      const voices = synth.getVoices()
      if (!settled) { if (pickVoice(voices)) settle() }
      else if (voices.length) setVoices(voices)
    }
    const timer = setTimeout(settle, LOAD_TIMEOUT_MS)
    synth.addEventListener('voiceschanged', onChange)
    if (pickVoice(synth.getVoices())) settle()
  })
  return voicesLoading
}

// ---------------------------------------------------------------------------
// Para componentes React (useSyncExternalStore)
// ---------------------------------------------------------------------------

export function subscribeVoice(fn) {
  listeners.add(fn)
  loadVoices()
  loadManifest()
  return () => listeners.delete(fn)
}
export const getVoiceState = () => state

// Dá para ouvir esta frase? Enquanto algo ainda carrega, considera que sim (evita o aviso piscar).
export function canSay(text, s = state) {
  if (!text) return false
  if (s.files === null || s.status === 'loading') return true
  return Boolean(s.files[text.trim()]) || s.status === 'ready'
}

// ---------------------------------------------------------------------------
// Falar e parar
// ---------------------------------------------------------------------------

let token = 0 // cada fala nova (ou stopSpeaking) cancela a anterior, inclusive a que ainda carregava
let current = null // <audio> tocando agora

function stopAudio() {
  if (!current) return
  current.onended = current.onerror = current.onplay = null
  current.pause()
  current = null
}

function speakWithVoice(text, rate, onStart, onEnd) {
  if (!state.voice) { onEnd?.(); return }
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

function playFile(file, text, rate, onStart, onEnd, my) {
  const a = new Audio(AUDIO_BASE + file)
  a.playbackRate = rate < DEFAULT_RATE ? SLOW_PLAYBACK : 1
  a.preservesPitch = true
  current = a
  a.onplay = () => onStart?.()
  a.onended = () => { if (current === a) current = null; onEnd?.() }
  // arquivo faltando ou corrompido: cai na voz do navegador
  a.onerror = () => {
    if (current === a) current = null
    if (my === token) loadVoices().then(() => { if (my === token) speakWithVoice(text, rate, onStart, onEnd) })
  }
  a.play().catch((err) => {
    // bloqueio de autoplay: não toca nada até a pessoa clicar no botão de ouvir
    if (err?.name === 'NotAllowedError') { if (current === a) current = null; onEnd?.() }
  })
}

// Fala o texto em inglês. Retorna false se não há como falar (sem MP3 e sem voz em inglês).
export function speak(text, { rate = DEFAULT_RATE, onStart, onEnd } = {}) {
  if (!text || !canSay(text)) return false
  const my = ++token
  stopAudio()
  if (canSpeak) window.speechSynthesis.cancel()
  loadVoices() // já começa a carregar a reserva, caso o MP3 falte ou falhe
  loadManifest().then((files) => {
    if (my !== token) return
    const file = canPlayAudio && files[text.trim()]
    if (file) return playFile(file, text, rate, onStart, onEnd, my)
    // sem MP3: espera a lista de vozes só agora
    loadVoices().then(() => { if (my === token) speakWithVoice(text, rate, onStart, onEnd) })
  })
  return true
}

export function stopSpeaking() {
  token++
  stopAudio()
  if (canSpeak) window.speechSynthesis.cancel()
}
