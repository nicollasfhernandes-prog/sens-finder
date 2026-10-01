// Sons sintetizados na hora (Web Audio), no estilo dos aim trainers: sem arquivos de áudio,
// sem latência de carregamento. Cada som recebe o contexto e o destino pra poder ser
// renderizado também num OfflineAudioContext (testes).

export type SoundKind = 'shot' | 'hit' | 'body' | 'tick'

let live: AudioContext | null = null
const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()

function noise(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx)
  if (!buf) {
    buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseCache.set(ctx, buf)
  }
  return buf
}

/** Envelope de ataque instantâneo e queda exponencial. */
function envelope(ctx: BaseAudioContext, dest: AudioNode, t0: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)
  g.connect(dest)
  return g
}

function tone(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t0: number,
  type: OscillatorType,
  from: number,
  to: number,
  peak: number,
  decay: number
): void {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(from, t0)
  osc.frequency.exponentialRampToValueAtTime(to, t0 + decay)
  osc.connect(envelope(ctx, dest, t0, peak, decay))
  osc.start(t0)
  osc.stop(t0 + decay + 0.02)
}

function burst(ctx: BaseAudioContext, dest: AudioNode, t0: number, filter: BiquadFilterType, freq: number, q: number, peak: number, decay: number): void {
  const src = ctx.createBufferSource()
  src.buffer = noise(ctx)
  const f = ctx.createBiquadFilter()
  f.type = filter
  f.frequency.value = freq
  f.Q.value = q
  src.connect(f)
  f.connect(envelope(ctx, dest, t0, peak, decay))
  src.start(t0)
  src.stop(t0 + decay + 0.02)
}

/** Desenha o som em `dest` a partir de `t0`. Volume de 0 a 1. */
export function synth(ctx: BaseAudioContext, dest: AudioNode, kind: SoundKind, t0: number, volume: number): void {
  const v = Math.max(0, Math.min(1, volume))
  if (v === 0) return
  switch (kind) {
    case 'shot':
      // "Tak" seco: estalo agudo de ruído + baque grave curto.
      burst(ctx, dest, t0, 'bandpass', 3200, 0.9, 0.5 * v, 0.045)
      burst(ctx, dest, t0, 'highpass', 6500, 0.7, 0.18 * v, 0.02)
      tone(ctx, dest, t0, 'sine', 170, 55, 0.45 * v, 0.07)
      break
    case 'hit':
      // "Plink" cristalino de alvo destruído, com um harmônico que dá brilho.
      tone(ctx, dest, t0, 'triangle', 1760, 1320, 0.32 * v, 0.14)
      tone(ctx, dest, t0, 'sine', 2640, 2400, 0.14 * v, 0.09)
      tone(ctx, dest, t0 + 0.012, 'sine', 3520, 3300, 0.06 * v, 0.06)
      break
    case 'body':
      // Acerto no corpo (não conta): baque abafado.
      burst(ctx, dest, t0, 'lowpass', 900, 0.7, 0.35 * v, 0.06)
      tone(ctx, dest, t0, 'sine', 220, 120, 0.25 * v, 0.06)
      break
    case 'tick':
      // Tique curto enquanto o tracking causa dano.
      tone(ctx, dest, t0, 'square', 2200, 2000, 0.05 * v, 0.025)
      break
  }
}

/**
 * Cria/destrava o contexto de áudio. O Chromium só deixa tocar som depois de uma interação,
 * então isto é chamado no clique de "Começar" — e o primeiro disparo já sai sem atraso.
 */
export function warmAudio(): void {
  try {
    live ??= new AudioContext({ latencyHint: 'interactive' })
    if (live.state === 'suspended') void live.resume()
  } catch {
    live = null
  }
}

export function play(kind: SoundKind, volume: number): void {
  if (!live) warmAudio()
  if (!live) return
  synth(live, live.destination, kind, live.currentTime, volume)
}
