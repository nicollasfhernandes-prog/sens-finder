import * as THREE from 'three'
import { HitPart } from './types'

function targetMaterial(color: string): THREE.MeshStandardMaterial {
  const base = new THREE.Color(color)
  const material = new THREE.MeshStandardMaterial({
    color: base,
    emissive: base.clone().multiplyScalar(0.25),
    roughness: 0.4
  })
  material.userData.idleEmissive = material.emissive.clone()
  material.userData.hitEmissive = base.clone().lerp(new THREE.Color(0xffffff), 0.5)
  return material
}

export function setHighlighted(hitboxes: THREE.Mesh[], on: boolean): void {
  for (const h of hitboxes) {
    if (h.userData.part === 'body') continue
    const material = h.material as THREE.MeshStandardMaterial
    material.emissive.copy(on ? material.userData.hitEmissive : material.userData.idleEmissive)
  }
}

const BOT_BODY_RADIUS = 0.28
const BOT_BODY_LENGTH = 0.9
export const BOT_HEAD_RADIUS = 0.16
const BOT_HEAD_Y = BOT_BODY_RADIUS * 2 + BOT_BODY_LENGTH + BOT_HEAD_RADIUS + 0.02

export interface BuiltTarget {
  root: THREE.Object3D
  hitboxes: THREE.Mesh[]
  aimOffset: THREE.Vector3
  radius: number
}

function tag(mesh: THREE.Mesh, part: HitPart): THREE.Mesh {
  mesh.userData.part = part
  return mesh
}

export function buildSphere(radius: number, color: string): BuiltTarget {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 24), targetMaterial(color))
  const root = new THREE.Group()
  root.add(tag(mesh, 'target'))
  return { root, hitboxes: [mesh], aimOffset: new THREE.Vector3(), radius }
}

/** Bot com os pés na origem do grupo. Só a cabeça conta como acerto. */
export function buildBot(headColor: string): BuiltTarget {
  const root = new THREE.Group()

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(BOT_BODY_RADIUS, BOT_BODY_LENGTH, 6, 16),
    new THREE.MeshStandardMaterial({ color: 0x4b5263, roughness: 0.8 })
  )
  body.position.y = BOT_BODY_RADIUS + BOT_BODY_LENGTH / 2
  root.add(tag(body, 'body'))

  const head = new THREE.Mesh(new THREE.SphereGeometry(BOT_HEAD_RADIUS, 20, 20), targetMaterial(headColor))
  head.position.y = BOT_HEAD_Y
  root.add(tag(head, 'head'))

  return {
    root,
    hitboxes: [head, body],
    aimOffset: new THREE.Vector3(0, BOT_HEAD_Y, 0),
    radius: BOT_HEAD_RADIUS
  }
}

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      const material = child.material as THREE.Material | THREE.Material[]
      if (Array.isArray(material)) material.forEach((m) => m.dispose())
      else material.dispose()
    }
  })
}
