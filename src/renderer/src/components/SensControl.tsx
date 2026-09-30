import { GAME_IDS, GAMES, GameId, roundSens } from '../lib/sensitivity'

interface Props {
  game: GameId
  value: number
  onChange: (value: number) => void
  onGameChange: (game: GameId) => void
}

export default function SensControl({ game, value, onChange, onGameChange }: Props): JSX.Element {
  const { step } = GAMES[game]
  const nudge = (d: number): void => onChange(roundSens(value + d, game))

  return (
    <div className="sens-control">
      <label className="field">
        <span className="label">Jogo</span>
        <select className="input" value={game} onChange={(e) => onGameChange(e.target.value as GameId)}>
          {GAME_IDS.map((id) => (
            <option key={id} value={id}>
              {GAMES[id].label}
            </option>
          ))}
        </select>
      </label>
      <div className="field">
        <span className="label">Sensibilidade</span>
        <div className="stepper">
          <button type="button" onClick={() => nudge(-step)} aria-label="Diminuir sensibilidade">
            −
          </button>
          <input
            type="number"
            step="any"
            min={0}
            value={value}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (v > 0) onChange(v)
            }}
          />
          <button type="button" onClick={() => nudge(step)} aria-label="Aumentar sensibilidade">
            +
          </button>
        </div>
      </div>
    </div>
  )
}
