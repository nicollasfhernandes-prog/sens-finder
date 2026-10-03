import { useState } from 'react'
import { FlickMotion, linearFit, MotorStats, NEUTRAL_GAIN } from '../engine/motor'

function fmt(n: number, digits = 0): string {
  return n.toFixed(digits).replace('.', ',')
}

function niceStep(max: number, targetTicks: number): number {
  const raw = max / targetTicks
  const pow = 10 ** Math.floor(Math.log10(raw))
  const n = raw / pow
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow
}

/** Marcações do eixo de 0 até a primeira marcação redonda que cobre o máximo. */
function ticks(max: number, count = 4): { step: number; values: number[] } {
  const step = niceStep(max, count)
  const top = Math.ceil(max / step) * step
  const values: number[] = []
  for (let i = 0; i * step <= top + step * 0.001; i++) values.push(i * step)
  return { step, values }
}

function verdict(score: number): string {
  if (score >= 80) return 'Bem formada nessa sens'
  if (score >= 60) return 'Em formação'
  return 'Ainda não formada nessa sens'
}

interface Tip {
  x: number
  y: number
  lines: [string, string]
}

/** Tooltip HTML posicionado em % do gráfico; texto via React (nunca innerHTML). */
function Tooltip({ tip }: { tip: Tip | null }): JSX.Element | null {
  if (!tip) return null
  return (
    <div className="chart-tip" style={{ left: `${tip.x}%`, top: `${tip.y}%` }} role="status">
      <strong>{tip.lines[0]}</strong>
      <span>{tip.lines[1]}</span>
    </div>
  )
}

const W = 360
const H = 220
const PAD = { left: 44, right: 12, top: 12, bottom: 34 }

function SpeedDistanceChart({ flicks, cmPerDeg }: { flicks: FlickMotion[]; cmPerDeg: number }): JSX.Element {
  const [tip, setTip] = useState<Tip | null>(null)
  const pts = flicks.map((f) => ({ x: f.distanceDeg * cmPerDeg, y: f.peakSpeedDegS * cmPerDeg, f }))
  const xT = ticks(Math.max(...pts.map((p) => p.x)) * 1.05)
  const yT = ticks(Math.max(...pts.map((p) => p.y)) * 1.05)
  const xMax = xT.values[xT.values.length - 1]
  const yMax = yT.values[yT.values.length - 1]
  const sx = (v: number): number => PAD.left + (v / xMax) * (W - PAD.left - PAD.right)
  const sy = (v: number): number => H - PAD.bottom - (v / yMax) * (H - PAD.top - PAD.bottom)
  const fit = linearFit(
    pts.map((p) => p.x),
    pts.map((p) => p.y)
  )
  const x0 = Math.min(...pts.map((p) => p.x))
  const x1 = Math.max(...pts.map((p) => p.x))

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Velocidade de pico da mão em função da distância de cada flick">
        {yT.values.map((v) => (
          <g key={`y${v}`}>
            <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={sy(v)} y2={sy(v)} />
            <text className="chart-tick" x={PAD.left - 6} y={sy(v) + 4} textAnchor="end">
              {fmt(v)}
            </text>
          </g>
        ))}
        {xT.values.map((v) => (
          <text key={`x${v}`} className="chart-tick" x={sx(v)} y={H - PAD.bottom + 16} textAnchor="middle">
            {fmt(v)}
          </text>
        ))}
        <text className="chart-axis-label" x={(PAD.left + W - PAD.right) / 2} y={H - 2} textAnchor="middle">
          distância no mousepad (cm)
        </text>
        <text className="chart-axis-label" transform={`translate(11 ${(PAD.top + H - PAD.bottom) / 2}) rotate(-90)`} textAnchor="middle">
          velocidade de pico (cm/s)
        </text>
        <clipPath id="speed-plot-area">
          <rect x={PAD.left} y={PAD.top} width={W - PAD.left - PAD.right} height={H - PAD.top - PAD.bottom} />
        </clipPath>
        <line
          className="chart-fit"
          clipPath="url(#speed-plot-area)"
          x1={sx(x0)}
          y1={sy(fit.intercept + fit.slope * x0)}
          x2={sx(x1)}
          y2={sy(fit.intercept + fit.slope * x1)}
        />
        {pts.map((p, i) => (
          <g
            key={i}
            tabIndex={0}
            onPointerEnter={() =>
              setTip({
                x: (sx(p.x) / W) * 100,
                y: (sy(p.y) / H) * 100,
                lines: [`${fmt(p.y)} cm/s`, `${fmt(p.x, 1)} cm de distância, ganho ${fmt(p.f.gain * 100)}%`]
              })
            }
            onFocus={() =>
              setTip({
                x: (sx(p.x) / W) * 100,
                y: (sy(p.y) / H) * 100,
                lines: [`${fmt(p.y)} cm/s`, `${fmt(p.x, 1)} cm de distância, ganho ${fmt(p.f.gain * 100)}%`]
              })
            }
            onPointerLeave={() => setTip(null)}
            onBlur={() => setTip(null)}
          >
            <circle className="chart-hit" cx={sx(p.x)} cy={sy(p.y)} r={12} />
            <circle className="chart-dot" cx={sx(p.x)} cy={sy(p.y)} r={4} />
          </g>
        ))}
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}

const GAIN_MIN = 0.5
const GAIN_MAX = 1.5
const GAIN_TOL = 0.05

function GainStrip({ flicks }: { flicks: FlickMotion[] }): JSX.Element {
  const [tip, setTip] = useState<Tip | null>(null)
  const h = 96
  const sx = (g: number): number => PAD.left + ((Math.min(GAIN_MAX, Math.max(GAIN_MIN, g)) - GAIN_MIN) / (GAIN_MAX - GAIN_MIN)) * (W - PAD.left - PAD.right)
  const rowY = (i: number): number => 22 + ((i * 37) % 5) * 9

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${h}`} className="chart" role="img" aria-label="Ganho do impulso principal de cada flick, em relação a 100%">
        {/* Faixa normal de uma mão calibrada (~92%) e a linha do alvo (100%). */}
        <rect className="chart-band" x={sx(NEUTRAL_GAIN - GAIN_TOL)} y={12} width={sx(NEUTRAL_GAIN + GAIN_TOL) - sx(NEUTRAL_GAIN - GAIN_TOL)} height={52} />
        <text className="chart-axis-label" x={sx(NEUTRAL_GAIN)} y={8} textAnchor="middle">
          normal
        </text>
        <line className="chart-zero" x1={sx(1)} x2={sx(1)} y1={10} y2={66} />
        {[0.5, 0.75, 1, 1.25, 1.5].map((g) => (
          <text key={g} className="chart-tick" x={sx(g)} y={82} textAnchor="middle">
            {fmt(g * 100)}%
          </text>
        ))}
        <text className="chart-axis-label" x={PAD.left} y={h - 2}>
          parou antes
        </text>
        <text className="chart-axis-label" x={W - PAD.right} y={h - 2} textAnchor="end">
          passou do ponto
        </text>
        {flicks.map((f, i) => {
          const tone = f.gain < NEUTRAL_GAIN - GAIN_TOL ? 'is-under' : f.gain > NEUTRAL_GAIN + GAIN_TOL ? 'is-over' : ''
          const show = (): void =>
            setTip({
              x: (sx(f.gain) / W) * 100,
              y: (rowY(i) / h) * 100,
              lines: [`${fmt(f.gain * 100)}% da distância`, `impulso principal do flick ${i + 1}`]
            })
          return (
            <g key={i} tabIndex={0} onPointerEnter={show} onFocus={show} onPointerLeave={() => setTip(null)} onBlur={() => setTip(null)}>
              <circle className="chart-hit" cx={sx(f.gain)} cy={rowY(i)} r={10} />
              <circle className={`chart-dot ${tone}`} cx={sx(f.gain)} cy={rowY(i)} r={4} />
            </g>
          )
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}

function Meter({ label, value, hint }: { label: string; value: number | null; hint: string }): JSX.Element {
  return (
    <div className="meter-row">
      <div className="meter-head">
        <span>{label}</span>
        <span className="num">{value === null ? 'sem dado' : Math.round(value * 100)}</span>
      </div>
      <div className="meter-track" aria-hidden="true">
        {value !== null && <div className="meter-fill" style={{ width: `${Math.round(value * 100)}%` }} />}
      </div>
      <p className="meter-hint">{hint}</p>
    </div>
  )
}

export default function MotorPanel({ motor, title = 'Movimento e memória muscular' }: { motor: MotorStats; title?: string }): JSX.Element {
  const c = motor.components
  const speedCm = (f: FlickMotion): number => f.peakSpeedDegS * motor.cmPerDeg

  return (
    <section className="panel motor-panel">
      <h2 className="panel-title">{title}</h2>

      <div className="motor-top">
        <div className="motor-score">
          <span className="motor-score-value num">{motor.score}</span>
          <span className="motor-score-label">{verdict(motor.score)}</span>
          <p className="fine">
            Índice de 0 a 100 baseado em {motor.flicks.length} flicks. Mede o quanto o primeiro impulso da sua mão já cai
            no alvo, sempre do mesmo jeito.
          </p>
        </div>
        <div className="motor-meters">
          <Meter
            label="Precisão do impulso"
            value={c.accuracy}
            hint={`O primeiro movimento percorre em média ${fmt(motor.gainMean * 100)}% da distância. O normal é uns 92%: a mão para um pouco antes e corrige.`}
          />
          <Meter
            label="Consistência"
            value={c.consistency}
            hint={`Esse percentual varia ${fmt(motor.gainSd * 100)} pontos de um flick pro outro.`}
          />
          <Meter
            label="Escala de velocidade"
            value={c.scaling}
            hint={
              c.scaling === null
                ? 'Os alvos ficaram a distâncias parecidas demais pra medir.'
                : 'Alvo mais longe, mão mais rápida: o quanto sua velocidade acompanha a distância.'
            }
          />
          <Meter
            label="Eficiência"
            value={c.efficiency}
            hint={`Em média ${fmt(motor.correctionsMean, 1)} correções depois do movimento principal.`}
          />
        </div>
      </div>

      <dl className="kv motor-kv">
        <div>
          <dt>Velocidade de pico da mão</dt>
          <dd className="num">{fmt(motor.avgPeakSpeedCmS)} cm/s</dd>
        </div>
        <div>
          <dt>Tempo de reação</dt>
          <dd className="num">{fmt(motor.avgReactionMs)} ms</dd>
        </div>
        <div>
          <dt>Tempo de movimento</dt>
          <dd className="num">{fmt(motor.avgMovementMs)} ms</dd>
        </div>
        <div>
          <dt>Vazão (lei de Fitts)</dt>
          <dd className="num">{fmt(motor.throughput, 1)} bits/s</dd>
        </div>
      </dl>

      <div className="motor-charts">
        <figure className="chart-figure">
          <figcaption className="chart-title">Velocidade de pico por distância</figcaption>
          <SpeedDistanceChart flicks={motor.flicks} cmPerDeg={motor.cmPerDeg} />
          <p className="fine">Pontos perto da reta: sua mão já sabe quanto acelerar pra cada distância.</p>
        </figure>
        <figure className="chart-figure">
          <figcaption className="chart-title">Onde o impulso principal parou</figcaption>
          <GainStrip flicks={motor.flicks} />
          <p className="fine">Pontos juntos na faixa normal: o primeiro movimento cai sempre no mesmo lugar, logo antes do alvo.</p>
        </figure>
      </div>

      <details className="flick-table">
        <summary>Ver todos os flicks em tabela</summary>
        <table>
          <thead>
            <tr>
              <th>Flick</th>
              <th>Distância</th>
              <th>Pico da mão</th>
              <th>Reação</th>
              <th>Impulso principal</th>
              <th>Correções</th>
            </tr>
          </thead>
          <tbody>
            {motor.flicks.map((f, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{fmt(f.distanceDeg * motor.cmPerDeg, 1)} cm</td>
                <td>{fmt(speedCm(f))} cm/s</td>
                <td>{fmt(f.reactionMs)} ms</td>
                <td>{fmt(f.gain * 100)}%</td>
                <td>{f.corrections}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}
