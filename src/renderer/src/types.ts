import { GameId, PlayStyle } from './lib/sensitivity'
import { ScenarioResult } from './engine/types'

export type Screen = 'intro' | 'questionnaire' | 'initialResult' | 'aimTest' | 'finalResult'

export interface QuestionnaireAnswers {
  targetGame: GameId
  dpi: number
  hasKnownSens: boolean
  sourceGame: GameId
  sourceSens: number
  playStyle: PlayStyle
}

export interface AimTestResult {
  flick: ScenarioResult
  gridshot: ScenarioResult
  tracking: ScenarioResult
}
