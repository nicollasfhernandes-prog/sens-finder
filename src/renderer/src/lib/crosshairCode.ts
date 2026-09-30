import type { CrosshairSettings } from '../settings'

// Formato de código de perfil de mira do Valorant, engenharia reversa da comunidade (não há
// especificação oficial da Riot). Valores iguais ao padrão do jogo são omitidos, como no
// código que o próprio jogo exporta.

/** Cores pré-definidas do jogo, na ordem do índice `c`. */
export const VALORANT_PRESET_COLORS = [
  '#ffffff',
  '#00ff00',
  '#7fff00',
  '#dfff00',
  '#ffff00',
  '#00ffff',
  '#ff00ff',
  '#ff0000'
]

const CUSTOM_COLOR_INDEX = 8

// Padrões do Valorant pra mira principal.
const DEFAULT_DOT_SIZE = 2
const DEFAULT_INNER_THICKNESS = 2
const DEFAULT_INNER_LENGTH = 6
const DEFAULT_INNER_OFFSET = 3

// Faixas aceitas pelo jogo.
export const VALORANT_LIMITS = {
  thickness: { min: 1, max: 10 },
  length: { min: 0, max: 20 },
  gap: { min: 0, max: 20 },
  dotSize: { min: 1, max: 6 }
} as const

function clampInt(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(v)))
}

export function toValorantCode(ch: CrosshairSettings): string {
  const pairs: [string, string | number][] = []

  const color = ch.color.toLowerCase()
  const preset = VALORANT_PRESET_COLORS.indexOf(color)
  if (preset === -1) {
    pairs.push(['c', CUSTOM_COLOR_INDEX], ['u', `${color.slice(1).toUpperCase()}FF`], ['b', 1])
  } else if (preset !== 0) {
    pairs.push(['c', preset])
  }

  // Contorno: o jogo usa opacidade 0,5 por padrão; aqui ele é sólido.
  if (ch.outline) pairs.push(['o', 1])
  else pairs.push(['h', 0])

  const hasDot = ch.style !== 'cross'
  const hasLines = ch.style !== 'dot'

  if (hasDot) {
    pairs.push(['d', 1])
    const z = clampInt(ch.dotSize, VALORANT_LIMITS.dotSize.min, VALORANT_LIMITS.dotSize.max)
    if (z !== DEFAULT_DOT_SIZE) pairs.push(['z', z])
  }

  if (hasLines) {
    const t = clampInt(ch.thickness, VALORANT_LIMITS.thickness.min, VALORANT_LIMITS.thickness.max)
    const l = clampInt(ch.length, VALORANT_LIMITS.length.min, VALORANT_LIMITS.length.max)
    const o = clampInt(ch.gap, VALORANT_LIMITS.gap.min, VALORANT_LIMITS.gap.max)
    if (t !== DEFAULT_INNER_THICKNESS) pairs.push(['0t', t])
    if (l !== DEFAULT_INNER_LENGTH) pairs.push(['0l', l])
    if (o !== DEFAULT_INNER_OFFSET) pairs.push(['0o', o])
    // Opacidade total e sem erro de disparo: a mira do app é estática e sólida.
    pairs.push(['0a', 1], ['0f', 0])
  } else {
    pairs.push(['0b', 0])
  }

  // O app não tem linhas externas.
  pairs.push(['1b', 0])

  return ['0', 'P', ...pairs.flat()].join(';')
}
