import { useState } from 'react'
import Questionnaire from './components/Questionnaire'
import InitialResult from './components/InitialResult'
import TestSuite from './components/TestSuite'
import FinalResult from './components/FinalResult'
import TrainingLibrary from './components/TrainingLibrary'
import SettingsPage from './components/SettingsPage'
import ProgressPage from './components/ProgressPage'
import { convertSens, gameCm360, GAMES, heuristicSens } from './lib/sensitivity'
import { useSettings } from './settings'
import { AimTestResult, QuestionnaireAnswers, Screen } from './types'

type Section = 'finder' | 'library' | 'progress' | 'settings'

const NAV: { id: Section; label: string }[] = [
  { id: 'finder', label: 'Sens Finder' },
  { id: 'library', label: 'Treinos' },
  { id: 'progress', label: 'Progresso' },
  { id: 'settings', label: 'Configurações' }
]

const FINDER_STEPS: { screens: Screen[]; label: string }[] = [
  { screens: ['questionnaire'], label: 'Setup' },
  { screens: ['initialResult'], label: 'Ponto de partida' },
  { screens: ['aimTest'], label: 'Testes' },
  { screens: ['finalResult'], label: 'Resultado' }
]

function Logo(): JSX.Element {
  return (
    <svg width="30" height="30" viewBox="0 0 34 34" aria-hidden="true">
      <path d="M3 5 L17 29 L21 22 L11 5 Z" fill="var(--accent)" />
      <path d="M19 5 L31 5 L25 16 Z" fill="var(--text)" />
    </svg>
  )
}

function FinderProgress({ screen }: { screen: Screen }): JSX.Element {
  const current = FINDER_STEPS.findIndex((s) => s.screens.includes(screen))
  return (
    <ol className="progress" aria-label="Etapas">
      {FINDER_STEPS.map((step, i) => (
        <li
          key={step.label}
          className={i < current ? 'is-done' : i === current ? 'is-current' : undefined}
          aria-current={i === current ? 'step' : undefined}
        >
          <span className="progress-num">{i + 1}</span>
          {step.label}
        </li>
      ))}
    </ol>
  )
}

export default function App(): JSX.Element {
  const { settings, update, changeGame } = useSettings()
  const [section, setSection] = useState<Section>('finder')
  // Muda a cada clique no menu: clicar em "Treinos" de dentro de um resultado volta pra lista.
  const [navClicks, setNavClicks] = useState(0)
  const [screen, setScreen] = useState<Screen>('intro')
  const [answers, setAnswers] = useState<QuestionnaireAnswers | null>(null)
  const [baseSens, setBaseSens] = useState(0.4)
  const [aimResult, setAimResult] = useState<AimTestResult | null>(null)

  function handleQuestionnaire(a: QuestionnaireAnswers): void {
    const sens = a.hasKnownSens
      ? convertSens(a.sourceSens, a.sourceGame, a.targetGame)
      : heuristicSens(a.dpi, a.playStyle, a.targetGame)
    setAnswers(a)
    setBaseSens(sens)
    setAimResult(null)
    changeGame(a.targetGame)
    update({ dpi: a.dpi })
    setScreen('initialResult')
  }

  function handleRetest(newSens: number): void {
    setBaseSens(newSens)
    setAimResult(null)
    setScreen('aimTest')
  }

  function useInTraining(sens: number): void {
    update({ sens })
    setSection('library')
  }

  function restart(): void {
    setAnswers(null)
    setAimResult(null)
    setScreen('intro')
  }

  const trainingCm = gameCm360(settings.dpi, settings.sens, settings.game)

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <Logo />
          <span className="brand-name">Sens Finder</span>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`nav-item${section === item.id ? ' is-active' : ''}`}
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => {
                setSection(item.id)
                setNavClicks((n) => n + 1)
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="rail-foot">
          <span className="rail-caption">Sens de treino no {GAMES[settings.game].label}</span>
          <span className="rail-sens num">{settings.sens}</span>
          <span className="rail-caption">
            {trainingCm.toFixed(1).replace('.', ',')} cm por volta a {settings.dpi} DPI
          </span>
        </div>
      </aside>

      <main className="stage">
        {section === 'library' && <TrainingLibrary key={navClicks} />}
        {section === 'progress' && <ProgressPage onGoTraining={() => setSection('library')} />}
        {section === 'settings' && <SettingsPage />}

        {section === 'finder' && (
          <>
            {screen !== 'intro' && screen !== 'aimTest' && <FinderProgress screen={screen} />}

            {screen === 'intro' && (
              <section className="page hero">
                <h1 className="display display-xl">Encontre sua sensibilidade</h1>
                <p className="lede">
                  Pra Valorant, CS2, Apex, Overwatch 2, Call of Duty, Fortnite e Rainbow Six. Parte
                  do seu setup e ajusta pelo jeito que você mira: se você passa do alvo, a sens
                  desce; se fica curto, sobe.
                </p>

                <ol className="steps">
                  <li>
                    <span className="step-title">Setup</span>
                    <span className="step-body">O jogo, seu DPI e a sens que você já usa, se tiver.</span>
                  </li>
                  <li>
                    <span className="step-title">Três testes curtos</span>
                    <span className="step-body">Flick, Gridshot e Tracking em 3D. Leva cerca de 1 minuto.</span>
                  </li>
                  <li>
                    <span className="step-title">Ajuste</span>
                    <span className="step-body">A sens final e quantos centímetros de mousepad ela usa por volta.</span>
                  </li>
                </ol>

                <div className="button-row">
                  <button className="btn btn-primary" onClick={() => setScreen('questionnaire')}>
                    Começar
                  </button>
                </div>
              </section>
            )}

            {screen === 'questionnaire' && (
              <Questionnaire
                initialGame={settings.game}
                onSubmit={handleQuestionnaire}
                onBack={() => setScreen('intro')}
              />
            )}

            {screen === 'initialResult' && answers && (
              <InitialResult
                answers={answers}
                sens={baseSens}
                onStartAimTest={() => setScreen('aimTest')}
                onSkipToFinal={() => setScreen('finalResult')}
              />
            )}

            {screen === 'aimTest' && (
              <TestSuite
                sens={baseSens}
                onComplete={(result) => {
                  setAimResult(result)
                  setScreen('finalResult')
                }}
                onAbort={() => setScreen('initialResult')}
              />
            )}

            {screen === 'finalResult' && answers && (
              <FinalResult
                answers={answers}
                baseSens={baseSens}
                aimResult={aimResult}
                onRetest={handleRetest}
                onRestart={restart}
                onUseInTraining={useInTraining}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}
