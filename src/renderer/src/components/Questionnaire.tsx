import { FormEvent, useState } from 'react'
import { GAME_IDS, GAMES, GameId, PlayStyle } from '../lib/sensitivity'
import { QuestionnaireAnswers } from '../types'

interface Props {
  initialGame: GameId
  onSubmit: (answers: QuestionnaireAnswers) => void
  onBack: () => void
}

const STYLES: { id: PlayStyle; title: string; body: string }[] = [
  { id: 'tracking', title: 'Braço', body: 'Sens baixa, giros amplos com o braço.' },
  { id: 'balanced', title: 'Híbrido', body: 'Braço pra girar, pulso pra ajustar.' },
  { id: 'flick', title: 'Pulso', body: 'Sens alta, flicks curtos de pulso.' }
]

function GameSelect({ value, onChange }: { value: GameId; onChange: (g: GameId) => void }): JSX.Element {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value as GameId)}>
      {GAME_IDS.map((id) => (
        <option key={id} value={id}>
          {GAMES[id].label}
        </option>
      ))}
    </select>
  )
}

export default function Questionnaire({ initialGame, onSubmit, onBack }: Props): JSX.Element {
  const [targetGame, setTargetGame] = useState<GameId>(initialGame)
  const [dpi, setDpi] = useState(800)
  const [hasKnownSens, setHasKnownSens] = useState(false)
  const [sourceGame, setSourceGame] = useState<GameId>(initialGame === 'cs2' ? 'valorant' : 'cs2')
  const [sourceSens, setSourceSens] = useState(1)
  const [playStyle, setPlayStyle] = useState<PlayStyle>('balanced')

  function handleSubmit(e: FormEvent): void {
    e.preventDefault()
    onSubmit({ targetGame, dpi, hasKnownSens, sourceGame, sourceSens, playStyle })
  }

  return (
    <form className="page" onSubmit={handleSubmit}>
      <header className="page-head">
        <h1 className="display">Seu setup</h1>
      </header>

      <div className="panel form-panel">
        <div className="field-row">
          <label className="field">
            <span className="label">Jogo que você quer calibrar</span>
            <GameSelect value={targetGame} onChange={setTargetGame} />
          </label>
          <label className="field">
            <span className="label">DPI do mouse</span>
            <input
              className="input num"
              type="number"
              min={100}
              max={26000}
              value={dpi}
              onChange={(e) => setDpi(Number(e.target.value))}
              required
            />
          </label>
        </div>

        <div className="field">
          <span className="label">Ponto de partida</span>
          <div className="segmented">
            <button type="button" className={!hasKnownSens ? 'is-active' : ''} onClick={() => setHasKnownSens(false)}>
              Pelo meu estilo
            </button>
            <button type="button" className={hasKnownSens ? 'is-active' : ''} onClick={() => setHasKnownSens(true)}>
              Pela sens que já uso
            </button>
          </div>
        </div>

        {hasKnownSens ? (
          <div className="field-row">
            <label className="field">
              <span className="label">Jogo onde você já tem sens</span>
              <GameSelect value={sourceGame} onChange={setSourceGame} />
            </label>
            <label className="field">
              <span className="label">Sensibilidade nesse jogo</span>
              <input
                className="input num"
                type="number"
                step="any"
                min={0.001}
                value={sourceSens}
                onChange={(e) => setSourceSens(Number(e.target.value))}
                required
              />
            </label>
          </div>
        ) : (
          <div className="field">
            <span className="label">Como você mira</span>
            <div className="choice-grid">
              {STYLES.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={`choice${playStyle === s.id ? ' is-active' : ''}`}
                  onClick={() => setPlayStyle(s.id)}
                >
                  <span className="choice-title">{s.title}</span>
                  <span className="choice-body">{s.body}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="button-row">
        <button type="submit" className="btn btn-primary">
          Calcular sens inicial
        </button>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Voltar
        </button>
      </div>
    </form>
  )
}
