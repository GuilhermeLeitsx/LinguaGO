import { createClient } from '@supabase/supabase-js'

// Chave PÚBLICA (publishable/anon): pode ficar no navegador. Quem protege os dados é o RLS.
// A chave secreta (service_role / sb_secret_…) nunca entra no front.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error('Faltam VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env (veja .env.example) e reinicie o servidor.')
}

export const supabase = createClient(url, key, { auth: { flowType: 'pkce' } })

// Mensagem em português para erros do Supabase (Auth, banco e rede)
export function friendlyError(err) {
  const code = err?.code ?? ''
  const msg = err?.message ?? String(err ?? '')
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered/i.test(msg)) return 'Já existe uma conta com esse e-mail.'
  if (code === 'weak_password' || /password should be/i.test(msg)) return 'Senha fraca: use pelo menos 6 caracteres.'
  if (code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(msg)) return 'E-mail inválido.'
  if (code === 'email_not_confirmed') return 'Confirme seu e-mail antes de entrar.'
  if (err?.hint === 'invalid_day') return 'A data do seu aparelho não confere com a data de hoje. Ajuste a data e o fuso horário e tente de novo.'
  if (/provider is not enabled/i.test(msg)) return 'O login com Google não está ativado no momento. Use e-mail e senha.'
  if (/id[_ ]?token|nonce|audience/i.test(msg)) return 'Não foi possível entrar com o Google. Tente de novo.'
  if (/rate limit/i.test(code + msg)) return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.'
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.'
  return 'Algo deu errado. Tente de novo em instantes.'
}
