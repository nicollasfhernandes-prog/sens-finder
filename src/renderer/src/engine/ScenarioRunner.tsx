import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GAMES, verticalFov } from '../lib/sensitivity'
import { createRangeEnv, disposeRangeEnv } from '../lib/range3d'
import { normalizeDeg, radToDeg, sphericalOf } from '../lib/trajectory'
import { MetricsRecorder } from './metrics'
import { buildBot, buildSphere, disposeObject, setHighlighted } from './targets'
import { HitPart, Pose, ScenarioContext, ScenarioDef, ScenarioResult, Target } from './types'
import Crosshair from '../components/Crosshair'
import { gameFovValue, useSettings } from '../settings'
import { play, playShot, preloadSample, warmAudio } from '../lib/audio'
import { equippedWeapon } from '../lib/weapons'
import Viewmodel, { ViewmodelHandle } from './Viewmodel'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  def: ScenarioDef<any>
  sens: number
  onComplete: (result: ScenarioResult) => void
  onAbort: () => void
  stepLabel?: string
}

const PITCH_LIMIT = THREE.MathUtils.degToRad(89)
const RESTART_HOLD_MS = 600
const TRACK_TICK_MS = 70
const DEFAULT_RADIUS = 0.5
/** Intervalo do coice visual enquanto segura o clique nos cenários de tracking. */
const HOLD_KICK_MS = 95
const SWAY_MAX_PX = 22

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
  const [rawInput, setRawInput] = useState<boolean | null>(null)
  const [paused, setPaused] = useState(false)
  const [restartHold, setRestartHold] = useState(0)
  const controlsRef = useRef<{ resume: () => void; restart: () => void } | null>(null)
  const viewRef = useRef<ViewmodelHandle>(null)
  const weapon = equippedWeapon(settings.game, settings.weaponByGame, settings.skinByWeapon)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (phase !== 'running' || !mountRef.current) return
    const container = mountRef.current
    window.api?.setFullscreen(true)

    const env = createRangeEnv(
      container,
      { background: settings.backgroundColor, wall: settings.wallColor },
      verticalFov(settings.game, gameFovValue(settings))
    )
    const targetColor = settings.targetColor
    const { renderer, scene, camera } = env
    const raycaster = new THREE.Raycaster()
    const radPerCount = sens * GAMES[settings.game].yaw * (Math.PI / 180)
    // cm de mousepad por count ÷ graus por count = cm por grau de giro.
    const cmPerDeg = 2.54 / settings.dpi / (sens * GAMES[settings.game].yaw)
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
    // Começa pausado até o mouse travar; o relógio só anda com o jogador no controle.
    let paused = true
    let pausedAt = startedAt
    let rHeldSince: number | null = null
    let lastHoldShown = 0
    let lastTickAt = 0
    let lastKickAt = 0
    let mouseDx = 0
    let mouseDy = 0
    let swayX = 0
    let swayY = 0
    const shotProfile = weapon?.shot ?? null
    const shotSample = weapon?.shotSound
    const sound = settings.sound
    const volume = sound.volume / 100

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
      if (sound.hit) play('hit', volume)
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
      const result = rec.result(def, ctx.now - startedAt, cmPerDeg)
      if (document.pointerLockElement) document.exitPointerLock()
      onCompleteRef.current(result)
    }

    rec.recordFrame(pose(), startedAt)
    let state = def.init(ctx)

    // Reinicia no lugar, sem desmontar a cena: sair e voltar do pointer lock exigiria outro
    // clique do jogador e piscaria a tela cheia.
    function restart(): void {
      for (const t of [...targets]) removeTarget(t)
      yaw = 0
      pitch = 0
      camera.rotation.set(0, 0, 0, 'YXZ')
      firing = false
      rHeldSince = null
      setRestartHold(0)
      startedAt = performance.now()
      lastT = startedAt
      if (paused) pausedAt = startedAt
      ctx.now = startedAt
      ctx.elapsedMs = 0
      frame = 0
      rec = new MetricsRecorder(def.scoring, def.mode, startedAt)
      rec.recordFrame(pose(), startedAt)
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

    // Movimento cru, como os jogos leem (raw input): sem isso o Chromium aplica a aceleração
    // ("Aumentar precisão do ponteiro") e a velocidade do ponteiro do Windows, e movimentos
    // lentos chegam encolhidos — a sens parece bem mais baixa que no jogo.
    function lockPointer(): void {
      const lock = container.requestPointerLock as (options?: { unadjustedMovement?: boolean }) => Promise<void> | void
      Promise.resolve(lock.call(container, { unadjustedMovement: true }))
        .then(() => setRawInput(true))
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name === 'NotSupportedError') {
            setRawInput(false)
            Promise.resolve(container.requestPointerLock()).catch(() => setPaused(true))
          } else {
            // Ex.: o Chromium recusa travar de novo logo depois de um Esc. Fica no menu de pausa
            // e o jogador tenta outra vez.
            setPaused(true)
          }
        })
    }

    function pause(): void {
      paused = true
      pausedAt = performance.now()
      firing = false
      rHeldSince = null
      setRestartHold(0)
      setPaused(true)
    }

    function resume(): void {
      const now = performance.now()
      const d = now - pausedAt
      startedAt += d
      for (const t of targets) {
        t.spawnedAt += d
        if (t.expiresAt !== null) t.expiresAt += d
      }
      rec.shiftTime(d)
      lastT = now
      paused = false
      setPaused(false)
    }

    controlsRef.current = {
      resume: lockPointer,
      restart: () => {
        restart()
        lockPointer()
      }
    }
    lockPointer()

    function onMouseMove(e: MouseEvent): void {
      if (!document.pointerLockElement || ended || paused) return
      yaw -= e.movementX * radPerCount
      pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch - e.movementY * radPerCount))
      camera.rotation.set(pitch, yaw, 0, 'YXZ')
      mouseDx += e.movementX
      mouseDy += e.movementY
    }

    function onMouseDown(e: MouseEvent): void {
      if (e.button !== 0 || !document.pointerLockElement || ended || paused) return
      firing = true
      if (def.mode !== 'click') return
      if (sound.shot) playShot(volume, shotSample, shotProfile)
      viewRef.current?.kick()
      rec.recordShot()
      ctx.now = performance.now()
      const hit = raycastCenter()
      if (hit && hit.part !== 'body') {
        kill(hit.target)
      } else {
        if (hit && sound.hit) play('body', volume)
        rec.recordMiss()
      }
    }

    function onMouseUp(e: MouseEvent): void {
      if (e.button === 0) firing = false
    }

    // Reiniciar exige segurar R: um toque rápido é o reflexo de recarregar dos FPS.
    function onKeyDown(e: KeyboardEvent): void {
      if (e.code === 'KeyR' && !e.repeat && !ended && !paused) rHeldSince = performance.now()
    }

    function onKeyUp(e: KeyboardEvent): void {
      if (e.code !== 'KeyR') return
      rHeldSince = null
      setRestartHold(0)
    }

    function onPointerLockChange(): void {
      if (ended) return
      if (!document.pointerLockElement) pause()
      else if (paused) resume()
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
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
      if (paused) {
        renderer.render(scene, camera)
        animId = requestAnimationFrame(loop)
        return
      }
      const now = performance.now()

      if (rHeldSince !== null) {
        const progress = (now - rHeldSince) / RESTART_HOLD_MS
        if (progress >= 1) {
          restart()
          animId = requestAnimationFrame(loop)
          return
        }
        if (progress - lastHoldShown >= 0.05) {
          lastHoldShown = progress
          setRestartHold(progress)
        }
      } else {
        lastHoldShown = 0
      }
      const dtSec = Math.min((now - lastT) / 1000, 0.05)
      lastT = now
      ctx.now = now
      ctx.elapsedMs = now - startedAt

      rec.recordFrame(pose(), now)
      frame = rec.camPath.length - 1

      def.update?.(ctx, state, dtSec)
      for (const t of targets) {
        while (t.angleHistory.length <= frame - t.spawnFrame) t.angleHistory.push(angleOf(t.aimPoint()))
      }

      if (def.mode !== 'click') recordTracking()

      // A arma fica um pouco pra trás do movimento, como nos FPS.
      const clampSway = (v: number): number => Math.max(-SWAY_MAX_PX, Math.min(SWAY_MAX_PX, v))
      swayX += (clampSway(-mouseDx * 0.35) - swayX) * 0.18
      swayY += (clampSway(-mouseDy * 0.35) - swayY) * 0.18
      mouseDx = 0
      mouseDy = 0
      viewRef.current?.sway(swayX, swayY)
      if (def.mode === 'hold' && firing && now - lastKickAt >= HOLD_KICK_MS) {
        lastKickAt = now
        viewRef.current?.kick()
      }

      if (def.mode === 'hold') {
        const hit = firing ? raycastCenter() : null
        const damaged = hit && hit.part !== 'body' ? hit.target : null
        for (const t of targets) setHighlighted(t.hitboxes, t === damaged)
        if (damaged) {
          if (sound.hit && now - lastTickAt >= TRACK_TICK_MS) {
            lastTickAt = now
            play('tick', volume)
          }
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
      document.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      controlsRef.current = null
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
        {rawInput === false && (
          <div className="aim-warning">
            Entrada crua do mouse indisponível: desligue "Aumentar precisão do ponteiro" no Windows pra
            sens bater com o jogo.
          </div>
        )}
        {restartHold > 0 && (
          <div className="aim-restart" role="status">
            <span>Reiniciando</span>
            <span className="aim-restart-track">
              <span className="aim-restart-fill" style={{ width: `${Math.round(restartHold * 100)}%` }} />
            </span>
          </div>
        )}
        <div className="aim-keys">
          <span>
            Segure <kbd>R</kbd> pra reiniciar
          </span>
          <span>
            <kbd>Esc</kbd> pausa
          </span>
        </div>
        {paused && (
          <div className="aim-pause">
            <div className="pause-card">
              <h2 className="display">Pausado</h2>
              <p className="lede">O tempo está parado. Continue de onde parou ou reinicie o exercício.</p>
              <div className="button-row">
                <button className="btn btn-primary" onClick={() => controlsRef.current?.resume()}>
                  Continuar
                </button>
                <button className="btn btn-ghost" onClick={() => controlsRef.current?.restart()}>
                  Reiniciar
                </button>
                <button className="btn btn-ghost" onClick={onAbort}>
                  Sair do treino
                </button>
              </div>
            </div>
          </div>
        )}
        {weapon?.firstPerson && <Viewmodel ref={viewRef} view={weapon.firstPerson} />}
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
          <dt>Arma</dt>
          <dd className="spec-weapon">
            {weapon ? (
              <>
                <img src={weapon.image} alt="" />
                {weapon.skinName ?? weapon.label}
              </>
            ) : (
              'Sem arma na tela'
            )}
          </dd>
        </div>
        <div>
          <dt>Atalhos</dt>
          <dd>
            Segure <kbd>R</kbd> pra reiniciar, <kbd>Esc</kbd> pausa
          </dd>
        </div>
      </dl>

      <div className="button-row">
        <button
          className="btn btn-primary"
          onClick={() => {
            warmAudio()
            if (weapon?.shotSound) preloadSample(weapon.shotSound)
            setPhase('running')
          }}
        >
          Começar
        </button>
        <button className="btn btn-ghost" onClick={onAbort}>
          Voltar
        </button>
      </div>
    </section>
  )
}
