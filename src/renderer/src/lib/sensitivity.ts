import type { AimTestResult } from '../types'
import type { ScenarioResult } from '../engine/types'
import { MIN_FLICKS_FOR_STATS, NEUTRAL_GAIN } from '../engine/motor'

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

/**
 * Resumo de uma partida que dá pra somar com outras e guardar no histórico. A recomendação é
 * calculada sobre um conjunto de evidências (uma bateria), não sobre uma partida isolada.
 */
export interface Evidence {
  flicksAnalyzed: number
  overflickRate: number
  avgOverflickDeg: number
  underflickRate: number
  avgUnderflickDeg: number
  /** Só cenários de clique; null em tracking. */
  shots: number | null
  kills: number
  targetsResolved: number
  tracking: { coverage: number; crossingsPerSec: number } | null
  motorFlicks: number
  gainMean: number | null
  gainSd: number | null
}

export function evidenceOf(r: ScenarioResult): Evidence {
  return {
    flicksAnalyzed: r.flicksAnalyzed,
    overflickRate: r.overflickRate,
    avgOverflickDeg: r.avgOverflickDeg,
    underflickRate: r.underflickRate,
    avgUnderflickDeg: r.avgUnderflickDeg,
    shots: r.tracking === null ? r.shots : null,
    kills: r.kills,
    targetsResolved: r.targetsResolved,
    tracking: r.tracking ? { coverage: r.tracking.coverage, crossingsPerSec: r.tracking.crossingsPerSec } : null,
    motorFlicks: r.motor?.flicks.length ?? 0,
    gainMean: r.motor?.gainMean ?? null,
    gainSd: r.motor?.gainSd ?? null
  }
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
  gainMean: number | null
  motorFlicks: number
}

export interface AdjustmentSuggestion {
  multiplier: number
  reasons: string[]
  breakdown: AdjustmentBreakdown
}

const MAX_ADJUST = 0.15
const DEADZONE = 0.01
// O tracking é um sinal mais fraco de direção que os flicks: pesa menos.
const FLICK_WEIGHT = 0.75
const TRACKING_WEIGHT = 0.25
// Trocas de lado por segundo no tracking. Dentro da faixa é correção normal de quem segue um alvo
// que muda de direção; acima, corrige demais (sens alta); abaixo, fica atrás sem cruzar (sens baixa).
// Só pesa na proporção do tempo fora do alvo.
const TRACKING_CROSSINGS_LOW = 1.2
const TRACKING_CROSSINGS_HIGH = 3.5
// Em FPS o impulso principal costuma ir de ~86% a ~98% do caminho; dentro disso não conta.
const GAIN_TOLERANCE = 0.06
// O impulso principal é o sinal mais direto; overflick/underflick entram como reforço.
const GAIN_SIGNAL_WEIGHT = 0.65
// Alguns over/underflicks são normais; só o desequilíbrio acima disso conta.
const RATE_TOLERANCE = 0.08

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

/** Encolhe o desvio pela tolerância: dentro da faixa vira 0, fora dela conta só o excedente. */
function beyond(dev: number, tolerance: number): number {
  return Math.sign(dev) * Math.max(0, Math.abs(dev) - tolerance)
}

function weighted(items: Evidence[], pick: (e: Evidence) => number, weight: (e: Evidence) => number): number {
  const total = items.reduce((s, e) => s + weight(e), 0)
  return total > 0 ? items.reduce((s, e) => s + pick(e) * weight(e), 0) / total : 0
}

/**
 * Ajuste contínuo a partir de várias partidas: compara o quanto você passa do alvo com o quanto
 * fica curto além do normal humano, e onde o impulso principal para em relação aos ~92% típicos.
 * Desvios dentro da margem de ruído da amostra não contam. Limitado a ±15% por bateria.
 */
export function recommendAdjustment(evidence: Evidence[], referenceAngularRadiusDeg: number): AdjustmentSuggestion {
  const flick = evidence.filter((e) => e.flicksAnalyzed > 0)
  const click = evidence.filter((e) => e.shots !== null)
  const track = evidence.flatMap((e) => (e.tracking ? [e.tracking] : []))
  const motor = evidence.filter((e) => e.gainMean !== null && e.motorFlicks > 0)

  const attempts = click.reduce((s, e) => s + (e.shots ?? 0) + (e.targetsResolved - e.kills), 0)
  const kills = click.reduce((s, e) => s + e.kills, 0)
  const motorFlicks = motor.reduce((s, e) => s + e.motorFlicks, 0)
  const byFlicks = (e: Evidence): number => e.flicksAnalyzed
  const byMotor = (e: Evidence): number => e.motorFlicks

  const breakdown: AdjustmentBreakdown = {
    flicksAnalyzed: flick.reduce((s, e) => s + e.flicksAnalyzed, 0),
    overflickRate: weighted(flick, (e) => e.overflickRate, byFlicks),
    avgOverflickDeg: weighted(flick, (e) => e.avgOverflickDeg, byFlicks),
    underflickRate: weighted(flick, (e) => e.underflickRate, byFlicks),
    avgUnderflickDeg: weighted(flick, (e) => e.avgUnderflickDeg, byFlicks),
    // Acertos sobre tentativas: tiros errados e alvos que expiraram contam contra.
    hitRate: click.length > 0 ? kills / Math.max(attempts, 1) : null,
    trackingCoverage: track.length > 0 ? track.reduce((s, t) => s + t.coverage, 0) / track.length : null,
    trackingCrossingsPerSec: track.length > 0 ? track.reduce((s, t) => s + t.crossingsPerSec, 0) / track.length : null,
    gainMean: motorFlicks >= MIN_FLICKS_FOR_STATS ? weighted(motor, (e) => e.gainMean!, byMotor) : null,
    motorFlicks
  }

  // Frequência × magnitude (em raios de alvo) de cada tipo de erro.
  const overScore = breakdown.overflickRate * (1 + breakdown.avgOverflickDeg / referenceAngularRadiusDeg)
  const underScore = breakdown.underflickRate * (1 + breakdown.avgUnderflickDeg / referenceAngularRadiusDeg)
  const overUnderBias = clamp(beyond(overScore - underScore, RATE_TOLERANCE), -1, 1)

  // Impulso principal contra o neutro humano, descontando o erro padrão da média: com poucos
  // flicks ou muita variação, o desvio precisa ser maior pra contar.
  // Se a mão percorre `g` da distância com essa sens, multiplicar a sens por NEUTRO/g leva o
  // mesmo movimento de mão pro ponto neutro; o viés é esse ajuste em unidades de MAX_ADJUST.
  let gainBias: number | null = null
  if (breakdown.gainMean !== null) {
    const sd = weighted(motor, (e) => e.gainSd ?? 0, byMotor)
    const standardError = sd / Math.sqrt(motorFlicks)
    const effectiveGain = NEUTRAL_GAIN + beyond(breakdown.gainMean - NEUTRAL_GAIN, GAIN_TOLERANCE + 2 * standardError)
    gainBias = clamp((1 - NEUTRAL_GAIN / effectiveGain) / MAX_ADJUST, -1, 1)
  }
  const flickBias =
    gainBias !== null ? GAIN_SIGNAL_WEIGHT * gainBias + (1 - GAIN_SIGNAL_WEIGHT) * overUnderBias : overUnderBias

  const crossings = breakdown.trackingCrossingsPerSec
  const trackBias =
    breakdown.trackingCoverage !== null && crossings !== null
      ? clamp(
          crossings > TRACKING_CROSSINGS_HIGH
            ? (crossings - TRACKING_CROSSINGS_HIGH) / TRACKING_CROSSINGS_HIGH
            : crossings < TRACKING_CROSSINGS_LOW
              ? (crossings - TRACKING_CROSSINGS_LOW) / TRACKING_CROSSINGS_LOW
              : 0,
          -1,
          1
        ) *
        (1 - breakdown.trackingCoverage)
      : 0

  const hasFlick = breakdown.flicksAnalyzed > 0
  const hasTrack = breakdown.trackingCoverage !== null
  const flickWeight = hasFlick ? (hasTrack ? FLICK_WEIGHT : 1) : 0
  const trackWeight = hasTrack ? (hasFlick ? TRACKING_WEIGHT : 1) : 0

  // Errar tiro não diz se a sens está alta ou baixa, então a precisão não entra na direção.
  const bias = flickWeight * flickBias + trackWeight * trackBias
  let multiplier = clamp(1 - MAX_ADJUST * bias, 1 - MAX_ADJUST, 1 + MAX_ADJUST)
  if (Math.abs(multiplier - 1) < DEADZONE) multiplier = 1

  const reasons: string[] = []
  if (hasFlick) {
    if (overUnderBias > 0) {
      reasons.push(
        `Você passou do alvo em ${pct(breakdown.overflickRate)} dos flicks e ficou curto além do normal em ${pct(breakdown.underflickRate)}: tendência de sens alta.`
      )
    } else if (overUnderBias < 0) {
      reasons.push(
        `Você ficou curto além do normal em ${pct(breakdown.underflickRate)} dos flicks e passou do alvo em ${pct(breakdown.overflickRate)}: tendência de sens baixa.`
      )
    } else {
      reasons.push(
        `Passou do alvo em ${pct(breakdown.overflickRate)} e ficou curto em ${pct(breakdown.underflickRate)} dos flicks: dentro do normal.`
      )
    }
  }

  if (breakdown.gainMean !== null && gainBias !== null) {
    const g = Math.round(breakdown.gainMean * 100)
    if (gainBias > 0) {
      reasons.push(`O impulso principal percorre em média ${g}% da distância, acima da faixa normal (86% a 98%): a mão passa do ponto, sinal de sens alta.`)
    } else if (gainBias < 0) {
      reasons.push(`O impulso principal percorre em média ${g}% da distância, abaixo da faixa normal (86% a 98%): a mão para cedo demais, sinal de sens baixa.`)
    } else {
      reasons.push(`O impulso principal percorre em média ${g}% da distância, dentro da faixa normal de uma mão calibrada.`)
    }
  }

  if (trackBias > 0.1) {
    reasons.push('No tracking sua mira ficou oscilando de um lado pro outro do alvo: sinal de sens alta.')
  } else if (trackBias < -0.1) {
    reasons.push('No tracking sua mira ficou atrás do alvo sem alcançá-lo: sinal de sens baixa.')
  }

  if (reasons.length === 0) {
    reasons.push('Tracking equilibrado: nenhum sinal claro pra subir ou descer.')
  }

  return { multiplier, reasons, breakdown }
}

/** Faixa de cm por volta (360°) em que fica praticamente todo jogador de FPS. */
export const CM360_SLOWEST = 80
export const CM360_FASTEST = 15

/**
 * Não deixa a recomendação levar a sens pra fora da faixa plausível: abaixo de tão lenta ela não
 * desce, acima de tão rápida não sobe. Protege contra um viés pequeno que se acumula retestando.
 */
export function guardMultiplier(
  currentSens: number,
  multiplier: number,
  game: GameId,
  dpi: number
): { multiplier: number; limited: 'slow' | 'fast' | null } {
  const cm = gameCm360(dpi, currentSens, game)
  // Multiplicar a sens por m divide os cm por volta por m.
  if (multiplier < 1) {
    const floor = Math.min(1, cm / CM360_SLOWEST)
    if (multiplier < floor) return { multiplier: floor, limited: 'slow' }
  } else if (multiplier > 1) {
    const ceil = Math.max(1, cm / CM360_FASTEST)
    if (multiplier > ceil) return { multiplier: ceil, limited: 'fast' }
  }
  return { multiplier, limited: null }
}

export function suggestAdjustment(result: AimTestResult, referenceAngularRadiusDeg: number): AdjustmentSuggestion {
  return recommendAdjustment([result.flick, result.gridshot, result.tracking].map(evidenceOf), referenceAngularRadiusDeg)
}
