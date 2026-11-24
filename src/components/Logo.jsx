// Logo do LinguaGo: mesmo desenho de public/logo-linguago.svg, embutido na página para
// usar a fonte Fraunces do site (um SVG em <img> não carrega fontes da página) e para
// a palavra "Lingua" seguir a cor do tema (no original ela é clara e sumiria no tema claro).
// O sorriso foi posicionado medindo o "Go" em Fraunces 500 itálico.
const BUBBLE = 'M69 77 h52 a14 14 0 0 1 14 14 v28 a14 14 0 0 1 -14 14 h-30 l-14 14 v-14 h-8 a14 14 0 0 1 -14 -14 v-28 a14 14 0 0 1 14 -14z'

function Mark() {
  return (
    <g className="logo-mark" transform="rotate(-6 95 110)">
      <path d={BUBBLE} fill="#f2b73a" transform="translate(5 5)" />
      <path d={BUBBLE} fill="#7fc8a0" />
      <text x="95" y="114" textAnchor="middle" fontStyle="italic" fontSize="26" fontWeight="500" fill="#18201c">Go</text>
    </g>
  )
}

// Uma única versão do logo, usada em todas as telas (landing, login e menu do app)
export default function Logo({ className = '' }) {
  return (
    <svg className={`logo ${className}`} viewBox="45 62 305 100" role="img" aria-label="LinguaGo">
      <Mark />
      <text className="logo-word" x="160" y="122" fontSize="40" fontWeight="500">
        Lingua<tspan fontStyle="italic" fill="#e85d3f">Go</tspan><tspan fill="#f2b73a">!</tspan>
      </text>
      <path d="M288.5 135 q23 13 46 0" fill="none" stroke="#f2b73a" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}
