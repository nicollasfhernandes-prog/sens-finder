// Analisa a trajetória da mira durante um flick pra detectar overflick (passou do alvo e
// corrigiu de volta) e underflick (parou curto e precisou de um segundo empurrão).
// Tudo em espaço angular (graus), projetado no eixo do flick original — não em pixels de tela.

export function normalizeDeg(deg: number): number {
  let d = deg % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

/** Coordenadas esféricas (yaw/pitch, em graus) de um ponto visto a partir da câmera. */
export function sphericalOf(
  camX: number,
  camY: number,
  camZ: number,
  px: number,
  py: number,
  pz: number
): { yawDeg: number; pitchDeg: number } {
  const dx = px - camX
  const dy = py - camY
  const dz = pz - camZ
  const horizDist = Math.sqrt(dx * dx + dz * dz)
  const yaw = Math.atan2(-dx, -dz)
  const pitch = Math.atan2(dy, horizDist)
  return { yawDeg: radToDeg(yaw), pitchDeg: radToDeg(pitch) }
}

/** Direção inicial (unitária) do erro yaw/pitch no momento do spawn — define o "eixo do flick". */
export function initialFlickAxis(
  camYawDeg: number,
  camPitchDeg: number,
  targetYawDeg: number,
  targetPitchDeg: number
): { ux: number; uy: number; mag: number } {
  const yawErr = normalizeDeg(targetYawDeg - camYawDeg)
  const pitchErr = targetPitchDeg - camPitchDeg
  const mag = Math.hypot(yawErr, pitchErr) || 0.0001
  return { ux: yawErr / mag, uy: pitchErr / mag, mag }
}

/** Distância restante (com sinal) projetada no eixo do flick original, num instante qualquer. */
export function projectOntoAxis(
  camYawDeg: number,
  camPitchDeg: number,
  targetYawDeg: number,
  targetPitchDeg: number,
  ux: number,
  uy: number
): number {
  const yawErr = normalizeDeg(targetYawDeg - camYawDeg)
  const pitchErr = targetPitchDeg - camPitchDeg
  return yawErr * ux + pitchErr * uy
}

export interface FlickAnalysis {
  overflickDeg: number
  underflickDeg: number
}

const STALL_VELOCITY_DEG = 0.06
const STALL_MIN_SAMPLES = 5
const MOVE_START_MIN_DEG = 0.5
const MOVE_START_FRACTION = 0.1
// O impulso principal humano para naturalmente uns 5–10% antes do alvo e uma correção curta
// fecha o resto (modelo de dois componentes, Elliott et al.). Parar até 15% antes é normal;
// só conta como underflick quem para mais longe que isso.
const NORMAL_UNDERSHOOT_FRACTION = 0.15
// O mesmo vale pro outro lado: passar um pouco do alvo e voltar é normal. Só conta como overflick
// quem passa mais de 10% da distância além da borda.
const NORMAL_OVERSHOOT_FRACTION = 0.1

/**
 * samples: valores de `r` (distância restante projetada, com sinal) amostrados quadro a
 * quadro do início do flick até o acerto/timeout. Magnitudes retornadas são medidas a partir
 * da borda do alvo: 0 significa que não houve over/underflick.
 */
export function analyzeFlick(samples: number[], targetRadiusDeg: number): FlickAnalysis {
  if (samples.length < 2) return { overflickDeg: 0, underflickDeg: 0 }

  const r0 = samples[0]
  const moveThreshold = Math.max(MOVE_START_MIN_DEG, Math.abs(r0) * MOVE_START_FRACTION)
  const shortThreshold = Math.max(targetRadiusDeg, Math.abs(r0) * NORMAL_UNDERSHOOT_FRACTION)
  const overThreshold = Math.max(targetRadiusDeg, Math.abs(r0) * NORMAL_OVERSHOOT_FRACTION)

  let minR = r0
  let started = false
  let stallRun = 0
  let underflickDeg = 0

  for (let i = 1; i < samples.length; i++) {
    const r = samples[i]
    if (r < minR) minR = r

    // Antes do movimento começar, mira parada é só tempo de reação, não underflick.
    if (!started) {
      started = Math.abs(r - r0) > moveThreshold
      continue
    }

    const dr = Math.abs(r - samples[i - 1])
    if (dr < STALL_VELOCITY_DEG && r > shortThreshold) {
      stallRun += 1
      if (stallRun >= STALL_MIN_SAMPLES) {
        underflickDeg = Math.max(underflickDeg, r - targetRadiusDeg)
      }
    } else {
      stallRun = 0
    }
  }

  const overflickDeg = -minR > overThreshold ? -minR - targetRadiusDeg : 0
  return { overflickDeg, underflickDeg }
}
