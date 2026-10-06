import { useEffect, useState } from 'react'
import type { UpdateStatus } from '../env'

/**
 * Situação da atualização automática, na barra de título. Some quando não tem nada novo; baixando,
 * mostra o progresso; pronta, oferece reiniciar (senão instala sozinha ao fechar o app).
 */
export default function UpdatePill(): JSX.Element | null {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    if (!window.api?.getUpdateStatus) return
    void window.api.getUpdateStatus().then(setStatus)
    return window.api.onUpdateStatus(setStatus)
  }, [])

  if (status.state === 'idle') return null

  if (status.state === 'downloading') {
    return (
      <span className="update-pill" role="status" title={`Baixando a versão ${status.version}`}>
        <span className="update-bar">
          <span style={{ width: `${status.percent}%` }} />
        </span>
        Baixando v{status.version}
      </span>
    )
  }

  if (status.state === 'ready') {
    return (
      <button
        type="button"
        className="update-pill is-ready"
        onClick={() => window.api.installUpdate()}
        title="Se preferir, ela instala sozinha quando você fechar o app"
      >
        v{status.version} pronta: reiniciar
      </button>
    )
  }

  return (
    <button type="button" className="update-pill is-ready" onClick={() => window.api.openReleases()}>
      v{status.version} disponível: baixar
    </button>
  )
}
