export interface RulerSpan {
  cm: number
  label: string
  emphasis?: boolean
}

interface Props {
  spans: RulerSpan[]
  padCm?: number
}

const W = 760
const PAD_X = 10
// Faixa reservada à direita pros rótulos ficarem sempre fora das barras.
const LABEL_W = 190
const ROW_H = 38
const BAR_H = 18
const TOP = 24

function fmt(cm: number): string {
  return cm.toFixed(1).replace('.', ',')
}

/** Distância física de uma volta de 360° desenhada sobre um mousepad, em escala. */
export default function MousepadRuler({ spans, padCm = 45 }: Props): JSX.Element {
  const longest = Math.max(padCm, ...spans.map((s) => s.cm))
  const scaleMax = Math.ceil((longest + 3) / 5) * 5
  const x = (cm: number): number => PAD_X + (cm / scaleMax) * (W - PAD_X - LABEL_W)

  const padBottom = TOP + spans.length * ROW_H + 10
  const rulerY = padBottom + 8
  const H = rulerY + 40

  const ticks: number[] = []
  for (let cm = 0; cm <= scaleMax; cm++) ticks.push(cm)

  return (
    <svg
      className="ruler"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={spans.map((s) => `${fmt(s.cm)} centímetros ${s.label}`).join(', ')}
    >
      <rect className="ruler-pad" x={x(0)} y={TOP} width={x(padCm) - x(0)} height={padBottom - TOP} />

      {spans.map((s, i) => {
        const y = TOP + 10 + i * ROW_H
        const end = x(s.cm)
        return (
          <g key={s.label} className={s.emphasis ? 'is-emphasis' : undefined}>
            <rect className="ruler-span" x={x(0)} y={y} width={end - x(0)} height={BAR_H} />
            <line className="ruler-cap" x1={end} x2={end} y1={y - 4} y2={y + BAR_H + 4} />
            <text className="ruler-span-label" x={end + 10} y={y + BAR_H - 2}>
              <tspan className="ruler-cm">{fmt(s.cm)} cm</tspan> {s.label}
            </text>
          </g>
        )
      })}

      <line className="ruler-axis" x1={x(0)} x2={x(scaleMax)} y1={rulerY} y2={rulerY} />
      {ticks.map((cm) => {
        const major = cm % 5 === 0
        return (
          <g key={cm}>
            <line className="ruler-tick" x1={x(cm)} x2={x(cm)} y1={rulerY} y2={rulerY + (major ? 9 : 4)} />
            {major && (
              <text className="ruler-num" x={x(cm)} y={rulerY + 26} textAnchor="middle">
                {cm}
              </text>
            )}
          </g>
        )
      })}
      <text className="ruler-num ruler-pad-label" x={x(padCm)} y={TOP - 8} textAnchor="end">
        mousepad de {padCm} cm
      </text>
    </svg>
  )
}
