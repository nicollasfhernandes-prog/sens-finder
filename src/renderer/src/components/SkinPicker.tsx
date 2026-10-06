import { useState } from 'react'
import { listSkins } from '../lib/skinViewmodels'
import { activeSkin, Weapon } from '../lib/weapons'
import { useSettings } from '../settings'

const DEFAULT = 'padrao'

/** Grade de skins da arma, só as que aparecem na mão no treino. */
export default function SkinPicker({ weapon }: { weapon: Weapon }): JSX.Element | null {
  const { settings, update } = useSettings()
  const [query, setQuery] = useState('')
  const skins = listSkins(weapon.id)
  if (skins.length === 0) return null

  const active = activeSkin(weapon, settings.skinByWeapon)
  const selected = active?.uuid ?? DEFAULT
  const options = [
    ...(weapon.firstPerson ? [{ uuid: DEFAULT, name: 'Padrão', image: weapon.firstPerson.image }] : []),
    ...skins
  ]
  const q = query.trim().toLowerCase()
  const shown = options.filter((s) => !q || s.name.toLowerCase().includes(q))

  function choose(uuid: string, name: string): void {
    const next = { ...settings.skinByWeapon }
    if (uuid === DEFAULT) delete next[weapon.id]
    else next[weapon.id] = { uuid, name }
    update({ skinByWeapon: next })
  }

  return (
    <div className="skin-picker">
      <div className="skin-head">
        <span className="label">
          Skin da {weapon.label} <span className="skin-count">{options.length}</span>
        </span>
        <input
          className="input skin-search"
          type="search"
          placeholder="Buscar skin"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="skin-grid" role="radiogroup" aria-label={`Skin da ${weapon.label}`}>
        {shown.map((s) => (
          <button
            type="button"
            role="radio"
            aria-checked={s.uuid === selected}
            key={s.uuid}
            className={`skin-card${s.uuid === selected ? ' is-active' : ''}`}
            onClick={() => choose(s.uuid, s.name)}
            title={s.name}
          >
            <img src={s.image} alt="" loading="lazy" draggable={false} />
            <span className="skin-name">{s.name.replace(new RegExp(`\\s*${weapon.label}\\s*$`, 'i'), '')}</span>
          </button>
        ))}
        {shown.length === 0 && <p className="field-note">Nenhuma skin com "{query}".</p>}
      </div>
      <p className="fine">Todas aparecem na mão no treino, do jeito que ficam no jogo.</p>
    </div>
  )
}
