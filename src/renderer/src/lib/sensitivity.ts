import type { AimTestResult } from '../types'
import type { ScenarioResult } from '../engine/types'
import { MIN_FLICKS_FOR_STATS } from '../engine/motor'

export type GameId = 'valorant' | 'cs2' | 'apex' | 'overwatch2' | 'cod' | 'fortnite' | 'r6siege'

/**
 * Como o jogo mede o FOV que o jogador configura:
 * 'v' = vertical; 'h16:9' = horizontal numa tela 16:9; 'h4:3' = horizontal numa tela 4:3
 * (Source/Apex). Todos rodam "Hor+": o FOV vertical fica fixo e o horizontal abre em telas largas.
 */
export type FovType = 'v' | 'h16:9' | 'h4:3'

export interface FovInfo {
  type: FovType
  default: number
  /** Ausentes quando o jogo não deixa mudar o FOV. */
  min?: number
  max?: number
}

export interface GameInfo {
  label: string
  fov: FovInfo
  /** Graus girados por count do mouse com sensibilidade 1 (na unidade que o jogo mostra). */
  yaw: number
  /** Casas decimais que o jogo aceita no campo de sensibilidade. */
  decimals: number
  /** Passo dos botões − / + no app. */
  step: number
  /** Onde colar o valor dentro do jogo. */
  where: string
}

// Yaw de referência dos conversores da comunidade (mouse-sensitivity.com e afins).
export const GAMES: Record<GameId, GameInfo> = {
  valorant: {
    label: 'Valorant',
    fov: { type: 'h16:9', default: 103 },
    yaw: 0.07,
    decimals: 3,
    step: 0.005,
    where: 'Configurações, Geral, Sensibilidade do mouse.'
  },
  cs2: {
    label: 'CS2',
    fov: { type: 'h4:3', default: 90 },
    yaw: 0.022,
    decimals: 2,
    step: 0.01,
    where: 'Configurações, Teclado e mouse, Sensibilidade do mouse (ou "sensitivity" no console).'
  },
  apex: {
    label: 'Apex Legends',
    fov: { type: 'h4:3', default: 90, min: 70, max: 110 },
    yaw: 0.022,
    decimals: 2,
    step: 0.05,
    where: 'Configurações, Mouse/teclado, Sensibilidade do mouse.'
  },
  overwatch2: {
    label: 'Overwatch 2',
    fov: { type: 'h16:9', default: 103, min: 80, max: 103 },
    yaw: 0.0066,
    decimals: 2,
    step: 0.1,
    where: 'Opções, Controles, Geral, Sensibilidade.'
  },
  cod: {
    label: 'Call of Duty',
    fov: { type: 'h16:9', default: 80, min: 60, max: 120 },
    yaw: 0.0066,
    decimals: 2,
    step: 0.05,
    where: 'Configurações, Mouse, Sensibilidade do mouse (com multiplicador de mira em 1,00).'
  },
  fortnite: {
    // Fortnite mostra a sens em porcentagem: 0,5555° por count a 100%.
    label: 'Fortnite',
    fov: { type: 'h16:9', default: 80 },
    yaw: 0.005555,
    decimals: 1,
    step: 0.1,
    where: 'Configurações, Mouse e teclado, Sensibilidade X e Y (em %).'
  },
  r6siege: {
    // Com MouseSensitivityMultiplierUnit no padrão 0,02.
    label: 'Rainbow Six Siege',
    fov: { type: 'v', default: 60, min: 60, max: 90 },
    yaw: 0.00573,
    decimals: 0,
    step: 1,
    where: 'Opções, Controles, Sensibilidade horizontal e vertical (multiplicador padrão 0,02).'
  }
}

export const GAME_IDS = Object.keys(GAMES) as GameId[]

const DEG = Math.PI / 180

/** Converte o valor de FOV como o jogo mostra pro FOV vertical, que é o que a câmera 3D usa. */
export function verticalFov(game: GameId, value: number): number {
  const { type } = GAMES[game].fov
  if (type === 'v') return value
  const aspect = type === 'h16:9' ? 16 / 9 : 4 / 3
  return (2 * Math.atan(Math.tan((value * DEG) / 2) / aspect)) / DEG
}

/** FOV horizontal numa tela 16:9, pra mostrar ao jogador um número comparável entre jogos. */
export function horizontalFov169(verticalDeg: number): number {
  return (2 * Math.atan(Math.tan((verticalDeg * DEG) / 2) * (16 / 9))) / DEG
}

const CM_PER_INCH = 2.54

/** cm necessários para girar 360°, dado dpi, sensibilidade in-game e o yaw do jogo. */
export function cm360(dpi: number, sens: number, yaw: number): number {
  return (CM_PER_INCH * 360) / (dpi * sens * yaw)
}

/** Sensibilidade in-game necessária para atingir um cm/360 alvo, dado dpi e o yaw do jogo. */
export function sensForCm360(dpi: number, targetCm360: number, yaw: number): number {
  return (CM_PER_INCH * 360) / (dpi * targetCm360 * yaw)
}

export function eDPI(dpi: number, sens: number): number {
  return dpi * sens
}

/** Converte sensibilidade entre jogos mantendo os mesmos cm/360° (mesmo DPI). */
export function convertSens(sens: number, from: GameId, to: GameId): number {
  return (sens * GAMES[from].yaw) / GAMES[to].yaw
}

export function gameCm360(dpi: number, sens: number, game: GameId): number {
  return cm360(dpi, sens, GAMES[game].yaw)
}

export type PlayStyle = 'tracking' | 'balanced' | 'flick'

// Faixas de cm/360 sugeridas pela comunidade competitiva de FPS, por estilo de jogo.
const PLAYSTYLE_CM360: Record<PlayStyle, number> = {
  tracking: 45,
  balanced: 32,
  flick: 20
}

/** Heurística inicial pra quem nunca jogou outro FPS com sens conhecida. */
export function heuristicSens(dpi: number, style: PlayStyle, game: GameId): number {
  return sensForCm360(dpi, PLAYSTYLE_CM360[style], GAMES[game].yaw)
}

/** Arredonda pra precisão que o campo de sensibilidade do jogo aceita (Valorant por padrão). */
export function roundSens(sens: number, game: GameId = 'valorant'): number {
  const f = 10 ** GAMES[game].decimals
  return Math.max(1 / f, Math.round(sens * f) / f)
}

export interface AdjustmentBreakdown {
  flicksAnalyzed: number
  overflickRate: number
  avgOverflickDeg: number
  underflickRate: number
  avgUnderflickDeg: number
  /** null quando nenhum resultado é de clique (só tracking). */
  hitRate: number | null
  trackingCoverage: number | null
  trackingCrossingsPerSec: number | null
}

export interface AdjustmentSuggestion {
  multiplier: number
  reasons: string[]
  breakdown: AdjustmentBreakdown
}

const MAX_ADJUST = 0.15
const DEADZONE = 0.01
const FLICK_WEIGHT = 0.6
const TRACKING_WEIGHT = 0.4
// Oscilações/s acima disso no tracking indicam correção demais (sens alta); abaixo, a mira
// fica atrás do alvo sem cruzar (sens baixa). Só pesa na proporção do tempo fora do alvo.
const TRACKING_CROSSINGS_BASELINE = 1
const HIT_RATE_FLOOR = 0.7
// Ganho de 125% (ou 75%) no impulso principal já conta como desvio máximo pra um lado.
const GAIN_FULL_SCALE = 0.25
const GAIN_TOLERANCE = 0.05

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

function weighted(results: ScenarioResult[], pickValue: (r: ScenarioResult) => number): number {
  const total = results.reduce((s, r) => s + r.flicksAnalyzed, 0)
  return total > 0 ? results.reduce((s, r) => s + pickValue(r) * r.flicksAnalyzed, 0) / total : 0
}

/**
 * Ajuste contínuo no estilo do Sens Finder do Aim Lab: compara o quanto você passa do alvo
 * (overflick) com o quanto fica curto (underflick). Se o overflick domina, a sens desce; se o
 * underflick domina, sobe — proporcional ao desequilíbrio, limitado a ±15% por rodada.
 * Aceita qualquer combinação de cenários: flick, tracking ou os dois.
 */
export function recommendAdjustment(
  results: ScenarioResult[],
  referenceAngularRadiusDeg: number
): AdjustmentSuggestion {
  const flickResults = results.filter((r) => r.flicksAnalyzed > 0)
  const clickResults = results.filter((r) => r.tracking === null)
  const trackResults = results.flatMap((r) => (r.tracking ? [r.tracking] : []))

  const attempts = clickResults.reduce((s, r) => s + r.shots + (r.targetsResolved - r.kills), 0)
  const kills = clickResults.reduce((s, r) => s + r.kills, 0)

  const breakdown: AdjustmentBreakdown = {
    flicksAnalyzed: flickResults.reduce((s, r) => s + r.flicksAnalyzed, 0),
    overflickRate: weighted(flickResults, (r) => r.overflickRate),
    avgOverflickDeg: weighted(flickResults, (r) => r.avgOverflickDeg),
    underflickRate: weighted(flickResults, (r) => r.underflickRate),
    avgUnderflickDeg: weighted(flickResults, (r) => r.avgUnderflickDeg),
    // Acertos sobre tentativas: tiros errados e alvos que expiraram contam contra.
    hitRate: clickResults.length > 0 ? kills / Math.max(attempts, 1) : null,
    trackingCoverage:
      trackResults.length > 0 ? trackResults.reduce((s, t) => s + t.coverage, 0) / trackResults.length : null,
    trackingCrossingsPerSec:
      trackResults.length > 0
        ? trackResults.reduce((s, t) => s + t.crossingsPerSec, 0) / trackResults.length
        : null
  }

  // Frequência × magnitude (em raios de alvo) de cada tipo de erro.
  const overScore = breakdown.overflickRate * (1 + breakdown.avgOverflickDeg / referenceAngularRadiusDeg)
  const underScore = breakdown.underflickRate * (1 + breakdown.avgUnderflickDeg / referenceAngularRadiusDeg)
  const overUnderBias = clamp(overScore - underScore, -1, 1)

  // Ganho do impulso principal: o sinal mais direto de sens desajustada. Se o primeiro
  // movimento passa do alvo em média, a mão está calibrada pra uma sens mais baixa.
  const motionFlicks = results.flatMap((r) => r.motor?.flicks ?? [])
  const gainMean =
    motionFlicks.length >= MIN_FLICKS_FOR_STATS
      ? motionFlicks.reduce((s, f) => s + f.gain, 0) / motionFlicks.length
      : null
  const gainBias = gainMean !== null ? clamp((gainMean - 1) / GAIN_FULL_SCALE, -1, 1) : null
  const flickBias = gainBias !== null ? (overUnderBias + gainBias) / 2 : overUnderBias

  const trackBias =
    breakdown.trackingCoverage !== null && breakdown.trackingCrossingsPerSec !== null
      ? clamp(
          (breakdown.trackingCrossingsPerSec - TRACKING_CROSSINGS_BASELINE) / TRACKING_CROSSINGS_BASELINE,
          -1,
          1
        ) *
        (1 - breakdown.trackingCoverage)
      : 0

  const missPenalty = breakdown.hitRate !== null ? Math.max(0, HIT_RATE_FLOOR - breakdown.hitRate) : 0

  const hasFlick = breakdown.flicksAnalyzed > 0
  const hasTrack = breakdown.trackingCoverage !== null
  const flickWeight = hasFlick ? (hasTrack ? FLICK_WEIGHT : 1) : 0
  const trackWeight = hasTrack ? (hasFlick ? TRACKING_WEIGHT : 1) : 0

  const bias = flickWeight * flickBias + trackWeight * trackBias + missPenalty
  let multiplier = clamp(1 - MAX_ADJUST * bias, 1 - MAX_ADJUST, 1 + MAX_ADJUST)
  if (Math.abs(multiplier - 1) < DEADZONE) multiplier = 1

  const reasons: string[] = []
  if (!hasFlick) {
    // Cenário só de tracking: não há flick pra comentar.
  } else if (breakdown.overflickRate > 0 || breakdown.underflickRate > 0) {
    if (overScore > underScore) {
      reasons.push(
        `Você passou do alvo em ${pct(breakdown.overflickRate)} dos flicks e ficou curto em ${pct(breakdown.underflickRate)} — tendência de sens alta.`
      )
    } else if (underScore > overScore) {
      reasons.push(
        `Você ficou curto em ${pct(breakdown.underflickRate)} dos flicks e passou do alvo em ${pct(breakdown.overflickRate)} — tendência de sens baixa.`
      )
    } else {
      reasons.push('Overflicks e underflicks equilibrados nos flicks.')
    }
  } else {
    reasons.push('Nenhum overflick ou underflick detectado nos flicks.')
  }

  if (gainMean !== null) {
    const g = Math.round(gainMean * 100)
    if (gainMean > 1 + GAIN_TOLERANCE) {
      reasons.push(`O impulso principal dos seus flicks percorre em média ${g}% da distância: a mão passa do ponto, sinal de sens alta.`)
    } else if (gainMean < 1 - GAIN_TOLERANCE) {
      reasons.push(`O impulso principal dos seus flicks percorre em média ${g}% da distância: a mão para antes, sinal de sens baixa.`)
    } else {
      reasons.push(`O impulso principal dos seus flicks percorre em média ${g}% da distância: bem calibrado pra essa sens.`)
    }
  }

  if (trackBias > 0.1) {
    reasons.push('No tracking sua mira ficou oscilando de um lado pro outro do alvo — sinal de sens alta.')
  } else if (trackBias < -0.1) {
    reasons.push('No tracking sua mira ficou atrás do alvo sem alcançá-lo — sinal de sens baixa.')
  }

  if (missPenalty > 0 && breakdown.hitRate !== null) {
    reasons.push(`Taxa de acerto de ${pct(breakdown.hitRate)} puxa a sens pra baixo.`)
  }

  if (reasons.length === 0) {
    reasons.push('Tracking equilibrado — nenhum sinal claro pra subir ou descer.')
  }

  return { multiplier, reasons, breakdown }
}

export function suggestAdjustment(result: AimTestResult, referenceAngularRadiusDeg: number): AdjustmentSuggestion {
  return recommendAdjustment([result.flick, result.gridshot, result.tracking], referenceAngularRadiusDeg)
}
