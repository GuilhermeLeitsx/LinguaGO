import { createContext, useContext, useEffect, useState } from 'react'
import { friendlyError, supabase } from '../lib/supabase.js'

// Login com Supabase Auth (e-mail e senha). O perfil (nome, nível, fuso) fica em public.profiles,
// criado por um gatilho no banco quando a conta nasce.

const AuthContext = createContext(null)

const browserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
  } catch {
    return 'America/Sao_Paulo'
  }
}

async function fetchProfile(uid) {
  const { data, error } = await supabase.from('profiles').select('name, declared_level, timezone').eq('id', uid).single()
  if (error) throw error
  // mantém o fuso do perfil igual ao do navegador (o dia de estudo é sempre o dia local)
  const tz = browserTimezone()
  if (data.timezone !== tz) {
    const { error: tzErr } = await supabase.from('profiles').update({ timezone: tz }).eq('id', uid)
    if (!tzErr) data.timezone = tz
  }
  return data
}

export function AuthProvider({ children }) {
  // undefined = ainda verificando a sessão; null = sem login
  const [session, setSession] = useState(undefined)
  // perfil sempre amarrado ao id que o carregou, para nunca mostrar o perfil de outra conta
  const [profile, setProfile] = useState({ uid: null, data: null, error: null })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    // Só atualiza o estado aqui: chamar o Supabase dentro deste callback pode travar o cliente
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const uid = session?.user?.id ?? null
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!uid) return
    let alive = true
    fetchProfile(uid)
      .then((data) => alive && setProfile({ uid, data, error: null }))
      .catch((error) => alive && setProfile({ uid, data: null, error }))
    return () => { alive = false }
  }, [uid, reloadKey])

  const profileReady = !!uid && profile.uid === uid
  const loading = session === undefined || (!!uid && !profileReady)
  const user = profileReady && profile.data
    ? {
        id: uid,
        email: session.user.email,
        name: profile.data.name,
        level: profile.data.declared_level ?? null,
        timezone: profile.data.timezone,
      }
    : null
  const profileError = profileReady ? profile.error : null

  // level: id da opção escolhida no cadastro (ver LEVEL_CHOICES em data/levels.js)
  async function register(name, email, password, level) {
    email = email.trim().toLowerCase()
    name = name.trim()
    if (!name || !email || password.length < 6) {
      throw new Error('Preencha tudo e use uma senha com pelo menos 6 caracteres.')
    }
    if (!level) throw new Error('Escolha o seu nível de inglês.')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, declared_level: level, timezone: browserTimezone() } },
    })
    if (error) throw new Error(friendlyError(error))
    // E-mail já cadastrado (com confirmação ligada): o Supabase devolve um usuário sem identidades
    if (data.user && data.user.identities?.length === 0) throw new Error('Já existe uma conta com esse e-mail.')
    // Com "Confirm email" ligado no painel, não há sessão até a pessoa confirmar
    if (!data.session) throw new Error('Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.')
  }

  async function login(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) throw new Error(friendlyError(error))
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, profileError, retryProfile: () => setReloadKey((k) => k + 1), register, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
