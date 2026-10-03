import * as THREE from 'three'
import { TARGET_DEPTH, wallPoint } from '../lib/range3d'
import { radToDeg } from '../lib/trajectory'
import { ScenarioContext, ScenarioDef } from '../engine/types'
import { CENTER_Y, freeCell, rand, randomWallPoint, wallGrid } from './common'

const TARGET_RADIUS = 0.55

/** Raio angular do alvo padrão da bateria — referência de escala pro cálculo de ajuste. */
export const REFERENCE_TARGET_ANGULAR_RADIUS_DEG = radToDeg(Math.atan(TARGET_RADIUS / TARGET_DEPTH))

const FLICK_TARGETS = 12

interface FlickState {
  spawned: number
  last: THREE.Vector3 | null
}

function spawnFlick(ctx: ScenarioContext, s: FlickState): void {
  if (s.spawned >= FLICK_TARGETS) return
  const position = randomWallPoint(8, 0.8, 4.8, s.last ?? undefined, 3)
  s.last = position
  s.spawned += 1
  ctx.spawn({ position, radius: TARGET_RADIUS, lifetimeMs: 4000 })
}

export const sensFinderFlick: ScenarioDef<FlickState> = {
  id: 'sf-flick',
  name: 'Flick',
  variant: 'Standard',
  skill: 'Flick',
  description: `${FLICK_TARGETS} alvos, um de cada vez, em posições aleatórias da parede.`,
  scoring: 'standard',
  mode: 'click',
  targetCount: FLICK_TARGETS,
  init(ctx) {
    const s: FlickState = { spawned: 0, last: null }
    spawnFlick(ctx, s)
    return s
  },
  onKill: spawnFlick,
  onExpire: spawnFlick
}

// Fileiras em 0,8 / 2,3 / 3,8: a de baixo fica inteira acima do piso (raio do alvo 0,55).
const GRID_CELLS = wallGrid(3, 3, 2.4, 1.5, CENTER_Y + 0.7)

export function gridshot(id: string, name: string, variant: 'Ultimate' | 'Standard', durationMs: number): ScenarioDef<null> {
  return {
    id,
    name,
    variant,
    skill: 'Flick',
    description: '3 alvos ao mesmo tempo numa grade 3x3. Assim que um cai, outro nasce numa célula livre.',
    scoring: variant === 'Ultimate' ? 'ultimate' : 'standard',
    mode: 'click',
    durationMs,
    init(ctx) {
      for (let i = 0; i < 3; i++) {
        const cell = freeCell(GRID_CELLS.length, ctx.targets.map((t) => t.slot))
        ctx.spawn({ position: GRID_CELLS[cell], radius: TARGET_RADIUS, slot: cell })
      }
      return null
    },
    onKill(ctx, _s, t) {
      const cell = freeCell(GRID_CELLS.length, ctx.targets.map((x) => x.slot), t.slot)
      ctx.spawn({ position: GRID_CELLS[cell], radius: TARGET_RADIUS, slot: cell })
    }
  }
}

export const sensFinderGridshot = gridshot('sf-gridshot', 'Gridshot', 'Standard', 20000)

interface WanderState {
  waypoint: THREE.Vector2
  pos: THREE.Vector2
}

export const sensFinderTracking: ScenarioDef<WanderState> = {
  id: 'sf-tracking',
  name: 'Tracking',
  variant: 'Standard',
  skill: 'Tracking',
  description: 'Um alvo se move continuamente pela parede. Mantenha a mira em cima dele.',
  scoring: 'standard',
  mode: 'passive',
  durationMs: 10000,
  init(ctx) {
    const pos = new THREE.Vector2(0, CENTER_Y)
    ctx.spawn({ position: wallPoint(pos.x, pos.y), radius: TARGET_RADIUS })
    return { pos, waypoint: new THREE.Vector2(rand(-6, 6), rand(1, 4)) }
  },
  update(ctx, s, dt) {
    const toWp = s.waypoint.clone().sub(s.pos)
    const dist = toWp.length()
    if (dist < 0.2) {
      s.waypoint.set(rand(-6, 6), rand(1, 4))
    } else {
      s.pos.add(toWp.multiplyScalar(Math.min(6 * dt, dist) / dist))
    }
    ctx.targets[0]?.root.position.copy(wallPoint(s.pos.x, s.pos.y))
  }
}
