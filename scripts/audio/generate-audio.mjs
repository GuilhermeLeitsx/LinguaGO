// Gera um MP3 para cada frase em inglês que o app fala, com o Kokoro (roda localmente).
//
// Uso (na raiz do projeto, depois de "npm install --prefix scripts/audio"):
//   npm run audio -- --dry-run            mostra o que seria gerado, sem carregar o modelo
//   npm run audio -- --sample             gera 3 frases com 3 vozes em scripts/audio/samples/
//   npm run audio -- --voice=af_heart     gera os áudios que faltam em public/audio/
//   npm run audio -- --prune              também apaga os MP3s de frases que não existem mais
//
// Cada arquivo se chama <hash>.mp3, onde o hash junta frase, voz, velocidade e modelo.
// Assim só é gerado o que é novo ou mudou; trocar a voz gera tudo de novo.
// public/audio/manifest.json liga cada frase ao arquivo dela (o site lê esse arquivo).

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spokenText } from '../../src/exercises/grade.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const DATA = path.join(ROOT, 'src/data/en')
const OUT = path.join(ROOT, 'public/audio')
const MANIFEST = path.join(OUT, 'manifest.json')
const SAMPLES = path.join(HERE, 'samples')

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const DTYPE = 'fp32'
const SPEED = 0.9
const BITRATE = 64 // kbps, mono
const SAMPLE_VOICES = ['af_heart', 'af_bella', 'am_michael']
const SAMPLE_PHRASES = ['Nice to meet you.', 'Where were you last weekend?']

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))

// Todas as frases que o app fala: as das lições do curso e os "listen" do nivelamento
function collectTexts() {
  const course = readJson(path.join(DATA, 'course.json'))
  const exercises = course.units.flatMap((u) => u.lessons).flatMap((id) => readJson(path.join(DATA, 'lessons', `${id}.json`)).exercises)
  const placement = readJson(path.join(DATA, 'placement.json')).questions.filter((q) => q.type === 'listen')
  const texts = [...exercises, ...placement].map(spokenText).filter(Boolean).map((t) => t.trim())
  return [...new Set(texts)].sort((a, b) => a.localeCompare(b))
}

const fileFor = (text, voice) =>
  createHash('sha256').update(JSON.stringify({ text, voice, speed: SPEED, model: MODEL, dtype: DTYPE, bitrate: BITRATE })).digest('hex').slice(0, 12) + '.mp3'

function readManifest() {
  try {
    return readJson(MANIFEST)
  } catch {
    return null
  }
}

async function loadTTS() {
  const { KokoroTTS } = await import('kokoro-js')
  console.log(`Carregando o modelo ${MODEL} (${DTYPE}). Na primeira vez ele é baixado (~300 MB).`)
  return KokoroTTS.from_pretrained(MODEL, { dtype: DTYPE, device: 'cpu' })
}

// Float32 [-1, 1] em 24 kHz -> MP3 mono
async function toMp3(audio) {
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const pcm = new Int16Array(audio.audio.length)
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.max(-1, Math.min(1, audio.audio[i])) * 0x7fff
  const enc = new Mp3Encoder(1, audio.sampling_rate, BITRATE)
  const parts = []
  for (let i = 0; i < pcm.length; i += 1152) parts.push(enc.encodeBuffer(pcm.subarray(i, i + 1152)))
  parts.push(enc.flush())
  return Buffer.concat(parts.map((p) => Buffer.from(p.buffer, p.byteOffset, p.byteLength)))
}

async function speak(tts, text, voice) {
  return toMp3(await tts.generate(text, { voice, speed: SPEED }))
}

// --sample: as mesmas frases em cada voz, com uma página para ouvir lado a lado
async function sample(texts) {
  const longest = texts.reduce((a, b) => (b.length > a.length ? b : a), '')
  const phrases = [...new Set([...SAMPLE_PHRASES, longest])]
  fs.mkdirSync(SAMPLES, { recursive: true })
  const tts = await loadTTS()
  const rows = []
  for (const voice of SAMPLE_VOICES) {
    const cells = []
    for (const [i, text] of phrases.entries()) {
      const name = `${voice}-${i + 1}.mp3`
      fs.writeFileSync(path.join(SAMPLES, name), await speak(tts, text, voice))
      console.log(`  ${name}  ${text}`)
      cells.push(`<td><audio controls preload="none" src="${name}"></audio></td>`)
    }
    rows.push(`<tr><th>${voice}</th>${cells.join('')}</tr>`)
  }
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  fs.writeFileSync(path.join(SAMPLES, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Prévia das vozes</title>
<style>body{font-family:system-ui,sans-serif;margin:24px}th,td{padding:8px 12px;text-align:left;vertical-align:top}thead th{font-weight:600;max-width:260px}</style>
<h1>Prévia das vozes (velocidade ${SPEED})</h1>
<table><thead><tr><th>Voz</th>${phrases.map((t) => `<th>${esc(t)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`)
  console.log(`\nAbra ${path.join(SAMPLES, 'index.html')} para ouvir e comparar.`)
}

async function main() {
  const texts = collectTexts()
  if (flag('sample')) return sample(texts)

  const manifest = readManifest()
  const voice = option('voice') ?? manifest?.voice
  if (!voice) throw new Error('Escolha a voz: npm run audio -- --voice=af_heart (ou rode --sample para ouvir as opções).')

  const files = Object.fromEntries(texts.map((t) => [t, fileFor(t, voice)]))
  const missing = texts.filter((t) => !fs.existsSync(path.join(OUT, files[t])))
  const wanted = new Set(Object.values(files))
  const orphans = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((f) => f.endsWith('.mp3') && !wanted.has(f)) : []

  console.log(`Voz: ${voice} · velocidade ${SPEED}`)
  console.log(`Frases: ${texts.length} · já existem: ${texts.length - missing.length} · a gerar: ${missing.length} (${missing.reduce((n, t) => n + t.length, 0)} caracteres) · sobrando: ${orphans.length}`)
  missing.forEach((t) => console.log(`  + ${files[t]}  ${t}`))
  orphans.forEach((f) => console.log(`  - ${f}  ${flag('prune') ? '(será apagado)' : '(use --prune para apagar)'}`))
  if (flag('dry-run')) return

  fs.mkdirSync(OUT, { recursive: true })
  if (missing.length) {
    const tts = await loadTTS()
    for (const [i, text] of missing.entries()) {
      fs.writeFileSync(path.join(OUT, files[text]), await speak(tts, text, voice))
      console.log(`  [${i + 1}/${missing.length}] ${files[text]}  ${text}`)
    }
  }
  if (flag('prune')) orphans.forEach((f) => fs.rmSync(path.join(OUT, f)))
  fs.writeFileSync(MANIFEST, JSON.stringify({ voice, speed: SPEED, model: MODEL, files }, null, 2) + '\n')
  console.log(`Pronto: ${missing.length} gerado(s). Manifest com ${texts.length} frases em public/audio/manifest.json.`)
}

main().catch((err) => {
  console.error(`Erro: ${err.message}`)
  process.exit(1)
})
