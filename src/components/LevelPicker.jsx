import { LEVEL_CHOICES } from '../data/levels.js'

// Escolha do nível declarado (cadastro por e-mail e primeira entrada pelo Google)
export default function LevelPicker({ value, onChange, legend = 'Quanto inglês você já sabe?' }) {
  return (
    <fieldset className="level-pick">
      <legend>{legend}</legend>
      <div className="level-grid">
        {LEVEL_CHOICES.map((c) => (
          <label key={c.id} className={`level-opt ${value === c.id ? 'on' : ''}`}>
            <input type="radio" name="level" value={c.id} checked={value === c.id} onChange={() => onChange(c.id)} required />
            <span className="level-top">
              <strong>{c.label}</strong>
              <span className="level-tag">{c.range}</span>
            </span>
            <small>{c.hint}</small>
          </label>
        ))}
      </div>
      {value && value !== 'none' && (
        <small className="muted level-note">Depois, um teste opcional de 10 perguntas libera as unidades do seu nível.</small>
      )}
    </fieldset>
  )
}
