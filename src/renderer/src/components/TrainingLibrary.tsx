import { useState } from 'react'
import ScenarioRunner from '../engine/ScenarioRunner'
import { ScenarioDef, ScenarioResult } from '../engine/types'
import { LIBRARY } from '../scenarios/aimlab'
import { getBest, recordScore, useSettings } from '../settings'
import { recordSession } from '../lib/history'
import ScenarioResultView from './ScenarioResultView'
import SensControl from './SensControl'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyScenario = ScenarioDef<any>

type View =
  | { kind: 'list' }
  | { kind: 'play'; def: AnyScenario; run: number }
  | { kind: 'result'; def: AnyScenario; result: ScenarioResult; previousBest: number | null }

const SKILL_ORDER = ['Flick', 'Precisão', 'Tracking', 'Reflexo']

const SKILL_DESCRIPTIONS: Record<string, string> = {
  Flick: 'Levar a mira até um alvo longe num movimento só. É onde overflick e underflick aparecem mais.',
  Precisão: 'Ajustes curtos em alvos pequenos. Mostra se a sens deixa você parar exatamente no alvo.',
  Tracking: 'Manter a mira num alvo em movimento. Mostra se você corrige demais ou fica pra trás.',
  Reflexo: 'Reagir rápido a alvos que aparecem sem aviso.'
}

function lengthLabel(def: AnyScenario): string {
  return def.durationMs !== undefined ? `${def.durationMs / 1000}s` : `${def.targetCount} alvos`
}

export default function TrainingLibrary(): JSX.Element {
  const { settings, update, changeGame } = useSettings()
  const [view, setView] = useState<View>({ kind: 'list' })
  const play = (def: AnyScenario): void => setView({ kind: 'play', def, run: Date.now() })

  if (view.kind === 'play') {
    return (
      <ScenarioRunner
        key={`${view.def.id}-${view.run}`}
        def={view.def}
        sens={settings.sens}
        onComplete={(result) => {
          recordSession(result, { game: settings.game, sens: settings.sens, dpi: settings.dpi })
          setView({
            kind: 'result',
            def: view.def,
            result,
            previousBest: recordScore(view.def.id, result.score)
          })
        }}
        onAbort={() => setView({ kind: 'list' })}
      />
    )
  }

  if (view.kind === 'result') {
    return (
      <ScenarioResultView
        def={view.def}
        result={view.result}
        sens={settings.sens}
        previousBest={view.previousBest}
        onPlayAgain={() => play(view.def)}
        onPlayWithSens={(sens) => {
          update({ sens })
          play(view.def)
        }}
        onBack={() => setView({ kind: 'list' })}
      />
    )
  }

  const groups = SKILL_ORDER.map((skill) => ({
    skill,
    items: LIBRARY.filter((def) => def.skill === skill)
  })).filter((g) => g.items.length > 0)

  return (
    <section className="page page-wide">
      <header className="page-head page-head-row">
        <div>
          <h1 className="display">Treinos</h1>
          <p className="lede">Cada partida analisa seus flicks. Com 3 partidas na mesma sens, o app recomenda um ajuste.</p>
        </div>
        <SensControl
          game={settings.game}
          value={settings.sens}
          onChange={(sens) => update({ sens })}
          onGameChange={changeGame}
        />
      </header>

      {groups.map((group) => (
        <section key={group.skill} className="scenario-group">
          <h2 className="group-title">{group.skill}</h2>
          <p className="group-desc">{SKILL_DESCRIPTIONS[group.skill]}</p>
          <ul className="scenario-rows">
            {group.items.map((def) => {
              const best = getBest(def.id)
              return (
                <li key={def.id}>
                  <button className="scenario-row" onClick={() => play(def)}>
                    <span className="row-name">{def.name}</span>
                    <span className="row-desc">{def.description}</span>
                    <span className="row-meta">{lengthLabel(def)}</span>
                    <span className="row-best num">
                      {best !== null ? best.toLocaleString('pt-BR') : <span className="row-empty">sem recorde</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </section>
  )
}
