import { ReactNode } from 'react'
import { AdjustmentBreakdown, AdjustmentSuggestion, CM360_FASTEST, CM360_SLOWEST, gameCm360, GameId, guardMultiplier, roundSens } from '../lib/sensitivity'
import MousepadRuler, { RulerSpan } from './MousepadRuler'

function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

function deg(v: number): string {
  return `${v.toFixed(1).replace('.', ',')}°`
}

/** Barra divergente: underflick cresce pra esquerda, overflick pra direita, a partir do centro. */
export function FlickBalance({ b }: { b: AdjustmentBreakdown }): JSX.Element {
  return (
    <figure className="balance">
      <div className="balance-head">
        <span className="balance-side is-under">
          <span className="balance-pct num">{pct(b.underflickRate)}</span>
          <span>ficou curto</span>
          {b.underflickRate > 0 && <span className="balance-deg">{deg(b.avgUnderflickDeg)} antes da borda</span>}
        </span>
        <span className="balance-side is-over">
          <span className="balance-pct num">{pct(b.overflickRate)}</span>
          <span>passou do alvo</span>
          {b.overflickRate > 0 && <span className="balance-deg">{deg(b.avgOverflickDeg)} além da borda</span>}
        </span>
      </div>
      <div
        className="balance-track"
        role="img"
        aria-label={`Ficou curto em ${pct(b.underflickRate)} dos flicks e passou do alvo em ${pct(b.overflickRate)}`}
      >
        <div className="balance-half balance-left">
          <div className="balance-fill balance-under" style={{ width: pct(b.underflickRate) }} />
        </div>
        <div className="balance-axis" />
        <div className="balance-half balance-right">
          <div className="balance-fill balance-over" style={{ width: pct(b.overflickRate) }} />
        </div>
      </div>
      <figcaption className="fine">De {b.flicksAnalyzed} flicks analisados.</figcaption>
    </figure>
  )
}

/** Enquanto a bateria de partidas com a mesma sens não fecha, mostra o progresso no lugar da recomendação. */
interface BatteryProgressProps {
  sessions: number
  needed: number
  flicks: number
  neededFlicks: number
  sens: number
}

export function BatteryProgress({ sessions, needed, flicks, neededFlicks, sens }: BatteryProgressProps): JSX.Element {
  const left = Math.max(0, needed - sessions)
  return (
    <section className="panel recommendation">
      <h2 className="panel-title">Sensibilidade recomendada</h2>
      <p className="battery-count">
        <span className="num">{Math.min(sessions, needed)}</span> de {needed} partidas com <span className="num">{sens}</span>
      </p>
      <div className="battery-steps" aria-hidden="true">
        {Array.from({ length: needed }, (_, i) => (
          <span key={i} className={i < sessions ? 'is-done' : undefined} />
        ))}
      </div>
      <p className="battery-text">
        {left > 0
          ? `Jogue mais ${left} ${left === 1 ? 'partida' : 'partidas'} de qualquer treino com essa sens. A recomendação junta várias partidas porque uma só varia demais pra decidir.`
          : `As partidas tiveram poucos flicks pra concluir: ${flicks} de ${neededFlicks}. Jogue mais um treino de flick com essa sens.`}
      </p>
    </section>
  )
}

interface RecommendationProps {
  currentSens: number
  game: GameId
  dpi: number
  adjustment: AdjustmentSuggestion
  note?: string
  children?: ReactNode
}

/** Sens recomendada, dentro da faixa plausível de cm por volta e arredondada pro que o jogo aceita. */
export function recommendedSens(currentSens: number, adjustment: AdjustmentSuggestion, game: GameId, dpi: number): number {
  const { multiplier } = guardMultiplier(currentSens, adjustment.multiplier, game, dpi)
  return roundSens(currentSens * multiplier, game)
}

export function Recommendation({ currentSens, game, dpi, adjustment, note, children }: RecommendationProps): JSX.Element {
  const current = roundSens(currentSens, game)
  const recommended = recommendedSens(currentSens, adjustment, game, dpi)
  const { limited } = guardMultiplier(currentSens, adjustment.multiplier, game, dpi)
  const cmNow = gameCm360(dpi, current, game).toFixed(0)
  // Compara os valores arredondados: no R6, por exemplo, um ajuste de 3% pode não mudar o inteiro.
  const delta = Math.round((recommended / current - 1) * 100)
  const direction = recommended > current ? 'up' : recommended < current ? 'down' : 'hold'

  const spans: RulerSpan[] =
    direction === 'hold'
      ? [{ cm: gameCm360(dpi, current, game), label: 'por volta', emphasis: true }]
      : [
          { cm: gameCm360(dpi, current, game), label: `com ${current}` },
          { cm: gameCm360(dpi, recommended, game), label: `com ${recommended}`, emphasis: true }
        ]

  return (
    <section className={`panel recommendation rec-${direction}`}>
      <h2 className="panel-title">Sensibilidade recomendada</h2>
      <div className="rec-compare">
        {direction !== 'hold' && <span className="rec-old num">{current}</span>}
        {direction !== 'hold' && (
          <svg className="rec-arrow" width="28" height="14" viewBox="0 0 28 14" aria-hidden="true">
            <path d="M0 7 H24 M18 1 L26 7 L18 13" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        )}
        <span className="rec-new num">{recommended}</span>
        <span className="rec-delta">
          {direction === 'hold' ? 'manter' : direction === 'up' ? `subir ${delta}%` : `descer ${-delta}%`}
        </span>
      </div>

      <MousepadRuler spans={spans} />

      <ul className="rec-reasons">
        {adjustment.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
        {limited === 'slow' && (
          <li>
            Sua sens já está bem lenta ({cmNow} cm por volta). Abaixo de {CM360_SLOWEST} cm quase ninguém joga,
            então a recomendação não desce mais que isso.
          </li>
        )}
        {limited === 'fast' && (
          <li>
            Sua sens já está bem rápida ({cmNow} cm por volta). Acima disso quase ninguém joga, então a
            recomendação não sobe mais que {CM360_FASTEST} cm por volta.
          </li>
        )}
      </ul>
      {note && <p className="fine">{note}</p>}
      {children && <div className="button-row">{children}</div>}
    </section>
  )
}
