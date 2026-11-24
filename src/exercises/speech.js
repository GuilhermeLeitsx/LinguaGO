// Leitura em voz alta com a Web Speech API (speechSynthesis), sem dependências.
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

function englishVoice() {
  const voices = window.speechSynthesis.getVoices()
  return voices.find((v) => v.lang === 'en-US' && v.localService) ||
    voices.find((v) => v.lang === 'en-US') ||
    voices.find((v) => v.lang?.startsWith('en'))
}

// Fala o texto em inglês. rate < 1 deixa mais devagar. Retorna false se o navegador não suporta.
export function speak(text, { rate = 0.9, onStart, onEnd } = {}) {
  if (!canSpeak || !text) return false
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = rate
  const v = englishVoice()
  if (v) u.voice = v
  if (onStart) u.onstart = onStart
  if (onEnd) { u.onend = onEnd; u.onerror = onEnd }
  synth.speak(u)
  return true
}

export function stopSpeaking() {
  if (canSpeak) window.speechSynthesis.cancel()
}
