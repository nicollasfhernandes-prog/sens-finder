import * as THREE from 'three'
import { EYE_HEIGHT, wallPoint } from '../lib/range3d'

export const CENTER_Y = EYE_HEIGHT

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

/** Ponto aleatório na parede da frente, a pelo menos minDist de `avoid` (quando dado). */
export function randomWallPoint(
  xRange: number,
  yMin: number,
  yMax: number,
  avoid?: THREE.Vector3,
  minDist = 0
): THREE.Vector3 {
  let p = wallPoint(0, (yMin + yMax) / 2)
  for (let attempt = 0; attempt < 12; attempt++) {
    p = wallPoint(rand(-xRange, xRange), rand(yMin, yMax))
    if (!avoid || p.distanceTo(avoid) >= minDist) break
  }
  return p
}

/** Grade de células na parede da frente, centrada horizontalmente em x = 0. */
export function wallGrid(cols: number, rows: number, spacingX: number, spacingY: number, centerY: number): THREE.Vector3[] {
  const cells: THREE.Vector3[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push(
        wallPoint((col - (cols - 1) / 2) * spacingX, centerY + (row - (rows - 1) / 2) * spacingY)
      )
    }
  }
  return cells
}

export function freeCell(cellCount: number, occupied: number[], exclude = -1): number {
  const free: number[] = []
  for (let i = 0; i < cellCount; i++) {
    if (!occupied.includes(i) && i !== exclude) free.push(i)
  }
  return pick(free)
}
