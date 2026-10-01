import { useState } from 'react'
import ScenarioRunner from '../engine/ScenarioRunner'
import { ScenarioResult } from '../engine/types'
import { sensFinderFlick, sensFinderGridshot, sensFinderTracking } from '../scenarios/sensFinder'
import { AimTestResult } from '../types'
import { recordSession } from '../lib/history'
import { useSettings } from '../settings'

interface Props {
  sens: number
  onComplete: (result: AimTestResult) => void
  onAbort: () => void
}

const STAGES = [sensFinderFlick, sensFinderGridshot, sensFinderTracking]

export default function TestSuite({ sens, onComplete, onAbort }: Props): JSX.Element {
  const { settings } = useSettings()
  const [results, setResults] = useState<ScenarioResult[]>([])
  const stage = results.length

  function handleStageDone(result: ScenarioResult): void {
    recordSession(result, { game: settings.game, sens, dpi: settings.dpi })
    const next = [...results, result]
    if (next.length < STAGES.length) {
      setResults(next)
      return
    }
    onComplete({ flick: next[0], gridshot: next[1], tracking: next[2] })
  }

  const def = STAGES[stage]
  return (
    <ScenarioRunner
      key={def.id}
      def={def}
      sens={sens}
      stepLabel={`Teste ${stage + 1} de ${STAGES.length}`}
      onComplete={handleStageDone}
      onAbort={onAbort}
    />
  )
}
