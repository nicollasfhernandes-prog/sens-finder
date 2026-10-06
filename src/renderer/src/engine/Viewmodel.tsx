import { forwardRef, useImperativeHandle, useRef } from 'react'
import type { FirstPersonView } from '../lib/weapons'

export interface ViewmodelHandle {
  /** Coice visual de um disparo. */
  kick: () => void
  /** Balanço da arma atrás do movimento do mouse, em px (já suavizado por quem chama). */
  sway: (x: number, y: number) => void
}

/**
 * Arma na mão no canto da tela, a partir de uma captura do jogo em primeira pessoa. Atualizada
 * direto no DOM (sem estado do React) pra não re-renderizar a cada disparo ou movimento.
 */
const Viewmodel = forwardRef<ViewmodelHandle, { view: FirstPersonView }>(function Viewmodel({ view }, ref) {
  const swayRef = useRef<HTMLDivElement>(null)
  const gunRef = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLSpanElement>(null)

  useImperativeHandle(ref, () => ({
    kick() {
      gunRef.current?.animate(
        [
          { transform: 'translate(0, 0) rotate(0deg)' },
          { transform: 'translate(1.2%, 2.5%) rotate(1.6deg)', offset: 0.25 },
          { transform: 'translate(0, 0) rotate(0deg)' }
        ],
        { duration: 170, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' }
      )
      flashRef.current?.animate(
        [
          { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
          { opacity: 0, transform: 'translate(-50%, -50%) scale(1.5)' }
        ],
        { duration: 70, easing: 'ease-out' }
      )
    },
    sway(x, y) {
      if (swayRef.current) swayRef.current.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
    }
  }))

  return (
    <div className="viewmodel" aria-hidden="true" style={{ width: `${view.width}vw`, right: `${view.right}vw`, bottom: `calc(${view.bottom}vh - 3vh)` }}>
      <div ref={swayRef} className="viewmodel-sway">
        <div ref={gunRef} className="viewmodel-gun">
          <img src={view.image} alt="" draggable={false} />
          <span
            ref={flashRef}
            className="viewmodel-flash"
            style={{ left: `${view.muzzle[0] * 100}%`, top: `${view.muzzle[1] * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
})

export default Viewmodel
