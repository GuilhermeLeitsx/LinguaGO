// Google Identity Services (botão oficial do Google renderizado no próprio site).
// O Google entrega um token de identidade (JWT) direto para a página, sem redirecionar
// pelo domínio do Supabase; o Supabase valida o token em signInWithIdToken.

// Só aceita um ID no formato do Google; um valor de exemplo desenharia um botão que falha ao clicar
const rawClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()
// formato real: <número do projeto>-<código>.apps.googleusercontent.com
export const GOOGLE_CLIENT_ID = /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(rawClientId) ? rawClientId : ''
if (import.meta.env.DEV && !GOOGLE_CLIENT_ID) {
  console.warn(rawClientId
    ? '[LinguaGo] VITE_GOOGLE_CLIENT_ID não parece um ID do Google (formato 123456-abc.apps.googleusercontent.com). O botão do Google fica desativado.'
    : '[LinguaGo] Falta VITE_GOOGLE_CLIENT_ID no .env: o botão do Google fica desativado.')
}

const SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const LOAD_TIMEOUT_MS = 10000

let loading = null

// Carrega o script do Google uma vez só. Rejeita se não carregar (bloqueador, sem internet).
export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  loading ??= new Promise((resolve, reject) => {
    const fail = () => {
      loading = null // permite tentar de novo depois
      reject(new Error('Não foi possível carregar o login com Google. Use e-mail e senha ou tente sem bloqueador de anúncios.'))
    }
    const timer = setTimeout(fail, LOAD_TIMEOUT_MS)
    const s = document.createElement('script')
    s.src = SCRIPT_URL
    s.async = true
    s.onload = () => {
      clearTimeout(timer)
      if (window.google?.accounts?.id) resolve(window.google.accounts.id)
      else fail()
    }
    s.onerror = () => { clearTimeout(timer); s.remove(); fail() }
    document.head.appendChild(s)
  })
  return loading
}

// Nonce: o valor original vai para o Supabase e o hash SHA-256 (hex) vai para o Google.
// O Supabase confere se o hash dentro do token bate com o original, o que impede
// reaproveitar um token de outra sessão. Precisa de contexto seguro (https ou localhost).
export async function createNonce() {
  if (!window.crypto?.subtle) {
    throw new Error('O login com Google só funciona em https ou em localhost.')
  }
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hashed = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return { raw, hashed }
}
