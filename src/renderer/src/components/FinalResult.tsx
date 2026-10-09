import { useState } from 'react'
import { REFERENCE_TARGET_ANGULAR_RADIUS_DEG } from '../scenarios/sensFinder'
import { eDPI, gameCm360, GAMES, roundSens, suggestAdjustment } from '../lib/sensitivity'
import { AimTestResult, QuestionnaireAnswers } from '../types'
import { FlickBalance, Recommendation, recommendedSens } from './Analysis'
import MousepadRuler from './MousepadRuler'
import MotorPanel from './MotorPanel'
import { summarizeMotor } from '../engine/motor'

interface Props {
  answers: QuestionnaireAnswers
  baseSens: number
  aimResult: AimTestResult | null
  onRetest: (newSens: number) => void
  onRestart: () => void
  onUseInTraining: (sens: number) => void
}

export default function FinalResult({
  answers,
  baseSens,
  aimResult,
  onRetest,
  onRestart,
  onUseInTraining
}: Props): JSX.Element {
  const [copied, setCopied] = useState(false)

  const gameId = answers.targetGame
  const game = GAMES[gameId]
  const adjustment = aimResult ? suggestAdjustment(aimResult, REFERENCE_TARGET_ANGULAR_RADIUS_DEG) : null
  const finalSens = adjustment ? recommendedSens(baseSens, adjustment, gameId, answers.dpi) : roundSens(baseSens, gameId)
  const changed = finalSens !== roundSens(baseSens, gameId)
  const b = adjustment?.breakdown
  // Junta os flicks do Flick e do Gridshot (mesma sens) numa análise só.
  const motor = aimResult
    ? summarizeMotor(
        [...(aimResult.flick.motor?.flicks ?? []), ...(aimResult.gridshot.motor?.flicks ?? [])],
        aimResult.flick.motor?.cmPerDeg ?? aimResult.gridshot.motor?.cmPerDeg ?? 0
      )
    : null

  function copyValue(): void {
    navigator.clipboard.writeText(String(finalSens))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="page page-mid">
      <header className="page-head">
        <h1 className="display">Sua sensibilidade</h1>
      </header>

      <div className="readout">
        <div className="readout-main">
          <span className="readout-caption">Sensibilidade no {game.label}</span>
          <span className="readout-value num">{finalSens}</span>
          <span className="readout-sub">
            eDPI {Math.round(eDPI(answers.dpi, finalSens))}, a {answers.dpi} DPI
          </span>
        </div>
        {!adjustment && (
          <div className="readout-ruler">
            <span className="readout-caption">Quanto de mousepad pra uma volta de 360°</span>
            <MousepadRuler spans={[{ cm: gameCm360(answers.dpi, finalSens, gameId), label: 'por volta', emphasis: true }]} />
          </div>
        )}
      </div>

      {adjustment && b && aimResult && (
        <div className="result-grid">
          <section className="panel">
            <h2 className="panel-title">Como você mirou</h2>
            <FlickBalance b={b} />
            <dl className="kv">
              <div>
                <dt>Acertos em Flick e Gridshot</dt>
                <dd className="num">
                  {aimResult.flick.kills + aimResult.gridshot.kills} de{' '}
                  {aimResult.flick.shots + aimResult.gridshot.shots} tiros
                </dd>
              </div>
              {b.trackingCoverage !== null && (
                <div>
                  <dt>Tempo com a mira no alvo em movimento</dt>
                  <dd className="num">{Math.round(b.trackingCoverage * 100)}%</dd>
                </div>
              )}
            </dl>
          </section>

          <Recommendation currentSens={baseSens} game={gameId} dpi={answers.dpi} adjustment={adjustment}>
            {changed && (
              <button className="btn btn-ghost" onClick={() => onRetest(finalSens)}>
                Refazer os testes com {finalSens}
              </button>
            )}
          </Recommendation>
        </div>
      )}

      {motor && <MotorPanel motor={motor} title="Movimento e memória muscular nos flicks" />}

      <p className="fine">
        No {game.label}: {game.where}
      </p>

      <div className="button-row">
        <button className="btn btn-primary" onClick={copyValue}>
          {copied ? 'Copiado' : 'Copiar sensibilidade'}
        </button>
        <button className="btn btn-ghost" onClick={() => onUseInTraining(finalSens)}>
          Usar nos treinos
        </button>
        <button className="btn btn-ghost" onClick={onRestart}>
          Recomeçar
        </button>
      </div>
    </section>
  )
}
