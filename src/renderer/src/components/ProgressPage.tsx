import { useMemo, useState } from 'react'
import { clearHistory, loadHistory, SessionRecord, summarizeBySens } from '../lib/history'
import { GAME_IDS, GameId, GAMES } from '../lib/sensitivity'
import { useSettings } from '../settings'

interface Props {
  onGoTraining: () => void
}

const MIN_SESSIONS_FOR_VERDICT = 2

function fmt(n: number, digits = 0): string {
  return n.toFixed(digits).replace('.', ',')
}

function date(at: number): string {
  return new Date(at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const W = 720
const H = 220
const PAD = { left: 36, right: 14, top: 14, bottom: 28 }

function TrendChart({ sessions }: { sessions: SessionRecord[] }): JSX.Element {
  const [hover, setHover] = useState<number | null>(null)
  const n = sessions.length
  const sx = (i: number): number => PAD.left + (n === 1 ? 0.5 : i / (n - 1)) * (W - PAD.left - PAD.right)
  const sy = (v: number): number => H - PAD.bottom - (v / 100) * (H - PAD.top - PAD.bottom)
  const path = sessions.map((s, i) => `${i === 0 ? 'M' : 'L'}${sx(i)},${sy(s.motor!.score)}`).join(' ')

  function onMove(e: React.PointerEvent<SVGSVGElement>): void {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    let best = 0
    for (let i = 1; i < n; i++) if (Math.abs(sx(i) - x) < Math.abs(sx(best) - x)) best = i
    setHover(best)
  }

  const h = hover !== null ? sessions[hover] : null

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart"
        role="img"
        aria-label="Índice de memória muscular em cada partida, da mais antiga pra mais recente"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={sy(v)} y2={sy(v)} />
            <text className="chart-tick" x={PAD.left - 6} y={sy(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        <text className="chart-axis-label" x={PAD.left} y={H - 6}>
          mais antiga
        </text>
        <text className="chart-axis-label" x={W - PAD.right} y={H - 6} textAnchor="end">
          mais recente
        </text>
        {hover !== null && <line className="chart-crosshair" x1={sx(hover)} x2={sx(hover)} y1={PAD.top} y2={H - PAD.bottom} />}
        <path className="chart-line" d={path} />
        {sessions.map((s, i) => (
          <circle key={i} className={`chart-dot${hover === i ? ' is-active' : ''}`} cx={sx(i)} cy={sy(s.motor!.score)} r={4} />
        ))}
      </svg>
      {h && hover !== null && (
        <div className="chart-tip" style={{ left: `${(sx(hover) / W) * 100}%`, top: `${(sy(h.motor!.score) / H) * 100}%` }} role="status">
          <strong>Índice {h.motor!.score}</strong>
          <span>
            {h.scenarioName}, sens {h.sens}
          </span>
          <span>{date(h.at)}</span>
        </div>
      )}
    </div>
  )
}

export default function ProgressPage({ onGoTraining }: Props): JSX.Element {
  const { settings, changeGame, update } = useSettings()
  const [version, setVersion] = useState(0)
  const all = useMemo(loadHistory, [version])
  const game = settings.game

  const forGame = all.filter((r) => r.game === game && r.dpi === settings.dpi)
  const bySens = summarizeBySens(all, game, settings.dpi)
  const ranked = bySens.filter((s) => s.motorScore !== null && s.motorSessions >= MIN_SESSIONS_FOR_VERDICT)
  const best = ranked.length ? ranked.reduce((a, b) => (b.motorScore! > a.motorScore! ? b : a)) : null
  const trend = forGame.filter((r) => r.motor !== null).slice(-40)
  const recent = [...forGame].reverse().slice(0, 15)

  function reset(): void {
    if (!window.confirm('Apagar todo o histórico de partidas? Os recordes de cada cenário continuam.')) return
    clearHistory()
    setVersion((v) => v + 1)
  }

  return (
    <section className="page page-wide">
      <header className="page-head page-head-row">
        <div>
          <h1 className="display">Progresso</h1>
          <p className="lede">Com qual sens sua mão já pegou o jeito, e como isso evolui de partida em partida.</p>
        </div>
        <label className="field">
          <span className="label">Jogo</span>
          <select className="input" value={game} onChange={(e) => changeGame(e.target.value as GameId)}>
            {GAME_IDS.map((id) => (
              <option key={id} value={id}>
                {GAMES[id].label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {forGame.length === 0 ? (
        <div className="panel empty-state">
          <h2 className="panel-title">Nenhuma partida no {GAMES[game].label} a {settings.dpi} DPI ainda</h2>
          <p className="lede">Jogue alguns treinos de flick. Cada partida entra aqui com a sens que você usou.</p>
          <div className="button-row">
            <button className="btn btn-primary" onClick={onGoTraining}>
              Ir pros treinos
            </button>
          </div>
        </div>
      ) : (
        <>
          <section className="panel">
            <h2 className="panel-title">Memória muscular por sens</h2>
            {best && ranked.length > 1 ? (
              <p className="progress-verdict">
                Sua mão está mais calibrada com <span className="num">{best.sens}</span>: índice médio{' '}
                <span className="num">{fmt(best.motorScore!)}</span> em {best.motorSessions} partidas.
              </p>
            ) : best ? (
              <p className="progress-verdict">
                Com <span className="num">{best.sens}</span>, índice médio <span className="num">{fmt(best.motorScore!)}</span>{' '}
                em {best.motorSessions} partidas. Jogue com outra sens pra comparar.
              </p>
            ) : (
              <p className="fine">
                Jogue pelo menos {MIN_SESSIONS_FOR_VERDICT} partidas de flick com uma sens pra comparar. Uma partida só é
                pouca amostra.
              </p>
            )}
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sens</th>
                  <th>Partidas</th>
                  <th>Índice de memória muscular</th>
                  <th>Impulso principal</th>
                  <th>Variação</th>
                  <th>Precisão</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bySens.map((s) => (
                  <tr key={s.sens} className={best?.sens === s.sens ? 'is-best' : undefined}>
                    <td className="num">{s.sens}</td>
                    <td>{s.sessions}</td>
                    <td>
                      {s.motorScore === null ? (
                        <span className="muted-cell">sem flicks suficientes</span>
                      ) : (
                        <span className="bar-cell">
                          <span className="bar-cell-track">
                            <span className="bar-cell-fill" style={{ width: `${s.motorScore}%` }} />
                          </span>
                          <span className="num">{fmt(s.motorScore)}</span>
                        </span>
                      )}
                    </td>
                    <td>{s.gainMean === null ? '—' : `${fmt(s.gainMean * 100)}%`}</td>
                    <td>{s.gainSd === null ? '—' : `±${fmt(s.gainSd * 100)}`}</td>
                    <td>{fmt(s.accuracy * 100)}%</td>
                    <td>
                      {s.sens !== settings.sens && (
                        <button className="link-btn" onClick={() => update({ sens: s.sens })}>
                          Treinar com essa
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="fine">
              Impulso principal perto de 100% e variação baixa significam que o primeiro movimento já cai no alvo, sempre
              igual. É isso que a memória muscular faz.
            </p>
          </section>

          {trend.length >= 2 && (
            <section className="panel">
              <h2 className="panel-title">Índice de memória muscular por partida</h2>
              <TrendChart sessions={trend} />
            </section>
          )}

          <section className="panel">
            <h2 className="panel-title">Últimas partidas</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Cenário</th>
                  <th>Sens</th>
                  <th>Pontos</th>
                  <th>Precisão</th>
                  <th>Índice</th>
                  <th>Pico da mão</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.at}>
                    <td>{date(r.at)}</td>
                    <td>{r.scenarioName}</td>
                    <td className="num">{r.sens}</td>
                    <td className="num">{r.score.toLocaleString('pt-BR')}</td>
                    <td>{fmt(r.accuracy * 100)}%</td>
                    <td className="num">{r.motor ? r.motor.score : '—'}</td>
                    <td>{r.motor ? `${fmt(r.motor.peakCmS)} cm/s` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="button-row">
              <button className="btn btn-ghost" onClick={reset}>
                Apagar histórico
              </button>
            </div>
          </section>
        </>
      )}
    </section>
  )
}
