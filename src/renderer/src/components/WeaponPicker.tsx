import { GAMES } from '../lib/sensitivity'
import { selectedWeapon, weaponsForGame } from '../lib/weapons'
import { useSettings } from '../settings'
import SkinPicker from './SkinPicker'

/** Escolha da arma que aparece na mão durante os treinos do jogo atual. */
export default function WeaponPicker(): JSX.Element {
  const { settings, update } = useSettings()
  const game = settings.game
  const options = weaponsForGame(game)
  const current = selectedWeapon(game, settings.weaponByGame)

  if (options.length === 0) {
    return (
      <p className="field-note">
        Ainda não tem armas do {GAMES[game].label}. Os treinos aparecem só com a mira.
      </p>
    )
  }

  const choose = (id: string): void => update({ weaponByGame: { ...settings.weaponByGame, [game]: id } })

  return (
    <>
      <div className="weapon-grid" role="radiogroup" aria-label="Arma">
        {options.map((w) => (
          <button
            type="button"
            role="radio"
            aria-checked={current?.id === w.id}
            key={w.id}
            className={`weapon-card${current?.id === w.id ? ' is-active' : ''}`}
            onClick={() => choose(w.id)}
          >
            <span className="weapon-art">
              <img src={w.image} alt="" draggable={false} />
            </span>
            <span className="weapon-name">{w.label}</span>
            <span className="weapon-note">{w.note}</span>
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={current === null}
          className={`weapon-card weapon-none${current === null ? ' is-active' : ''}`}
          onClick={() => choose('none')}
        >
          <span className="weapon-art" />
          <span className="weapon-name">Sem arma</span>
          <span className="weapon-note">Tela limpa, só a mira</span>
        </button>
      </div>
      <p className="fine">Aparece na mão no treino e muda o som do disparo. Não tem recuo: a mira continua igual.</p>
      {current && <SkinPicker key={current.id} weapon={current} />}
    </>
  )
}
