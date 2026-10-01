import * as THREE from 'three'
import type { MotorStats } from './motor'

export type HitPart = 'target' | 'head' | 'body'

export interface Pose {
  yawDeg: number
  pitchDeg: number
}

export interface Target {
  id: number
  root: THREE.Object3D
  hitboxes: THREE.Mesh[]
  /** Raio (mundo) da parte que conta como acerto — usado pra tolerância angular. */
  radius: number
  aimPoint: () => THREE.Vector3
  spawnFrame: number
  spawnedAt: number
  expiresAt: number | null
  /** angleHistory[k] = yaw/pitch do aimPoint visto da câmera no frame spawnFrame + k. */
  angleHistory: Pose[]
  /** Em modo hold: ms de mira em cima necessários pra destruir. */
  hp: number
  tag: string
  slot: number
  vel: THREE.Vector3 | null
}

export interface SpawnOpts {
  position: THREE.Vector3
  kind?: 'sphere' | 'bot'
  radius?: number
  lifetimeMs?: number
  hp?: number
  tag?: string
  slot?: number
  vel?: THREE.Vector3 | null
}

export interface ScenarioContext {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  now: number
  elapsedMs: number
  targets: Target[]
  spawn(opts: SpawnOpts): Target
  end(): void
}

export type Scoring = 'ultimate' | 'precision' | 'speed' | 'standard'
export type FireMode = 'click' | 'hold' | 'passive'

export interface ScenarioDef<S = unknown> {
  id: string
  name: string
  variant: 'Ultimate' | 'Precision' | 'Speed' | 'Standard'
  skill: string
  description: string
  scoring: Scoring
  /** click: um clique destrói; hold: segurar o botão em cima drena hp; passive: só mirar. */
  mode: FireMode
  durationMs?: number
  /** Termina quando essa quantidade de alvos for destruída ou expirar. */
  targetCount?: number
  init(ctx: ScenarioContext): S
  update?(ctx: ScenarioContext, state: S, dtSec: number): void
  onKill?(ctx: ScenarioContext, state: S, target: Target): void
  onExpire?(ctx: ScenarioContext, state: S, target: Target): void
}

export interface TrackingResult {
  coverage: number
  avgErrorDeg: number
  crossingsPerSec: number
}

export interface ScenarioResult {
  id: string
  name: string
  variant: string
  score: number
  shots: number
  kills: number
  targetsResolved: number
  accuracy: number
  avgTtkMs: number
  flicksAnalyzed: number
  overflickRate: number
  avgOverflickDeg: number
  underflickRate: number
  avgUnderflickDeg: number
  /** Cinemática dos flicks; null em tracking ou com poucos flicks pra concluir algo. */
  motor: MotorStats | null
  tracking: TrackingResult | null
}
