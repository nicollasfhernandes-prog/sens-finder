import { ScenarioDef, ScenarioResult } from '../engine/types'
import { recommendAdjustment, roundSens } from '../lib/sensitivity'
import { REFERENCE_TARGET_ANGULAR_RADIUS_DEG } from '../scenarios/sensFinder'
import { useSettings } from '../settings'
import { FlickBalance, Recommendation, recommendedSens } from './Analysis'
import MotorPanel from './MotorPanel'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  def: ScenarioDef<any>
  result: ScenarioResult
  sens: number
  previousBest: number | null
  onPlayAgain: () => void
  onPlayWithSens: (sens: number) => void
  onBack: () => void
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

function fmt(n: number): string {
  return n.toLocaleString('pt-BR')
}

export default function ScenarioResultView({
  def,
  result: r,
  sens,
  previousBest,
  onPlayAgain,
  onPlayWithSens,
  onBack
}: Props): JSX.Element {
  const { settings } = useSettings()
  const adjustment = recommendAdjustment([r], REFERENCE_TARGET_ANGULAR_RADIUS_DEG)
  const recommended = recommendedSens(sens, adjustment, settings.game)
  const changed = recommended !== roundSens(sens, settings.game)
  const isRecord = previousBest !== null && r.score > previousBest

  const bestLine = isRecord
    ? `Novo recorde. O anterior era ${fmt(previousBest)}.`
    : previousBest === null
      ? 'Primeira partida neste cenário.'
      : `Seu recorde é ${fmt(previousBest)}.`

  return (
    <section className="page page-mid">
      <header className="page-head">
        <h1 className="display">{def.name}</h1>
      </header>

      <div className="scoreboard">
        <div className="scoreboard-main">
          <span className="score-value num">{fmt(r.score)}</span>
          <span className={`score-note${isRecord ? ' is-record' : ''}`}>{bestLine}</span>
        </div>
        <dl className="scoreboard-stats">
          <div>
            <dt>{r.tracking ? 'Precisão no tracking' : 'Precisão'}</dt>
            <dd className="num">{pct(r.accuracy)}</dd>
          </div>
          <div>
            <dt>Alvos destruídos</dt>
            <dd className="num">{r.kills}</dd>
          </div>
          <div>
            <dt>Tempo por alvo</dt>
            <dd className="num">{Math.round(r.avgTtkMs)} ms</dd>
          </div>
          <div>
            <dt>{r.tracking ? 'Mira no alvo' : 'Tiros'}</dt>
            <dd className="num">{r.tracking ? pct(r.tracking.coverage) : r.shots}</dd>
          </div>
        </dl>
      </div>

      <div className="result-grid">
        <section className="panel">
          <h2 className="panel-title">Como você mirou</h2>
          {r.flicksAnalyzed > 0 && <FlickBalance b={adjustment.breakdown} />}
          {r.tracking && (
            <dl className="kv">
              <div>
                <dt>Tempo com a mira no alvo</dt>
                <dd className="num">{pct(r.tracking.coverage)}</dd>
              </div>
              <div>
                <dt>Distância média do centro</dt>
                <dd className="num">{r.tracking.avgErrorDeg.toFixed(1).replace('.', ',')}°</dd>
              </div>
              <div>
                <dt>Trocas de lado por segundo</dt>
                <dd className="num">{r.tracking.crossingsPerSec.toFixed(1).replace('.', ',')}</dd>
              </div>
            </dl>
          )}
        </section>

        <Recommendation
          currentSens={sens}
          game={settings.game}
          dpi={settings.dpi}
          adjustment={adjustment}
          note="Uma partida é pouca amostra. Confirme em duas ou três antes de mudar no jogo."
        >
          {changed && (
            <button className="btn btn-ghost" onClick={() => onPlayWithSens(recommended)}>
              Jogar com {recommended}
            </button>
          )}
        </Recommendation>
      </div>

      {r.motor ? (
        <MotorPanel motor={r.motor} />
      ) : (
        r.tracking === null && (
          <p className="fine">
            A análise de movimento precisa de pelo menos 5 flicks concluídos nesta partida.
          </p>
        )
      )}

      <div className="button-row">
        <button className="btn btn-primary" onClick={onPlayAgain}>
          Jogar de novo
        </button>
        <button className="btn btn-ghost" onClick={onBack}>
          Voltar aos treinos
        </button>
      </div>
    </section>
  )
}
