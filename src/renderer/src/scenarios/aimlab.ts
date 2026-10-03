import * as THREE from 'three'
import { backWallPoint, wallPoint } from '../lib/range3d'
import { ScenarioContext, ScenarioDef } from '../engine/types'
import { CENTER_Y, freeCell, rand, randomWallPoint, wallGrid } from './common'
import { gridshot } from './sensFinder'

const ULTIMATE_MS = 60000
const CENTER = wallPoint(0, CENTER_Y + 0.4)

function randSign(): number {
  return Math.random() < 0.5 ? -1 : 1
}

// ---------- Spidershot / Spidershot180 ----------
// Centro → alvo aleatório de vida curta → centro. No 180, o alvo aleatório fica atrás.

function spidershot(behind: boolean): ScenarioDef<null> {
  const radius = 0.45
  const spawnCenter = (ctx: ScenarioContext): void => {
    ctx.spawn({ position: CENTER, radius, tag: 'center' })
  }
  const spawnSide = (ctx: ScenarioContext): void => {
    const position = behind
      ? backWallPoint(rand(-7, 7), rand(0.8, 5))
      : randomWallPoint(9, 0.8, 5, CENTER, 2.5)
    ctx.spawn({ position, radius, lifetimeMs: behind ? 1800 : 1500, tag: 'side' })
  }

  return {
    id: behind ? 'spidershot180-ultimate' : 'spidershot-ultimate',
    name: behind ? 'Spidershot180 Ultimate' : 'Spidershot Ultimate',
    variant: 'Ultimate',
    skill: 'Flick',
    description: behind
      ? 'Destrua o alvo do centro; o próximo aparece atrás de você por pouco tempo. Flick de 180° a cada tiro.'
      : 'Destrua o alvo do centro; o próximo aparece numa direção aleatória por pouco tempo. Deixar ele sumir tira pontos.',
    scoring: 'ultimate',
    mode: 'click',
    durationMs: ULTIMATE_MS,
    init(ctx) {
      spawnCenter(ctx)
      return null
    },
    onKill(ctx, _s, t) {
      if (t.tag === 'center') spawnSide(ctx)
      else spawnCenter(ctx)
    },
    onExpire(ctx) {
      spawnCenter(ctx)
    }
  }
}

// ---------- Microshot Ultimate / Precision ----------
// Centro → alvo pequeno perto do centro. A vida do alvo se adapta: encurta quando você
// acerta, alonga quando deixa escapar.

interface MicroState {
  lifeMs: number
}

function microshot(variant: 'Ultimate' | 'Precision'): ScenarioDef<MicroState> {
  const precision = variant === 'Precision'
  const sideRadius = precision ? 0.2 : 0.26
  const minLife = precision ? 900 : 600

  const spawnCenter = (ctx: ScenarioContext): void => {
    ctx.spawn({ position: CENTER, radius: 0.35, tag: 'center' })
  }

  return {
    id: precision ? 'microshot-precision' : 'microshot-ultimate',
    name: `Microshot ${variant}`,
    variant,
    skill: 'Precisão',
    description: precision
      ? 'Micro-ajustes: centro → alvo minúsculo bem perto. Errar custa caro e a pontuação final é multiplicada pela sua precisão.'
      : 'Micro-ajustes: centro → alvo pequeno bem perto, com tempo de vida que se adapta ao seu desempenho.',
    scoring: precision ? 'precision' : 'ultimate',
    mode: 'click',
    durationMs: ULTIMATE_MS,
    init(ctx) {
      spawnCenter(ctx)
      return { lifeMs: 1400 }
    },
    onKill(ctx, s, t) {
      if (t.tag === 'center') {
        const position = CENTER.clone()
        for (let attempt = 0; attempt < 12; attempt++) {
          // Até 1,5 abaixo do centro (altura 2,0): mais que isso o alvo encosta no piso.
          position.set(CENTER.x + rand(-3.5, 3.5), CENTER.y + rand(-1.5, 2), CENTER.z)
          if (position.distanceTo(CENTER) >= 1.2) break
        }
        ctx.spawn({ position, radius: sideRadius, lifetimeMs: s.lifeMs, tag: 'side' })
      } else {
        s.lifeMs = Math.max(minLife, s.lifeMs * 0.95)
        spawnCenter(ctx)
      }
    },
    onExpire(ctx, s) {
      s.lifeMs = Math.min(2200, s.lifeMs * 1.12)
      spawnCenter(ctx)
    }
  }
}

// ---------- Sixshot Ultimate ----------
// 6 alvos minúsculos numa grade 8x8.

const SIX_CELLS = wallGrid(8, 8, 0.9, 0.6, CENTER_Y + 0.8)

const sixshotUltimate: ScenarioDef<null> = {
  id: 'sixshot-ultimate',
  name: 'Sixshot Ultimate',
  variant: 'Ultimate',
  skill: 'Precisão',
  description: '6 alvos bem pequenos numa grade 8x8. Destrua o mais rápido possível — cada um que cai renasce numa célula livre.',
  scoring: 'ultimate',
  mode: 'click',
  durationMs: ULTIMATE_MS,
  init(ctx) {
    for (let i = 0; i < 6; i++) {
      const cell = freeCell(SIX_CELLS.length, ctx.targets.map((t) => t.slot))
      ctx.spawn({ position: SIX_CELLS[cell], radius: 0.2, slot: cell })
    }
    return null
  },
  onKill(ctx, _s, t) {
    const cell = freeCell(SIX_CELLS.length, ctx.targets.map((x) => x.slot), t.slot)
    ctx.spawn({ position: SIX_CELLS[cell], radius: 0.2, slot: cell })
  }
}

// ---------- Alvos em movimento (Motionshot, Switchtrack) ----------

const MOVE_X = 10
const MOVE_Y_MIN = 0.6
const MOVE_Y_MAX = 5.5

function moveAndBounce(ctx: ScenarioContext, dt: number): void {
  for (const t of ctx.targets) {
    if (!t.vel) continue
    const p = t.root.position
    p.addScaledVector(t.vel, dt)
    if (Math.abs(p.x) > MOVE_X) {
      p.x = Math.sign(p.x) * MOVE_X
      t.vel.x = -t.vel.x
    }
    if (p.y < MOVE_Y_MIN || p.y > MOVE_Y_MAX) {
      p.y = Math.min(MOVE_Y_MAX, Math.max(MOVE_Y_MIN, p.y))
      t.vel.y = -t.vel.y
    }
  }
}

// ---------- Motionshot Speed ----------
// Centro → alvo que se move numa direção aleatória por pouco tempo.

const motionshotSpeed: ScenarioDef<null> = {
  id: 'motionshot-speed',
  name: 'Motionshot Speed',
  variant: 'Speed',
  skill: 'Flick',
  description: 'Destrua o centro; o próximo alvo nasce se movendo numa direção aleatória e some rápido. Pontua mais quem mata mais rápido.',
  scoring: 'speed',
  mode: 'click',
  durationMs: ULTIMATE_MS,
  init(ctx) {
    ctx.spawn({ position: CENTER, radius: 0.45, tag: 'center' })
    return null
  },
  update(ctx, _s, dt) {
    moveAndBounce(ctx, dt)
  },
  onKill(ctx, _s, t) {
    if (t.tag === 'center') {
      const angle = rand(0, Math.PI * 2)
      const speed = rand(3, 5)
      ctx.spawn({
        position: randomWallPoint(7, 1, 4.5, CENTER, 2.5),
        radius: 0.4,
        lifetimeMs: 1600,
        tag: 'moving',
        vel: new THREE.Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed, 0)
      })
    } else {
      ctx.spawn({ position: CENTER, radius: 0.45, tag: 'center' })
    }
  },
  onExpire(ctx) {
    ctx.spawn({ position: CENTER, radius: 0.45, tag: 'center' })
  }
}

// ---------- Linetrace Ultimate ----------
// Interpretação própria (não há descrição pública da mecânica exata): sequências de alvos
// pequenos ao longo de uma linha, com passos curtos entre eles; ao fim de cada linha, um flick
// pra começo da próxima.

interface LineState {
  last: THREE.Vector2
  dir: THREE.Vector2
  left: number
}

const LINE_STEP = 0.9
const LINE_LENGTH = 6

function nextLinePoint(s: LineState): THREE.Vector2 {
  if (s.left > 0) {
    const next = s.last.clone().addScaledVector(s.dir, LINE_STEP)
    if (Math.abs(next.x) <= 9 && next.y >= 0.7 && next.y <= 5.2) {
      s.last = next
      s.left -= 1
      return next
    }
  }
  const angle = rand(0, Math.PI * 2)
  s.last = new THREE.Vector2(rand(-7, 7), rand(1, 4.5))
  s.dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle))
  s.left = LINE_LENGTH - 1
  return s.last
}

const linetraceUltimate: ScenarioDef<LineState> = {
  id: 'linetrace-ultimate',
  name: 'Linetrace Ultimate',
  variant: 'Ultimate',
  skill: 'Precisão',
  description: 'Alvos pequenos aparecem um de cada vez ao longo de uma linha, bem próximos. Ao fim de cada linha, flick pro começo da próxima. Recompensa precisão controlada, não pressa.',
  scoring: 'ultimate',
  mode: 'click',
  durationMs: ULTIMATE_MS,
  init(ctx) {
    const s: LineState = { last: new THREE.Vector2(), dir: new THREE.Vector2(1, 0), left: 0 }
    const p = nextLinePoint(s)
    ctx.spawn({ position: wallPoint(p.x, p.y), radius: 0.28 })
    return s
  },
  onKill(ctx, s) {
    const p = nextLinePoint(s)
    ctx.spawn({ position: wallPoint(p.x, p.y), radius: 0.28 })
  }
}

// ---------- Switchtrack Ultimate ----------
// 3 alvos em alturas diferentes se movendo na horizontal. Segure o tiro em cima de um até
// destruir e troque pro próximo.

const SWITCH_ROWS = [1.3, 2.6, 3.9]

interface SwitchState {
  nextTurn: Map<number, number>
}

function spawnSwitchRow(ctx: ScenarioContext, row: number): void {
  ctx.spawn({
    position: wallPoint(rand(-7, 7), SWITCH_ROWS[row]),
    radius: 0.45,
    hp: 700,
    slot: row,
    vel: new THREE.Vector3(randSign() * rand(2, 4), 0, 0)
  })
}

const switchtrackUltimate: ScenarioDef<SwitchState> = {
  id: 'switchtrack-ultimate',
  name: 'Switchtrack Ultimate',
  variant: 'Ultimate',
  skill: 'Tracking',
  description: '3 alvos em alturas diferentes mudando de direção. Segure o tiro em cima de um até destruir e troque pro próximo o mais rápido possível.',
  scoring: 'ultimate',
  mode: 'hold',
  durationMs: ULTIMATE_MS,
  init(ctx) {
    SWITCH_ROWS.forEach((_, row) => spawnSwitchRow(ctx, row))
    return { nextTurn: new Map() }
  },
  update(ctx, s, dt) {
    for (const t of ctx.targets) {
      if (!t.vel) continue
      const turnAt = s.nextTurn.get(t.id)
      if (turnAt === undefined || ctx.now >= turnAt) {
        if (turnAt !== undefined) t.vel.x = randSign() * rand(2, 4.5)
        s.nextTurn.set(t.id, ctx.now + rand(600, 1500))
      }
    }
    moveAndBounce(ctx, dt)
  },
  onKill(ctx, s, t) {
    s.nextTurn.delete(t.id)
    spawnSwitchRow(ctx, t.slot)
  }
}

// ---------- HeadshotReflex Standard ----------
// Bot aparece depois de um intervalo aleatório e some rápido. Só headshot conta.

interface ReflexState {
  spawned: number
  nextAt: number
}

const REFLEX_BOTS = 20

const headshotReflexStandard: ScenarioDef<ReflexState> = {
  id: 'headshotreflex-standard',
  name: 'HeadshotReflex Standard',
  variant: 'Standard',
  skill: 'Reflexo',
  description: `${REFLEX_BOTS} bots aparecem em posições e momentos aleatórios e somem rápido. Só tiro na cabeça conta — acertar o corpo é erro.`,
  scoring: 'standard',
  mode: 'click',
  targetCount: REFLEX_BOTS,
  init(ctx) {
    return { spawned: 0, nextAt: ctx.now + 800 }
  },
  update(ctx, s) {
    if (ctx.targets.length > 0 || s.spawned >= REFLEX_BOTS || ctx.now < s.nextAt) return
    s.spawned += 1
    ctx.spawn({
      kind: 'bot',
      position: new THREE.Vector3(rand(-6, 6), 0, -rand(5, 10)),
      lifetimeMs: 1300
    })
  },
  onKill(ctx, s) {
    s.nextAt = ctx.now + rand(400, 1000)
  },
  onExpire(ctx, s) {
    s.nextAt = ctx.now + rand(400, 1000)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LIBRARY: ScenarioDef<any>[] = [
  microshot('Precision'),
  linetraceUltimate,
  spidershot(false),
  spidershot(true),
  switchtrackUltimate,
  sixshotUltimate,
  microshot('Ultimate'),
  motionshotSpeed,
  headshotReflexStandard,
  gridshot('gridshot-ultimate', 'Gridshot Ultimate', 'Ultimate', ULTIMATE_MS)
]

