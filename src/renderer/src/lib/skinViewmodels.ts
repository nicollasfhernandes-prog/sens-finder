// Skins com arma na mão, recortadas do vídeo oficial de demonstração de cada uma
// (valorant-api.com). Os vídeos são gravados no jogo com o FOV padrão, então a posição no quadro
// já é a da tela. Só entram as skins cujo recorte ficou limpo.
import type { FirstPersonView, WeaponId } from './weapons'
import manifestJson from './skinViewmodels.json'

export interface Skin {
  uuid: string
  name: string
}

interface Entry {
  weapon: string
  name: string
  file: string
  /** Caixa no quadro do vídeo: x0, y0, x1, y1 em fração da largura e da altura. */
  box: [number, number, number, number]
  /** Ponta do cano dentro da imagem, em fração. */
  muzzle: [number, number]
}

const manifest = manifestJson as unknown as Record<string, Entry>

const files = import.meta.glob<string>('../assets/skins/*.webp', { eager: true, query: '?url', import: 'default' })
const urlOf = (file: string): string | undefined => files[`../assets/skins/${file}`]

// Disparo gravado de cada skin, recortado do áudio do mesmo vídeo (mesmo nome, .ogg).
const sounds = import.meta.glob<string>('../assets/skins/*.ogg', { eager: true, query: '?url', import: 'default' })

export function skinShotSound(skinUuid: string): string | undefined {
  const e = manifest[skinUuid]
  return e && sounds[`../assets/skins/${e.file.replace(/\.webp$/, '.ogg')}`]
}

export function skinViewmodel(skinUuid: string): FirstPersonView | undefined {
  const e = manifest[skinUuid]
  const url = e && urlOf(e.file)
  if (!e || !url) return undefined
  const [x0, , x1, y1] = e.box
  return { image: url, width: (x1 - x0) * 100, right: (1 - x1) * 100, bottom: (1 - y1) * 100, muzzle: e.muzzle }
}

/** Skins da arma que aparecem na mão, em ordem alfabética, com o recorte pra miniatura. */
export function listSkins(weapon: WeaponId): (Skin & { image: string })[] {
  return Object.entries(manifest)
    .filter(([, e]) => e.weapon === weapon && urlOf(e.file))
    .map(([uuid, e]) => ({ uuid, name: e.name, image: urlOf(e.file)! }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
