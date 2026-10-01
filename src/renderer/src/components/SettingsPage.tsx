import { useState } from 'react'
import { toValorantCode, VALORANT_LIMITS, VALORANT_PRESET_COLORS } from '../lib/crosshairCode'
import { GAME_IDS, GameId, GAMES, horizontalFov169, verticalFov } from '../lib/sensitivity'
import { CrosshairStyle, gameFovValue, useSettings } from '../settings'
import { play, warmAudio } from '../lib/audio'
import Crosshair from './Crosshair'

const CROSSHAIR_STYLES: { id: CrosshairStyle; label: string }[] = [
  { id: 'cross', label: 'Cruz' },
  { id: 'cross-dot', label: 'Cruz + ponto' },
  { id: 'dot', label: 'Ponto' }
]
const TARGET_COLORS = ['#ff4655', '#ffcb3b', '#3be8ff', '#57ff7a', '#ff8a3b', '#b98cff']
const BACKGROUND_COLORS = ['#0f1923', '#0a0a0d', '#1b1b22', '#0e2230', '#262626', '#d9d4ca']
const WALL_COLORS = ['#1a2632', '#141419', '#24242e', '#16384a', '#353535', '#c4bdb0']

interface SwatchProps {
  label: string
  value: string
  options: string[]
  onChange: (color: string) => void
}

function SwatchField({ label, value, options, onChange }: SwatchProps): JSX.Element {
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="swatches">
        {options.map((c) => (
          <button
            type="button"
            key={c}
            className={`swatch-btn${value.toLowerCase() === c ? ' is-active' : ''}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
            aria-label={c}
          />
        ))}
        <label className="swatch-custom" title="Cor personalizada">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
          <span>Outra cor</span>
        </label>
      </div>
    </div>
  )
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}

function SliderField({ label, value, min, max, onChange }: SliderProps): JSX.Element {
  return (
    <label className="field slider-field">
      <span className="label">{label}</span>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="num slider-value">{value}</span>
    </label>
  )
}

export default function SettingsPage(): JSX.Element {
  const { settings, updateCrosshair, updateSound, update, changeGame, reset } = useSettings()
  const snd = settings.sound

  function preview(kind: 'shot' | 'hit' | 'both'): void {
    warmAudio()
    const v = snd.volume / 100
    if (kind !== 'hit') play('shot', v)
    if (kind !== 'shot') play('hit', v)
  }
  const [copied, setCopied] = useState(false)
  const ch = settings.crosshair
  const game = GAMES[settings.game]
  const fov = game.fov
  const fovValue = gameFovValue(settings)
  const showLines = ch.style !== 'dot'
  const showDot = ch.style !== 'cross'
  const code = toValorantCode(ch)
  const L = VALORANT_LIMITS

  function copyCode(): void {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="page page-wide">
      <header className="page-head">
        <h1 className="display">Configurações</h1>
      </header>

      <div className="settings-layout">
        <div className="settings-form">
          <fieldset className="panel">
            <legend className="panel-title">Jogo e mouse</legend>
            <div className="field-row">
              <label className="field">
                <span className="label">Jogo</span>
                <select className="input" value={settings.game} onChange={(e) => changeGame(e.target.value as GameId)}>
                  {GAME_IDS.map((id) => (
                    <option key={id} value={id}>
                      {GAMES[id].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">DPI</span>
                <input
                  className="input num"
                  type="number"
                  min={100}
                  max={26000}
                  value={settings.dpi}
                  onChange={(e) => {
                    const dpi = Number(e.target.value)
                    if (dpi > 0) update({ dpi })
                  }}
                />
              </label>
            </div>

            {fov.min !== undefined && fov.max !== undefined ? (
              <SliderField
                label={`FOV no ${game.label}`}
                value={fovValue}
                min={fov.min}
                max={fov.max}
                onChange={(v) => update({ fovByGame: { ...settings.fovByGame, [settings.game]: v } })}
              />
            ) : (
              <p className="field-note">
                O {game.label} tem FOV fixo, e os treinos usam o mesmo campo de visão do jogo.
              </p>
            )}
            <p className="fine">
              Equivale a {horizontalFov169(verticalFov(settings.game, fovValue)).toFixed(1).replace('.', ',')}° de campo
              de visão horizontal numa tela 16:9. Use o mesmo FOV do jogo pra mira andar na tela na mesma velocidade.
            </p>
          </fieldset>

          <fieldset className="panel">
            <legend className="panel-title">Mira</legend>

            <div className="field">
              <span className="label">Estilo</span>
              <div className="segmented">
                {CROSSHAIR_STYLES.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={ch.style === s.id ? 'is-active' : ''}
                    onClick={() => updateCrosshair({ style: s.id })}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <SwatchField
              label="Cor"
              value={ch.color}
              options={VALORANT_PRESET_COLORS}
              onChange={(color) => updateCrosshair({ color })}
            />

            {showLines && (
              <>
                <SliderField label="Espessura" value={ch.thickness} min={L.thickness.min} max={L.thickness.max} onChange={(thickness) => updateCrosshair({ thickness })} />
                <SliderField label="Comprimento" value={ch.length} min={L.length.min} max={L.length.max} onChange={(length) => updateCrosshair({ length })} />
                <SliderField label="Espaço central" value={ch.gap} min={L.gap.min} max={L.gap.max} onChange={(gap) => updateCrosshair({ gap })} />
              </>
            )}
            {showDot && (
              <SliderField label="Ponto central" value={ch.dotSize} min={L.dotSize.min} max={L.dotSize.max} onChange={(dotSize) => updateCrosshair({ dotSize })} />
            )}

            <label className="toggle">
              <input type="checkbox" checked={ch.outline} onChange={(e) => updateCrosshair({ outline: e.target.checked })} />
              <span className="toggle-track" />
              <span>Contorno preto</span>
            </label>
          </fieldset>

          <fieldset className="panel">
            <legend className="panel-title">Cena</legend>
            <SwatchField label="Alvo" value={settings.targetColor} options={TARGET_COLORS} onChange={(targetColor) => update({ targetColor })} />
            <SwatchField label="Fundo" value={settings.backgroundColor} options={BACKGROUND_COLORS} onChange={(backgroundColor) => update({ backgroundColor })} />
            <SwatchField label="Parede" value={settings.wallColor} options={WALL_COLORS} onChange={(wallColor) => update({ wallColor })} />
          </fieldset>

          <fieldset className="panel">
            <legend className="panel-title">Som</legend>
            <SliderField label="Volume" value={snd.volume} min={0} max={100} onChange={(volume) => updateSound({ volume })} />
            <label className="toggle">
              <input type="checkbox" checked={snd.shot} onChange={(e) => updateSound({ shot: e.target.checked })} />
              <span className="toggle-track" />
              <span>Som de disparo</span>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={snd.hit} onChange={(e) => updateSound({ hit: e.target.checked })} />
              <span className="toggle-track" />
              <span>Som de acerto</span>
            </label>
            <div className="button-row sound-test">
              <button type="button" className="btn btn-ghost" onClick={() => preview('shot')}>
                Ouvir disparo
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => preview('hit')}>
                Ouvir acerto
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => preview('both')}>
                Disparo com acerto
              </button>
            </div>
          </fieldset>

          <div className="button-row">
            <button className="btn btn-ghost" onClick={reset}>
              Restaurar padrão
            </button>
          </div>
        </div>

        <aside className="preview-col">
          <div className="preview" style={{ background: settings.backgroundColor }}>
            <div
              className="preview-wall"
              style={{
                backgroundColor: settings.wallColor,
                ['--grid' as string]: `color-mix(in srgb, ${settings.wallColor} 82%, #ffffff)`
              }}
            />
            <div
              className="preview-target"
              style={{ background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${settings.targetColor} 55%, #fff), ${settings.targetColor} 45%, color-mix(in srgb, ${settings.targetColor} 60%, #000))` }}
            />
            <div className="preview-crosshair">
              <Crosshair config={ch} />
            </div>
          </div>
          <div className="preview-zoom" style={{ background: settings.wallColor }}>
            <Crosshair config={ch} scale={4} />
            <span className="preview-caption">Ampliada 4 vezes</span>
          </div>

          <section className="panel export-panel">
            <h2 className="panel-title">Levar pro Valorant</h2>
            <output className="code-box" aria-label="Código de perfil de mira">
              {code}
            </output>
            <div className="button-row">
              <button className="btn btn-primary" onClick={copyCode}>
                {copied ? 'Código copiado' : 'Copiar código'}
              </button>
            </div>
            <ol className="export-steps">
              <li>No Valorant, abra Configurações e a aba Mira.</li>
              <li>Em Perfil de mira, clique no ícone de importar.</li>
              <li>Cole o código e salve.</li>
            </ol>
          </section>
        </aside>
      </div>
    </section>
  )
}
