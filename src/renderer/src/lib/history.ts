import type { ScenarioResult } from '../engine/types'
import { GameId, roundSens } from './sensitivity'

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
      : null
  }
  const all = [...loadHistory(), record].slice(-MAX_SESSIONS)
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // Sem storage: o histórico não persiste, mas a partida segue normal.
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
