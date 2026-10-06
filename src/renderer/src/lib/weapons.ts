// Armas dos treinos. Os cartões usam as renderizações oficiais (Valorant via valorant-api.com,
// CS2 via CDN da Steam). Na mão, capturas em primeira pessoa: a Vandal de um print do jogo, as do
// CS2 do gerador de viewmodel da SteamAnalyst (modelos do jogo) e as skins dos vídeos oficiais.
// Mudam o visual e o som do disparo: nos treinos não tem recuo nem espalhamento.
import vandalImg from '../assets/weapons/vandal.png'
import phantomImg from '../assets/weapons/phantom.png'
import vandalFpImg from '../assets/weapons/vandal-fp.png'
import ak47Img from '../assets/weapons/ak-47.png'
import m4a4Img from '../assets/weapons/m4a4.png'
import m4a1sImg from '../assets/weapons/m4a1-s.png'
import ak47FpImg from '../assets/weapons/ak47-fp.webp'
import m4a4FpImg from '../assets/weapons/m4a4-fp.webp'
import m4a1sFpImg from '../assets/weapons/m4a1s-fp.webp'
import type { GameId } from './sensitivity'
import { listSkins, Skin, skinShotSound, skinViewmodel } from './skinViewmodels'

export type WeaponId = 'vandal' | 'phantom' | 'ak47' | 'm4a4' | 'm4a1s'

/** Timbre do disparo sintetizado. */
export interface ShotProfile {
  /** Frequência central do estalo (Hz). */
  crack: number
  /** Queda do grave: de `bodyFrom` até `bodyTo` Hz em `decay` segundos. */
  bodyFrom: number
  bodyTo: number
  decay: number
  /** Silenciada: estalo abafado e sem o chiado agudo. */
  suppressed: boolean
}

/** Captura do jogo em primeira pessoa, recortada (mão e arma, sem fundo e sem HUD). */
export interface FirstPersonView {
  image: string
  /** Largura e distância da borda direita, em vw; distância da borda de baixo, em vh. */
  width: number
  right: number
  bottom: number
  /** Ponta do cano na imagem, em fração da largura e da altura (pro clarão do disparo). */
  muzzle: [number, number]
}

export interface Weapon {
  id: WeaponId
  label: string
  game: GameId
  image: string
  /** Descrição curta do jeito da arma, pro seletor. */
  note: string
  shot: ShotProfile
  /** Sem captura em primeira pessoa, o treino mostra só a mira (a arma muda só o som). */
  firstPerson?: FirstPersonView
  /** Nome da skin equipada (vazio = padrão). */
  skinName?: string
  /** Disparo gravado da skin; sem ele, o disparo é sintetizado a partir de \shot\. */
  shotSound?: string
}

export const WEAPONS: Record<WeaponId, Weapon> = {
  vandal: {
    id: 'vandal',
    label: 'Vandal',
    game: 'valorant',
    image: vandalImg,
    note: 'Disparo seco e pesado',
    shot: { crack: 2600, bodyFrom: 160, bodyTo: 48, decay: 0.1, suppressed: false },
    firstPerson: { image: vandalFpImg, width: 52, right: 0, bottom: 0, muzzle: [0.19, 0.31] }
  },
  phantom: {
    id: 'phantom',
    label: 'Phantom',
    game: 'valorant',
    image: phantomImg,
    note: 'Silenciada, som abafado',
    shot: { crack: 1500, bodyFrom: 210, bodyTo: 70, decay: 0.06, suppressed: true }
  },
  ak47: {
    id: 'ak47',
    label: 'AK-47',
    game: 'cs2',
    image: ak47Img,
    note: 'Disparo grave e encorpado',
    shot: { crack: 2300, bodyFrom: 150, bodyTo: 44, decay: 0.11, suppressed: false },
    firstPerson: { image: ak47FpImg, width: 43.02, right: 8.18, bottom: 0, muzzle: [0.24, 0.3] }
  },
  m4a4: {
    id: 'm4a4',
    label: 'M4A4',
    game: 'cs2',
    image: m4a4Img,
    note: 'Disparo médio e estalado',
    shot: { crack: 3100, bodyFrom: 190, bodyTo: 60, decay: 0.08, suppressed: false },
    firstPerson: { image: m4a4FpImg, width: 46.93, right: 6.61, bottom: 0, muzzle: [0.263, 0.295] }
  },
  m4a1s: {
    id: 'm4a1s',
    label: 'M4A1-S',
    game: 'cs2',
    image: m4a1sImg,
    note: 'Silenciada, som abafado',
    shot: { crack: 1400, bodyFrom: 220, bodyTo: 75, decay: 0.055, suppressed: true },
    firstPerson: { image: m4a1sFpImg, width: 50.99, right: 1.82, bottom: 0, muzzle: [0.216, 0.143] }
  }
}

export function weaponsForGame(game: GameId): Weapon[] {
  return Object.values(WEAPONS).filter((w) => w.game === game)
}

/** Arma escolhida pro jogo; a primeira da lista se nunca escolheu, null se escolheu "sem arma". */
export function selectedWeapon(game: GameId, byGame: Partial<Record<GameId, WeaponId | 'none'>>): Weapon | null {
  const choice = byGame[game]
  if (choice === 'none') return null
  const options = weaponsForGame(game)
  return options.find((w) => w.id === choice) ?? options[0] ?? null
}

/** Skin em uso na arma: a escolhida, ou a primeira com arma na mão se a padrão não tiver captura. */
export function activeSkin(w: Weapon, skins: Partial<Record<WeaponId, Skin>>): Skin | null {
  const chosen = skins[w.id]
  if (chosen && skinViewmodel(chosen.uuid)) return chosen
  if (w.firstPerson) return null
  return listSkins(w.id)[0] ?? null
}

/** Arma equipada com a skin em uso: a miniatura e a arma na mão vêm do recorte do vídeo da skin. */
export function equippedWeapon(
  game: GameId,
  byGame: Partial<Record<GameId, WeaponId | 'none'>>,
  skins: Partial<Record<WeaponId, Skin>>
): Weapon | null {
  const w = selectedWeapon(game, byGame)
  if (!w) return null
  const skin = activeSkin(w, skins)
  const view = skin && skinViewmodel(skin.uuid)
  if (!skin || !view) return w
  return { ...w, image: view.image, firstPerson: view, skinName: skin.name, shotSound: skinShotSound(skin.uuid) }
}
