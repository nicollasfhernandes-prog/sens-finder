import type { ScenarioResult } from '../engine/types'
import { Evidence, evidenceOf, GameId, roundSens } from './sensitivity'

export interface SessionRecord {
  at: number
  scenarioId: string
  scenarioName: string
  game: GameId
  sens: number
  dpi: number
  score: number
  accuracy: number
  /** null em cenários de tracking ou com poucos flicks. */
  motor: {
    score: number
    gainMean: number
    gainSd: number
    peakCmS: number
    reactionMs: number
    flicks: number
  } | null
  /** Resumo usado pela recomendação em bateria (ausente em partidas de versões antigas). */
  evidence?: Evidence
}

const KEY = 'vsf.history.v1'
const MAX_SESSIONS = 500

export function loadHistory(): SessionRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as SessionRecord[]) : []
  } catch {
    return []
  }
}

export function recordSession(r: ScenarioResult, ctx: { game: GameId; sens: number; dpi: number }): void {
  const record: SessionRecord = {
    at: Date.now(),
    scenarioId: r.id,
    scenarioName: r.name,
    game: ctx.game,
    sens: roundSens(ctx.sens, ctx.game),
    dpi: ctx.dpi,
    score: r.score,
    accuracy: r.accuracy,
    motor: r.motor
      ? {
          score: r.motor.score,
          gainMean: r.motor.gainMean,
          gainSd: r.motor.gainSd,
          peakCmS: r.motor.avgPeakSpeedCmS,
          reactionMs: r.motor.avgReactionMs,
          flicks: r.motor.flicks.length
        }
      : null,
    evidence: evidenceOf(r)
  }
  const all = [...loadHistory(), record].slice(-MAX_SESSIONS)
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // Sem storage: o histórico não persiste, mas a partida segue normal.
  }
}

/** Partidas necessárias com a mesma sens antes de recomendar, e quantas no máximo entram. */
export const BATTERY_MIN_SESSIONS = 3
const BATTERY_MAX_SESSIONS = 5
export const BATTERY_MIN_FLICKS = 60

export interface Battery {
  evidence: Evidence[]
  sessions: number
  flicks: number
  ready: boolean
}

/**
 * Junta as partidas mais recentes jogadas com esta sens (mesmo jogo e DPI). Trocar de sens
 * começa uma bateria nova — por isso a recomendação não se acumula partida após partida.
 */
export function currentBattery(records: SessionRecord[], game: GameId, dpi: number, sens: number): Battery {
  const target = roundSens(sens, game)
  const same = records
    .filter((r) => r.evidence && r.game === game && r.dpi === dpi && r.sens === target)
    .slice(-BATTERY_MAX_SESSIONS)
  const evidence = same.map((r) => r.evidence!)
  const flicks = evidence.reduce((s, e) => s + e.flicksAnalyzed, 0)
  const trackingOnly = evidence.length > 0 && evidence.every((e) => e.flicksAnalyzed === 0)
  return {
    evidence,
    sessions: evidence.length,
    flicks,
    ready: evidence.length >= BATTERY_MIN_SESSIONS && (flicks >= BATTERY_MIN_FLICKS || trackingOnly)
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nada a limpar.
  }
}

export interface SensSummary {
  sens: number
  sessions: number
  /** Partidas com dados de movimento suficientes. */
  motorSessions: number
  motorScore: number | null
  gainMean: number | null
  gainSd: number | null
  accuracy: number
  lastAt: number
}

function mean(v: number[]): number {
  return v.reduce((a, b) => a + b, 0) / v.length
}

/** Agrupa as partidas de um jogo pela sens usada (mesmo DPI), da menor pra maior sens. */
export function summarizeBySens(records: SessionRecord[], game: GameId, dpi: number): SensSummary[] {
  const groups = new Map<number, SessionRecord[]>()
  for (const r of records) {
    if (r.game !== game || r.dpi !== dpi) continue
    groups.set(r.sens, [...(groups.get(r.sens) ?? []), r])
  }
  return [...groups.entries()]
    .map(([sens, rs]) => {
      const withMotor = rs.filter((r) => r.motor !== null)
      return {
        sens,
        sessions: rs.length,
        motorSessions: withMotor.length,
        motorScore: withMotor.length ? mean(withMotor.map((r) => r.motor!.score)) : null,
        gainMean: withMotor.length ? mean(withMotor.map((r) => r.motor!.gainMean)) : null,
        gainSd: withMotor.length ? mean(withMotor.map((r) => r.motor!.gainSd)) : null,
        accuracy: mean(rs.map((r) => r.accuracy)),
        lastAt: Math.max(...rs.map((r) => r.at))
      }
    })
    .sort((a, b) => a.sens - b.sens)
}
