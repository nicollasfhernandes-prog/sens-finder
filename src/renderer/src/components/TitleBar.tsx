import { useEffect, useState } from 'react'
import { GAME_IDS, GameId, GAMES } from '../lib/sensitivity'
import { useSettings } from '../settings'
import UpdatePill from './UpdatePill'

function Logo(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 34 34" aria-hidden="true">
      <path d="M3 5 L17 29 L21 22 L11 5 Z" fill="#fff" />
      <path d="M19 5 L31 5 L25 16 Z" fill="rgba(255,255,255,0.7)" />
    </svg>
  )
}

/** Barra de título desenhada pelo app (a janela usa a moldura nativa sem a barra padrão). */
export default function TitleBar(): JSX.Element {
  const { settings, changeGame } = useSettings()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => window.api?.onMaximized(setMaximized), [])

  return (
    <header className="titlebar">
      <div className="titlebar-brand">
        <span className="brand-mark">
          <Logo />
        </span>
        <span className="brand-name">Sens Finder</span>
        <span className="brand-version">v{__APP_VERSION__}</span>
      </div>

      <div className="titlebar-tools">
        <UpdatePill />
        <label className="game-pill">
          <span className="visually-hidden">Jogo</span>
          <select value={settings.game} onChange={(e) => changeGame(e.target.value as GameId)}>
            {GAME_IDS.map((id) => (
              <option key={id} value={id}>
                {GAMES[id].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="window-controls">
        <button type="button" aria-label="Minimizar" onClick={() => window.api?.windowControl('minimize')}>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0 5.5 H10" stroke="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={maximized ? 'Restaurar' : 'Maximizar'}
          onClick={() => window.api?.windowControl('maximize')}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M2.5 0.5 H9.5 V7.5 M0.5 2.5 H7.5 V9.5 H0.5 Z" fill="none" stroke="currentColor" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" />
            </svg>
          )}
        </button>
        <button type="button" className="is-close" aria-label="Fechar" onClick={() => window.api?.windowControl('close')}>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0.5 0.5 L9.5 9.5 M9.5 0.5 L0.5 9.5" stroke="currentColor" />
          </svg>
        </button>
      </div>
    </header>
  )
}
