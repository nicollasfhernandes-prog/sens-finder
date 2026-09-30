import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GAMES } from '../lib/sensitivity'
import { createRangeEnv, disposeRangeEnv } from '../lib/range3d'
import { normalizeDeg, radToDeg, sphericalOf } from '../lib/trajectory'
import { MetricsRecorder } from './metrics'
import { buildBot, buildSphere, disposeObject, setHighlighted } from './targets'
import { HitPart, Pose, ScenarioContext, ScenarioDef, ScenarioResult, Target } from './types'
import Crosshair from '../components/Crosshair'
import { useSettings } from '../settings'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  def: ScenarioDef<any>
  sens: number
  onComplete: (result: ScenarioResult) => void
  onAbort: () => void
  stepLabel?: string
}

const PITCH_LIMIT = THREE.MathUtils.degToRad(89)
const DEFAULT_RADIUS = 0.5

interface Hud {
  remaining: string
  score: number
  accuracy: number
}

function formatRemaining(ms: number): string {
  return `${Math.ceil(ms / 1000)}s`
}

export default function ScenarioRunner({ def, sens, onComplete, onAbort, stepLabel }: Props): JSX.Element {
  const { settings } = useSettings()
  const mountRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'ready' | 'running'>('ready')
  const [hud, setHud] = useState<Hud>({ remaining: '', score: 0, accuracy: 1 })
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (phase !== 'running' || !mountRef.current) return
    const container = mountRef.current
    window.api?.setFullscreen(true)

    const env = createRangeEnv(container, { background: settings.backgroundColor, wall: settings.wallColor })
    const targetColor = settings.targetColor
    const { renderer, scene, camera } = env
    const raycaster = new THREE.Raycaster()
    const radPerCount = sens * GAMES[settings.game].yaw * (Math.PI / 180)
    const camPos = camera.position

    let yaw = 0
    let pitch = 0
    let firing = false
    let ended = false
    let frame = 0
    let nextId = 1
    let animId = 0
    let lastHudAt = 0
    let startedAt = performance.now()
    let lastT = startedAt

    let rec = new MetricsRecorder(def.scoring, def.mode, startedAt)
    const targets: Target[] = []

    const pose = (): Pose => ({ yawDeg: radToDeg(yaw), pitchDeg: radToDeg(pitch) })
    const angleOf = (p: THREE.Vector3): Pose => sphericalOf(camPos.x, camPos.y, camPos.z, p.x, p.y, p.z)
    const radiusDeg = (t: Target): number => radToDeg(Math.atan(t.radius / t.aimPoint().distanceTo(camPos)))

    function removeTarget(t: Target): void {
      const i = targets.indexOf(t)
      if (i === -1) return
      targets.splice(i, 1)
      scene.remove(t.root)
      disposeObject(t.root)
    }

    const ctx: ScenarioContext = {
      scene,
      camera,
      now: startedAt,
      elapsedMs: 0,
      targets,
      spawn(opts) {
        const built =
          opts.kind === 'bot' ? buildBot(targetColor) : buildSphere(opts.radius ?? DEFAULT_RADIUS, targetColor)
        built.root.position.copy(opts.position)
        scene.add(built.root)
        const t: Target = {
          id: nextId++,
          root: built.root,
          hitboxes: built.hitboxes,
          radius: built.radius,
          aimPoint: () => built.root.position.clone().add(built.aimOffset),
          spawnFrame: frame,
          spawnedAt: ctx.now,
          expiresAt: opts.lifetimeMs ? ctx.now + opts.lifetimeMs : null,
          angleHistory: [],
          hp: opts.hp ?? 0,
          tag: opts.tag ?? '',
          slot: opts.slot ?? -1,
          vel: opts.vel ?? null
        }
        t.angleHistory.push(angleOf(t.aimPoint()))
        built.hitboxes.forEach((h) => (h.userData.target = t))
        targets.push(t)
        return t
      },
      end() {
        finish()
      }
    }

    function checkTargetCount(): void {
      if (def.targetCount !== undefined && rec.resolvedCount >= def.targetCount) finish()
    }

    function kill(t: Target): void {
      rec.recordKill(t, ctx.now, frame, pose(), radiusDeg(t))
      removeTarget(t)
      def.onKill?.(ctx, state, t)
      checkTargetCount()
    }

    function expire(t: Target): void {
      rec.recordExpire(t, ctx.now, frame, pose(), radiusDeg(t))
      removeTarget(t)
      def.onExpire?.(ctx, state, t)
      checkTargetCount()
    }

    function raycastCenter(): { target: Target; part: HitPart } | null {
      // Matrizes só são recalculadas no render; sem isso, um clique logo após um flick usaria
      // a mira (e as posições de alvo) do frame anterior.
      camera.updateMatrixWorld()
      scene.updateMatrixWorld()
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
      const hits = raycaster.intersectObjects(targets.flatMap((t) => t.hitboxes), false)
      if (hits.length === 0) return null
      const obj = hits[0].object
      return { target: obj.userData.target as Target, part: obj.userData.part as HitPart }
    }

    function finish(): void {
      if (ended) return
      ended = true
      cancelAnimationFrame(animId)
      const result = rec.result(def, ctx.now - startedAt)
      if (document.pointerLockElement) document.exitPointerLock()
      onCompleteRef.current(result)
    }

    rec.recordFrame(pose())
    let state = def.init(ctx)

    // Reinicia no lugar, sem desmontar a cena: sair e voltar do pointer lock exigiria outro
    // clique do jogador e piscaria a tela cheia.
    function restart(): void {
      for (const t of [...targets]) removeTarget(t)
      yaw = 0
      pitch = 0
      camera.rotation.set(0, 0, 0, 'YXZ')
      firing = false
      startedAt = performance.now()
      lastT = startedAt
      ctx.now = startedAt
      ctx.elapsedMs = 0
      frame = 0
      rec = new MetricsRecorder(def.scoring, def.mode, startedAt)
      rec.recordFrame(pose())
      state = def.init(ctx)
      lastHudAt = 0
    }

    function resize(): void {
      const w = container.clientWidth
      const h = container.clientHeight
      // Janela minimizada/oculta reporta 0x0; aspect NaN corromperia projeção e raycast.
      if (w === 0 || h === 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', resize)
    container.requestPointerLock()

    function onMouseMove(e: MouseEvent): void {
      if (!document.pointerLockElement || ended) return
      yaw -= e.movementX * radPerCount
      pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch - e.movementY * radPerCount))
      camera.rotation.set(pitch, yaw, 0, 'YXZ')
    }

    function onMouseDown(e: MouseEvent): void {
      if (e.button !== 0 || !document.pointerLockElement || ended) return
      firing = true
      if (def.mode !== 'click') return
      rec.recordShot()
      ctx.now = performance.now()
      const hit = raycastCenter()
      if (hit && hit.part !== 'body') kill(hit.target)
      else rec.recordMiss()
    }

    function onMouseUp(e: MouseEvent): void {
      if (e.button === 0) firing = false
    }

    function onKeyDown(e: KeyboardEvent): void {
      if (e.code === 'KeyR' && !e.repeat && !ended) restart()
    }

    function onPointerLockChange(): void {
      if (!document.pointerLockElement && !ended) {
        ended = true
        setPhase('ready')
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerlockchange', onPointerLockChange)

    function recordTracking(): void {
      let best: Target | null = null
      let bestErr = Infinity
      let bestYawErr = 0
      const cam = pose()
      for (const t of targets) {
        const a = t.angleHistory[t.angleHistory.length - 1]
        const yawErr = normalizeDeg(a.yawDeg - cam.yawDeg)
        const err = Math.hypot(yawErr, a.pitchDeg - cam.pitchDeg)
        if (err < bestErr) {
          best = t
          bestErr = err
          bestYawErr = yawErr
        }
      }
      if (!best) return
      rec.recordTracking({
        errDeg: bestErr,
        yawErrDeg: bestYawErr,
        radiusDeg: radiusDeg(best),
        targetId: best.id,
        firing
      })
    }

    function loop(): void {
      if (ended) return
      const now = performance.now()
      const dtSec = Math.min((now - lastT) / 1000, 0.05)
      lastT = now
      ctx.now = now
      ctx.elapsedMs = now - startedAt

      rec.recordFrame(pose())
      frame = rec.camPath.length - 1

      def.update?.(ctx, state, dtSec)
      for (const t of targets) {
        while (t.angleHistory.length <= frame - t.spawnFrame) t.angleHistory.push(angleOf(t.aimPoint()))
      }

      if (def.mode !== 'click') recordTracking()

      if (def.mode === 'hold') {
        const hit = firing ? raycastCenter() : null
        const damaged = hit && hit.part !== 'body' ? hit.target : null
        for (const t of targets) setHighlighted(t.hitboxes, t === damaged)
        if (damaged) {
          damaged.hp -= dtSec * 1000
          if (damaged.hp <= 0) kill(damaged)
        }
      }

      for (const t of [...targets]) {
        if (t.expiresAt !== null && now >= t.expiresAt) expire(t)
      }
      if (ended) return

      const remainingMs = def.durationMs !== undefined ? def.durationMs - ctx.elapsedMs : Infinity
      if (remainingMs <= 0) {
        finish()
        return
      }

      if (now - lastHudAt > 100) {
        lastHudAt = now
        setHud({
          remaining:
            def.durationMs !== undefined
              ? formatRemaining(remainingMs)
              : `${rec.resolvedCount}/${def.targetCount ?? 0}`,
          score: rec.liveScore,
          accuracy: rec.liveAccuracy
        })
      }

      renderer.render(scene, camera)
      animId = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      ended = true
      window.api?.setFullscreen(false)
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      if (document.pointerLockElement === container) document.exitPointerLock()
      targets.forEach((t) => disposeObject(t.root))
      disposeRangeEnv(env, container)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  if (phase === 'running') {
    return (
      <div className="aim-fullscreen" style={{ background: settings.backgroundColor }}>
        <div className="aim-viewport-full" ref={mountRef} />
        <div className="aim-hud">
          <div className="hud-cell">
            <span className="hud-label">Pontos</span>
            <span className="hud-value">{hud.score}</span>
          </div>
          <div className="hud-cell hud-timer">
            <span className="hud-value">{hud.remaining}</span>
          </div>
          <div className="hud-cell">
            <span className="hud-label">Precisão</span>
            <span className="hud-value">{Math.round(hud.accuracy * 100)}%</span>
          </div>
        </div>
        <div className="aim-keys">
          <span>
            <kbd>R</kbd> reiniciar
          </span>
          <span>
            <kbd>Esc</kbd> sair
          </span>
        </div>
        <div className="aim-crosshair">
          <Crosshair config={settings.crosshair} />
        </div>
      </div>
    )
  }

  const length =
    def.durationMs !== undefined ? `${def.durationMs / 1000} segundos` : `${def.targetCount} alvos`
  const control =
    def.mode === 'click'
      ? 'Clique pra atirar'
      : def.mode === 'hold'
        ? 'Segure o clique em cima do alvo'
        : 'Só mire, sem clicar'

  return (
    <section className="page briefing">
      {stepLabel && <p className="progress-text">{stepLabel}</p>}
      <header className="page-head">
        <h1 className="display">{def.name}</h1>
        <p className="lede">{def.description}</p>
      </header>

      <dl className="spec-list">
        <div>
          <dt>Duração</dt>
          <dd>{length}</dd>
        </div>
        <div>
          <dt>Controle</dt>
          <dd>{control}</dd>
        </div>
        <div>
          <dt>Sensibilidade</dt>
          <dd>
            <span className="num">{sens}</span> no {GAMES[settings.game].label}
          </dd>
        </div>
        <div>
          <dt>Atalhos</dt>
          <dd>
            <kbd>R</kbd> reinicia, <kbd>Esc</kbd> sai
          </dd>
        </div>
      </dl>

      <div className="button-row">
        <button className="btn btn-primary" onClick={() => setPhase('running')}>
          Começar
        </button>
        <button className="btn btn-ghost" onClick={onAbort}>
          Voltar
        </button>
      </div>
    </section>
  )
}
