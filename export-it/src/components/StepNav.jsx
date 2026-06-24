const STEPS = [
  { id: 1, label: 'Paste links' },
  { id: 2, label: 'Review album info' },
  { id: 3, label: 'Download' },
]

/**
 * @param {object} props
 * @param {number} props.currentStep
 */
export default function StepNav({ currentStep }) {
  return (
    <nav className="step-nav" aria-label="Steps">
      {STEPS.map((step, i) => (
        <div
          key={step.id}
          className={`step-nav__item${
            step.id === currentStep
              ? ' step-nav__item--active'
              : step.id < currentStep
                ? ' step-nav__item--done'
                : ''
          }`}
        >
          <span className="step-nav__num">{step.id}</span>
          <span className="step-nav__label">{step.label}</span>
          {i < STEPS.length - 1 ? <span className="step-nav__line" aria-hidden /> : null}
        </div>
      ))}
    </nav>
  )
}

/**
 * @param {object[]} rows
 * @param {boolean} isRunning
 * @param {object | null} job
 */
export function getCurrentStep(rows, isRunning, job) {
  const withUrl = rows.filter((r) => r.url?.trim())
  if (withUrl.length === 0) return 1

  if (isRunning || job) return 3

  const reviewing = withUrl.some(
    (r) =>
      r.uiStatus === 'reading' ||
      r.uiStatus === 'searching' ||
      (r.uiStatus === 'needs_review' && !r.selectedMatch && !r.useYoutubeTitlesOnly),
  )
  if (reviewing) return 2

  const anyReady = withUrl.some(
    (r) => r.uiStatus === 'ready' || r.useYoutubeTitlesOnly,
  )
  if (anyReady) return 3

  return 2
}
