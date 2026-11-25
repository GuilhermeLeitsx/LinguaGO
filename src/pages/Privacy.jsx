import { Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'

const CONTACT_EMAIL = 'linguagoo.app@gmail.com'
const UPDATED = '24 de novembro de 2026'

// Página pública (abre com ou sem login)
export default function Privacy() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  return (
    <div className="legal">
      <header className="legal-top">
        <Link to="/" className="brand" aria-label="LinguaGo, voltar ao início"><Logo /></Link>
      </header>

      <article className="legal-doc card">
        <p className="eyebrow">Atualizada em {UPDATED}</p>
        <h1>Política de <em className="hl">Privacidade</em></h1>
        <p className="legal-lead">
          O LinguaGo é um app para aprender inglês em lições curtas. Esta página explica, sem juridiquês,
          quais dados o app guarda, para que eles servem e como apagar a sua conta.
        </p>

        <h2>Quais dados guardamos</h2>
        <ul>
          <li><strong>Conta:</strong> seu nome e seu e-mail. Se você cria a conta com e-mail e senha, a senha é guardada de forma criptografada e ninguém consegue lê-la, nem nós.</li>
          <li><strong>Login com Google:</strong> o Google nos envia seu nome, e-mail e foto de perfil, conforme a permissão que você dá. O app usa só o nome e o e-mail.</li>
          <li><strong>Nível:</strong> o nível de inglês que você escolhe e o resultado do teste de nivelamento, se você fizer.</li>
          <li><strong>Progresso:</strong> as lições concluídas, os acertos, o XP e os dias em que você estudou (para a sequência).</li>
          <li><strong>Fuso horário</strong> do seu aparelho, para contar o dia de estudo certo.</li>
        </ul>

        <h2>Para que servem</h2>
        <p>
          Só para o app funcionar: entrar na sua conta, mostrar seu nome, salvar o progresso, liberar as
          unidades do seu nível e contar a sequência de dias. Não usamos seus dados para anúncios e não
          temos ferramentas de rastreamento ou de análise de comportamento.
        </p>

        <h2>Não vendemos nem compartilhamos</h2>
        <p>
          Seus dados não são vendidos, alugados nem compartilhados com ninguém. Eles só passam pelos
          serviços que fazem o app funcionar, listados abaixo.
        </p>

        <h2>Onde ficam</h2>
        <ul>
          <li><strong>Supabase:</strong> guarda a conta e o progresso. Cada pessoa só consegue acessar os próprios dados.</li>
          <li><strong>Vercel:</strong> hospeda o site. Como todo servidor, ela e o Supabase podem registrar dados técnicos de acesso, como o endereço IP, por segurança.</li>
          <li><strong>Seu navegador:</strong> guarda a sessão de login, para você não precisar entrar toda vez. Se você usou o LinguaGo antes de existir a conta, o progresso antigo também pode estar salvo só no seu aparelho.</li>
        </ul>
        <p>Os dados ficam guardados enquanto a sua conta existir.</p>

        <h2>Como apagar a sua conta</h2>
        <p>
          Mande um e-mail para {mail} a partir do e-mail da sua conta, pedindo a exclusão. Apagamos a conta
          e todo o progresso ligado a ela. Isso não pode ser desfeito.
        </p>

        <h2>Dúvidas</h2>
        <p>Qualquer pergunta sobre seus dados: {mail}.</p>

        <p className="legal-back"><Link to="/" className="text-link">← Voltar ao LinguaGo</Link></p>
      </article>
    </div>
  )
}
