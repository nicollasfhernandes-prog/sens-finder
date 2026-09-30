import { analyzeFlick, initialFlickAxis, projectOntoAxis } from '../lib/trajectory'
import { FireMode, Pose, ScenarioDef, ScenarioResult, Scoring, Target } from './types'

// Pontuação própria (as fórmulas do Aim Lab não são públicas): Ultimate equilibra velocidade e
// acerto, Precision pune erro pesado e multiplica pela precisão, Speed recompensa kill rápido.
const MISS_PENALTY: Record<Scoring, number> = { ultimate: 30, precision: 120, speed: 10, standard: 0 }
const EXPIRE_PENALTY: Record<Scoring, number> = { ultimate: 50, precision: 80, speed: 40, standard: 0 }

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function killPoints(scoring: Scoring, ttkMs: number): number {
  switch (scoring) {
    case 'ultimate':
      return 100 * clamp(1.6 - ttkMs / 1000, 0.6, 1.6)
    case 'speed':
      return 100 * clamp(2.2 - ttkMs / 500, 0.4, 2.2)
    case 'precision':
      return 120
    case 'standard':
      return 100 + Math.max(0, 100 - ttkMs / 10)
  }
}

function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
}

export interface TrackingSample {
  errDeg: number
  yawErrDeg: number
  radiusDeg: number
  targetId: number
  firing: boolean
}

export class MetricsRecorder {
  readonly camPath: Pose[] = []
  private score = 0
  private shots = 0
  private kills = 0
  private resolved = 0
  private ttks: number[] = []
  private overflicks: number[] = []
  private underflicks: number[] = []
  private lastResolveFrame = 0
  private lastResolveAt: number

  private trackFrames = 0
  private onFrames = 0
  private errorSum = 0
  private crossings = 0
  private lastSign = 0
  private trackedId = -1
  private firingFrames = 0
  private firingOnFrames = 0

  constructor(
    private readonly scoring: Scoring,
    private readonly mode: FireMode,
    startedAt: number
  ) {
    this.lastResolveAt = startedAt
  }

  get resolvedCount(): number {
    return this.resolved
  }

  get liveScore(): number {
    return Math.max(0, Math.round(this.score))
  }

  get liveAccuracy(): number {
    if (this.mode === 'click') return this.shots > 0 ? this.kills / this.shots : 1
    if (this.mode === 'hold') return this.firingFrames > 0 ? this.firingOnFrames / this.firingFrames : 1
    return this.trackFrames > 0 ? this.onFrames / this.trackFrames : 1
  }

  recordFrame(pose: Pose): void {
    this.camPath.push(pose)
  }

  recordShot(): void {
    this.shots += 1
  }

  recordMiss(): void {
    this.score -= MISS_PENALTY[this.scoring]
  }

  recordKill(t: Target, now: number, frame: number, pose: Pose, radiusDeg: number): void {
    const ttk = now - Math.max(this.lastResolveAt, t.spawnedAt)
    this.ttks.push(ttk)
    this.kills += 1
    this.score += killPoints(this.scoring, ttk)
    this.resolve(t, now, frame, pose, radiusDeg)
  }

  recordExpire(t: Target, now: number, frame: number, pose: Pose, radiusDeg: number): void {
    this.score -= EXPIRE_PENALTY[this.scoring]
    this.resolve(t, now, frame, pose, radiusDeg)
  }

  recordTracking(s: TrackingSample): void {
    this.trackFrames += 1
    this.errorSum += s.errDeg
    const on = s.errDeg <= s.radiusDeg
    if (on) this.onFrames += 1
    if (s.firing) {
      this.firingFrames += 1
      if (on) this.firingOnFrames += 1
    }

    if (s.targetId !== this.trackedId) {
      this.trackedId = s.targetId
      this.lastSign = 0
    }
    // Zona morta: tremido em cima do alvo não conta como cruzar pro outro lado.
    if (Math.abs(s.yawErrDeg) > s.radiusDeg * 0.5) {
      const sign = Math.sign(s.yawErrDeg)
      if (this.lastSign !== 0 && sign !== this.lastSign) this.crossings += 1
      this.lastSign = sign
    }
  }

  private resolve(t: Target, now: number, frame: number, pose: Pose, radiusDeg: number): void {
    this.resolved += 1
    if (this.mode === 'click') this.analyzeFlick(t, frame, pose, radiusDeg)
    this.lastResolveAt = now
    this.lastResolveFrame = frame
  }

  /**
   * Analisa o caminho da mira desde o último alvo resolvido (ou do spawn deste, o que vier
   * depois) contra este alvo — só o flick que o jogador de fato fez até ele. Funciona com alvo
   * em movimento porque usa a posição angular do alvo em cada frame.
   */
  private analyzeFlick(t: Target, frame: number, pose: Pose, radiusDeg: number): void {
    const from = Math.max(this.lastResolveFrame, t.spawnFrame)
    const cams = this.camPath.slice(from, frame + 1)
    cams.push(pose)
    const offset = from - t.spawnFrame
    const targetAt = (i: number): Pose =>
      t.angleHistory[Math.min(offset + i, t.angleHistory.length - 1)]

    const c0 = cams[0]
    const t0 = targetAt(0)
    const axis = initialFlickAxis(c0.yawDeg, c0.pitchDeg, t0.yawDeg, t0.pitchDeg)
    const samples = cams.map((c, i) => {
      const tt = targetAt(i)
      return projectOntoAxis(c.yawDeg, c.pitchDeg, tt.yawDeg, tt.pitchDeg, axis.ux, axis.uy)
    })
    const analysis = analyzeFlick(samples, radiusDeg)
    this.overflicks.push(analysis.overflickDeg)
    this.underflicks.push(analysis.underflickDeg)
  }

  result(def: ScenarioDef<unknown>, elapsedMs: number): ScenarioResult {
    const withOver = this.overflicks.filter((v) => v > 0)
    const withUnder = this.underflicks.filter((v) => v > 0)
    const analyzed = this.overflicks.length
    const accuracy = this.liveAccuracy

    let score = this.score
    if (this.scoring === 'precision') score *= accuracy

    return {
      id: def.id,
      name: def.name,
      variant: def.variant,
      score: Math.max(0, Math.round(score)),
      shots: this.shots,
      kills: this.kills,
      targetsResolved: this.resolved,
      accuracy,
      avgTtkMs: avg(this.ttks),
      flicksAnalyzed: analyzed,
      overflickRate: analyzed > 0 ? withOver.length / analyzed : 0,
      avgOverflickDeg: avg(withOver),
      underflickRate: analyzed > 0 ? withUnder.length / analyzed : 0,
      avgUnderflickDeg: avg(withUnder),
      tracking:
        this.mode === 'click'
          ? null
          : {
              coverage: this.trackFrames > 0 ? this.onFrames / this.trackFrames : 0,
              avgErrorDeg: this.trackFrames > 0 ? this.errorSum / this.trackFrames : 0,
              crossingsPerSec: this.crossings / Math.max(elapsedMs / 1000, 0.001)
            }
    }
  }
}
