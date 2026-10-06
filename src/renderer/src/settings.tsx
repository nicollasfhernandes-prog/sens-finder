import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { convertSens, GameId, GAMES, roundSens } from './lib/sensitivity'
import type { WeaponId } from './lib/weapons'
import type { Skin } from './lib/skinViewmodels'

export type CrosshairStyle = 'cross' | 'cross-dot' | 'dot'

export interface CrosshairSettings {
  style: CrosshairStyle
  color: string
  thickness: number
  length: number
  gap: number
  dotSize: number
  outline: boolean
}

export interface SoundSettings {
  /** 0 a 100. */
  volume: number
  shot: boolean
  hit: boolean
}

export interface Settings {
  /** Jogo-alvo: define a unidade de `sens` e a rotação usada nos treinos. */
  game: GameId
  sens: number
  dpi: number
  /** FOV como cada jogo mostra, pros jogos que deixam mudar. */
  fovByGame: Partial<Record<GameId, number>>
  crosshair: CrosshairSettings
  sound: SoundSettings
  targetColor: string
  backgroundColor: string
  wallColor: string
  /** Arma na mão durante os treinos, por jogo. Sem escolha = a primeira do jogo. */
  weaponByGame: Partial<Record<GameId, WeaponId | 'none'>>
  /** Skin escolhida por arma (sem entrada = padrão). */
  skinByWeapon: Partial<Record<WeaponId, Skin>>
}

export const DEFAULT_SETTINGS: Settings = {
  game: 'valorant',
  sens: 0.4,
  dpi: 800,
  fovByGame: {},
  crosshair: {
    style: 'cross',
    color: '#00ffff',
    thickness: 2,
    length: 6,
    gap: 3,
    dotSize: 2,
    outline: true
  },
  sound: { volume: 60, shot: true, hit: true },
  targetColor: '#ff4655',
  backgroundColor: '#0f1923',
  wallColor: '#1a2632',
  weaponByGame: {},
  skinByWeapon: {}
}

const STORAGE_KEY = 'vsf.settings.v1'
const BESTS_KEY = 'vsf.bests.v1'

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    const crosshair = { ...DEFAULT_SETTINGS.crosshair, ...parsed.crosshair }
    // O estilo "circle" existia antes, mas não existe no Valorant e não dá pra exportar.
    if ((crosshair.style as string) === 'circle') crosshair.style = 'cross-dot'
    crosshair.dotSize = Math.min(crosshair.dotSize, 6)
    const game = parsed.game && parsed.game in GAMES ? parsed.game : DEFAULT_SETTINGS.game
    const sound = { ...DEFAULT_SETTINGS.sound, ...parsed.sound }
    return { ...DEFAULT_SETTINGS, ...parsed, game, crosshair, sound }
  } catch {
    return DEFAULT_SETTINGS
  }
}

interface SettingsContextValue {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  /** Troca o jogo-alvo convertendo a sens de treino pra manter os mesmos cm/360°. */
  changeGame: (game: GameId) => void
  updateCrosshair: (patch: Partial<CrosshairSettings>) => void
  updateSound: (patch: Partial<SoundSettings>) => void
  reset: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }): JSX.Element {
  const [settings, setSettings] = useState<Settings>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Sem storage disponível: as configurações valem só pra esta sessão.
    }
  }, [settings])

  const value: SettingsContextValue = {
    settings,
    update: (patch) => setSettings((s) => ({ ...s, ...patch })),
    changeGame: (game) =>
      setSettings((s) =>
        s.game === game ? s : { ...s, game, sens: roundSens(convertSens(s.sens, s.game, game), game) }
      ),
    updateCrosshair: (patch) => setSettings((s) => ({ ...s, crosshair: { ...s.crosshair, ...patch } })),
    updateSound: (patch) => setSettings((s) => ({ ...s, sound: { ...s.sound, ...patch } })),
    reset: () =>
      setSettings((s) => ({ ...DEFAULT_SETTINGS, game: s.game, sens: s.sens, dpi: s.dpi, fovByGame: s.fovByGame, weaponByGame: s.weaponByGame, skinByWeapon: s.skinByWeapon }))
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

/** FOV do jogo atual, como o jogo mostra (o padrão dele se estiver travado ou não configurado). */
export function gameFovValue(s: Settings): number {
  const fov = GAMES[s.game].fov
  if (fov.min === undefined || fov.max === undefined) return fov.default
  return s.fovByGame[s.game] ?? fov.default
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings fora do SettingsProvider')
  return ctx
}

function loadBests(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(BESTS_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

export function getBest(scenarioId: string): number | null {
  return loadBests()[scenarioId] ?? null
}

/** Registra a pontuação e devolve o recorde anterior (null se for a primeira partida). */
export function recordScore(scenarioId: string, score: number): number | null {
  const bests = loadBests()
  const previous = bests[scenarioId] ?? null
  if (previous === null || score > previous) {
    bests[scenarioId] = score
    try {
      localStorage.setItem(BESTS_KEY, JSON.stringify(bests))
    } catch {
      // Sem storage: o recorde não persiste, mas a partida segue normal.
    }
  }
  return previous
}
