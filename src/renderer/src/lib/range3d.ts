import * as THREE from 'three'

export const EYE_HEIGHT = 1.6
export const FOV_DEG = 103

export const WALL_DISTANCE = 12
const WALL_WIDTH = 30
const WALL_HEIGHT = 12
const TARGET_WALL_OFFSET = 0.7

/** Distância da câmera até o plano onde os alvos ficam (levemente à frente da parede). */
export const TARGET_DEPTH = WALL_DISTANCE - TARGET_WALL_OFFSET

export interface RangeEnv {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
}

export interface RangeTheme {
  background: string
  wall: string
}

function makeWallGrid(side: 1 | -1, color: THREE.Color): THREE.LineSegments {
  const points: number[] = []
  const z = side * (WALL_DISTANCE - 0.01)
  const halfW = WALL_WIDTH / 2
  for (let x = -halfW; x <= halfW; x += 1) {
    points.push(x, 0, z, x, WALL_HEIGHT, z)
  }
  for (let y = 0; y <= WALL_HEIGHT; y += 1) {
    points.push(-halfW, y, z, halfW, y, z)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color }))
}

export function createRangeEnv(container: HTMLDivElement, theme: RangeTheme): RangeEnv {
  const width = container.clientWidth
  const height = container.clientHeight

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const bg = new THREE.Color(theme.background)
  scene.background = bg
  scene.fog = new THREE.Fog(bg, 25, 60)

  const wallColor = new THREE.Color(theme.wall)
  const lineColor = wallColor.clone().lerp(new THREE.Color(0xffffff), 0.12)
  const floorColor = wallColor.clone().lerp(bg, 0.5)

  const camera = new THREE.PerspectiveCamera(FOV_DEG, height > 0 ? width / height : 16 / 9, 0.1, 1000)
  camera.position.set(0, EYE_HEIGHT, 0)
  camera.rotation.order = 'YXZ'

  scene.add(new THREE.HemisphereLight(0xffffff, 0x30303a, 1.1))
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6)
  dirLight.position.set(5, 10, 5)
  scene.add(dirLight)

  const grid = new THREE.GridHelper(80, 40, lineColor, lineColor.clone().lerp(floorColor, 0.5))
  scene.add(grid)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: floorColor, roughness: 1 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.01
  scene.add(floor)

  const wallMaterial = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 1 })
  const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(WALL_WIDTH, WALL_HEIGHT), wallMaterial)
  frontWall.position.set(0, WALL_HEIGHT / 2, -WALL_DISTANCE)
  scene.add(frontWall)
  scene.add(makeWallGrid(-1, lineColor))

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(WALL_WIDTH, WALL_HEIGHT), wallMaterial)
  backWall.position.set(0, WALL_HEIGHT / 2, WALL_DISTANCE)
  backWall.rotation.y = Math.PI
  scene.add(backWall)
  scene.add(makeWallGrid(1, lineColor))

  return { renderer, scene, camera }
}

export function disposeRangeEnv(env: RangeEnv, container: HTMLDivElement): void {
  env.renderer.dispose()
  if (env.renderer.domElement.parentElement === container) {
    container.removeChild(env.renderer.domElement)
  }
}

/** Ponto na frente da parede, em coordenadas da parede (x horizontal, y altura). */
export function wallPoint(x: number, y: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, -TARGET_DEPTH)
}

/** Mesmo que wallPoint, mas na parede de trás (x cresce pra esquerda de quem olha pra frente). */
export function backWallPoint(x: number, y: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, TARGET_DEPTH)
}
