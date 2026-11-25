import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { createNonce, GOOGLE_CLIENT_ID, loadGoogleIdentity } from '../lib/googleIdentity.js'

const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)')
const MAX_WIDTH = 400 // limite do botão do Google
const MIN_WIDTH = 200

// Botão oficial do Google (Google Identity Services). A janela do Google mostra o domínio
// do site; o token volta para cá e é validado pelo Supabase com o nonce.
export default function GoogleButton({ mode = 'login', onError }) {
  const { loginWithGoogleToken } = useAuth()
  const box = useRef(null)
  const [status, setStatus] = useState(GOOGLE_CLIENT_ID ? 'loading' : 'unavailable') // loading | ready | busy | unavailable
  const [message, setMessage] = useState(
    GOOGLE_CLIENT_ID ? '' : 'O login com Google não está disponível no momento. Use e-mail e senha.',
  )
  // guarda a função mais recente sem reinicializar o botão a cada renderização
  const onErrorRef = useRef(onError)
  useEffect(() => { onErrorRef.current = onError })

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let alive = true
    let cleanup = () => {} // observadores de largura e tema, criados depois que o botão aparece
    Promise.all([loadGoogleIdentity(), createNonce()])
      .then(([gid, nonce]) => {
        if (!alive || !box.current) return
        gid.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: nonce.hashed,
          context: mode === 'register' ? 'signup' : 'signin',
          callback: async ({ credential }) => {
            if (!alive) return
            setStatus('busy')
            onErrorRef.current?.('')
            try {
              await loginWithGoogleToken(credential, nonce.raw)
              // com a sessão criada, a tela de login redireciona sozinha
            } catch (err) {
              if (!alive) return
              setStatus('ready')
              onErrorRef.current?.(err.message)
            }
          },
        })
        // mesma largura dos campos do formulário, dentro do limite do Google
        let drawn = ''
        const render = () => {
          if (!alive || !box.current) return
          const width = Math.round(Math.max(MIN_WIDTH, Math.min(box.current.clientWidth || MAX_WIDTH, MAX_WIDTH)))
          const theme = darkQuery()?.matches ? 'filled_black' : 'outline'
          if (drawn === `${width}-${theme}`) return
          drawn = `${width}-${theme}`
          gid.renderButton(box.current, {
            type: 'standard',
            theme,
            size: 'large',
            shape: 'pill',
            text: mode === 'register' ? 'signup_with' : 'signin_with',
            logo_alignment: 'center',
            locale: 'pt-BR',
            width,
          })
        }
        render()
        setStatus('ready')

        // redesenha se a largura da tela ou o tema do sistema mudarem
        let timer
        const later = () => { clearTimeout(timer); timer = setTimeout(render, 150) }
        const ro = new ResizeObserver(later)
        ro.observe(box.current)
        const mq = darkQuery()
        mq?.addEventListener('change', render)
        cleanup = () => { clearTimeout(timer); ro.disconnect(); mq?.removeEventListener('change', render) }
      })
      .catch((err) => {
        if (!alive) return
        setStatus('unavailable')
        setMessage(err.message)
      })
    return () => {
      alive = false
      cleanup()
      window.google?.accounts?.id?.cancel()
    }
  }, [mode, loginWithGoogleToken])

  return (
    <div className={`google-gis rise ${status}`} style={{ '--d': '240ms' }}>
      <div ref={box} className="google-gis-slot" aria-busy={status === 'loading' || status === 'busy'} />
      {status === 'loading' && <span className="google-gis-wait" aria-hidden="true">Carregando o Google…</span>}
      {status === 'busy' && <p className="auth-notice" role="status">Entrando com o Google…</p>}
      {status === 'unavailable' && <p className="auth-notice" role="alert">{message}</p>}
    </div>
  )
}
