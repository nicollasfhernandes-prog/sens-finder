// Cinemática de cada flick, no modelo de submovimentos (Meyer et al.) usado em estudos de
// pontaria: um impulso balístico principal seguido de correções. Com memória muscular
// formada pra uma sens, o impulso principal cai perto do alvo, de forma consistente, e a
// velocidade de pico cresce junto com a distância.

export interface FlickMotion {
  /** Distância inicial até o alvo, em graus. */
  distanceDeg: number
  /** Raio angular do alvo, em graus (pro índice de dificuldade de Fitts). */
  targetRadiusDeg: number
  peakSpeedDegS: number
  reactionMs: number
  movementMs: number
  /** Fração da distância percorrida pelo impulso principal: 1 = parou no alvo. */
  gain: number
  corrections: number
}

export interface MotorStats {
  flicks: FlickMotion[]
  /** Centímetros de mousepad por grau, pra converter velocidade angular em velocidade da mão. */
  cmPerDeg: number
  avgPeakSpeedDegS: number
  avgPeakSpeedCmS: number
  avgReactionMs: number
  avgMovementMs: number
  gainMean: number
  gainSd: number
  /** R² da velocidade de pico em função da distância; null com poucos flicks ou distâncias parecidas. */
  speedDistanceR2: number | null
  correctionsMean: number
  /** Vazão de Fitts, em bits/s. */
  throughput: number
  score: number
  components: { accuracy: number; consistency: number; scaling: number | null; efficiency: number }
}

const MIN_DISTANCE_DEG = 3
const ONSET_FRACTION = 0.1
const MIN_ONSET_SPEED = 20
const PRIMARY_END_FRACTION = 0.1
const CORRECTION_PEAK_FRACTION = 0.15
export const MIN_FLICKS_FOR_STATS = 5
/**
 * Onde o impulso principal de uma mão calibrada costuma parar: um pouco antes do alvo, de
 * propósito — corrigir pra frente custa menos que voltar (modelo de dois componentes,
 * Elliott et al.). É o ponto neutro da análise, não 100%.
 */
export const NEUTRAL_GAIN = 0.92

function mean(v: number[]): number {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0
}

function sd(v: number[]): number {
  if (v.length < 2) return 0
  const m = mean(v)
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1))
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/**
 * samples: distância restante projetada no eixo do flick (graus), um por frame; times: ms do
 * mesmo frame. Devolve null pra flicks curtos demais ou sem movimento detectável.
 */
export function analyzeFlickMotion(samples: number[], times: number[], targetRadiusDeg: number): FlickMotion | null {
  const n = Math.min(samples.length, times.length)
  if (n < 4) return null
  const d0 = samples[0]
  if (d0 < MIN_DISTANCE_DEG) return null

  // Velocidade de aproximação (graus/s) entre frames, suavizada com média móvel de 3.
  const raw: number[] = [0]
  for (let i = 1; i < n; i++) {
    const dt = (times[i] - times[i - 1]) / 1000
    raw.push(dt > 0 ? (samples[i - 1] - samples[i]) / dt : 0)
  }
  const v = raw.map((_, i) => {
    const w = raw.slice(Math.max(0, i - 1), Math.min(n, i + 2))
    return mean(w)
  })

  let peakIdx = 0
  for (let i = 1; i < n; i++) if (v[i] > v[peakIdx]) peakIdx = i
  const peak = v[peakIdx]
  if (peak < MIN_ONSET_SPEED) return null

  const onsetThreshold = Math.max(MIN_ONSET_SPEED, peak * ONSET_FRACTION)
  let onset = 0
  while (onset < peakIdx && v[onset] < onsetThreshold) onset++

  let primaryEnd = peakIdx
  while (primaryEnd < n - 1 && v[primaryEnd] > peak * PRIMARY_END_FRACTION) primaryEnd++

  // Correções contam nos dois sentidos: depois de passar do alvo, ela volta (velocidade negativa).
  const speed = v.map(Math.abs)
  let corrections = 0
  for (let i = primaryEnd + 1; i < n - 1; i++) {
    if (speed[i] > peak * CORRECTION_PEAK_FRACTION && speed[i] >= speed[i - 1] && speed[i] > speed[i + 1]) corrections++
  }

  return {
    distanceDeg: d0,
    targetRadiusDeg,
    peakSpeedDegS: peak,
    reactionMs: times[onset] - times[0],
    movementMs: times[n - 1] - times[onset],
    gain: (d0 - samples[primaryEnd]) / d0,
    corrections
  }
}

function linearR2(xs: number[], ys: number[]): number | null {
  if (xs.length < MIN_FLICKS_FOR_STATS) return null
  const mx = mean(xs)
  const my = mean(ys)
  let sxx = 0
  let sxy = 0
  let syy = 0
  for (let i = 0; i < xs.length; i++) {
    sxx += (xs[i] - mx) ** 2
    sxy += (xs[i] - mx) * (ys[i] - my)
    syy += (ys[i] - my) ** 2
  }
  // Distâncias quase iguais (ex.: Spidershot sempre do centro) não permitem medir a escala.
  if (sxx === 0 || syy === 0 || sd(xs) / mx < 0.2) return null
  return (sxy * sxy) / (sxx * syy)
}

export function linearFit(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const mx = mean(xs)
  const my = mean(ys)
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < xs.length; i++) {
    sxx += (xs[i] - mx) ** 2
    sxy += (xs[i] - mx) * (ys[i] - my)
  }
  const slope = sxx > 0 ? sxy / sxx : 0
  return { slope, intercept: my - slope * mx }
}

/** Resume os flicks de uma ou mais partidas. Null quando há menos flicks que o mínimo. */
export function summarizeMotor(flicks: FlickMotion[], cmPerDeg: number): MotorStats | null {
  if (flicks.length < MIN_FLICKS_FOR_STATS) return null
  const gains = flicks.map((f) => f.gain)
  const gainMean = mean(gains)
  const gainSd = sd(gains)
  const speedDistanceR2 = linearR2(
    flicks.map((f) => f.distanceDeg),
    flicks.map((f) => f.peakSpeedDegS)
  )
  const correctionsMean = mean(flicks.map((f) => f.corrections))
  const throughput = mean(
    flicks
      .filter((f) => f.movementMs > 0)
      .map((f) => Math.log2(f.distanceDeg / (2 * f.targetRadiusDeg) + 1) / (f.movementMs / 1000))
  )

  // Componentes de 0 a 1. Limites escolhidos pra que um jogador consistente fique perto de 1.
  const components = {
    accuracy: clamp01(1 - Math.abs(gainMean - NEUTRAL_GAIN) / 0.3),
    consistency: clamp01(1 - gainSd / 0.25),
    scaling: speedDistanceR2,
    efficiency: clamp01(1 - correctionsMean / 2)
  }
  const weighted =
    components.scaling === null
      ? (0.375 * components.accuracy + 0.375 * components.consistency + 0.25 * components.efficiency)
      : 0.3 * components.accuracy + 0.3 * components.consistency + 0.2 * components.scaling + 0.2 * components.efficiency

  const avgPeakSpeedDegS = mean(flicks.map((f) => f.peakSpeedDegS))
  return {
    flicks,
    cmPerDeg,
    avgPeakSpeedDegS,
    avgPeakSpeedCmS: avgPeakSpeedDegS * cmPerDeg,
    avgReactionMs: mean(flicks.map((f) => f.reactionMs)),
    avgMovementMs: mean(flicks.map((f) => f.movementMs)),
    gainMean,
    gainSd,
    speedDistanceR2,
    correctionsMean,
    throughput,
    score: Math.round(weighted * 100),
    components
  }
}
