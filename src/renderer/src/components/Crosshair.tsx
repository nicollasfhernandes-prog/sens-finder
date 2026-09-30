import { CrosshairSettings } from '../settings'

interface Props {
  config: CrosshairSettings
  /** Multiplica o tamanho — útil pra ampliar no preview. */
  scale?: number
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const OUTLINE = 1

/** Desenha a mira no mesmo modelo do Valorant: linhas internas, ponto central e contorno. */
export default function Crosshair({ config, scale = 1 }: Props): JSX.Element {
  const { style, color, thickness: t, length: len, gap, dotSize, outline } = config
  const extent = Math.max(gap + len, dotSize, 4) + OUTLINE + 2
  const size = extent * 2

  const rects: Rect[] = []
  if (style === 'cross' || style === 'cross-dot') {
    rects.push(
      { x: -t / 2, y: -(gap + len), w: t, h: len },
      { x: -t / 2, y: gap, w: t, h: len },
      { x: -(gap + len), y: -t / 2, w: len, h: t },
      { x: gap, y: -t / 2, w: len, h: t }
    )
  }
  if (style === 'dot' || style === 'cross-dot') {
    rects.push({ x: -dotSize / 2, y: -dotSize / 2, w: dotSize, h: dotSize })
  }

  return (
    <svg
      width={size * scale}
      height={size * scale}
      viewBox={`${-extent} ${-extent} ${size} ${size}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {outline &&
        rects.map((r, i) => (
          <rect
            key={`o${i}`}
            x={r.x - OUTLINE}
            y={r.y - OUTLINE}
            width={r.w + OUTLINE * 2}
            height={r.h + OUTLINE * 2}
            fill="#000"
          />
        ))}
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={color} />
      ))}
    </svg>
  )
}
