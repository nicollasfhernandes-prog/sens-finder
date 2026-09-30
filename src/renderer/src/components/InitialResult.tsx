import { eDPI, gameCm360, GAMES, roundSens } from '../lib/sensitivity'
import { QuestionnaireAnswers } from '../types'
import MousepadRuler from './MousepadRuler'

interface Props {
  answers: QuestionnaireAnswers
  sens: number
  onStartAimTest: () => void
  onSkipToFinal: () => void
}

export default function InitialResult({ answers, sens, onStartAimTest, onSkipToFinal }: Props): JSX.Element {
  const game = GAMES[answers.targetGame]
  const cm = gameCm360(answers.dpi, sens, answers.targetGame)
  const rounded = roundSens(sens, answers.targetGame)

  return (
    <section className="page">
      <header className="page-head">
        <h1 className="display">Sens inicial</h1>
        <p className="lede">
          {answers.hasKnownSens
            ? `Convertida de ${GAMES[answers.sourceGame].label} (${answers.sourceSens}), com a mesma distância por volta.`
            : 'Calculada pelo seu estilo de mira. Os testes vão ajustar esse valor.'}
        </p>
      </header>

      <div className="readout">
        <div className="readout-main">
          <span className="readout-caption">Sensibilidade no {game.label}</span>
          <span className="readout-value num">{rounded}</span>
          <span className="readout-sub">
            eDPI {Math.round(eDPI(answers.dpi, rounded))}, a {answers.dpi} DPI
          </span>
        </div>
        <div className="readout-ruler">
          <span className="readout-caption">Quanto de mousepad pra uma volta de 360°</span>
          <MousepadRuler spans={[{ cm, label: 'por volta', emphasis: true }]} />
        </div>
      </div>

      <div className="button-row">
        <button className="btn btn-primary" onClick={onStartAimTest}>
          Fazer os testes
        </button>
        <button className="btn btn-ghost" onClick={onSkipToFinal}>
          Usar esse valor
        </button>
      </div>
    </section>
  )
}
