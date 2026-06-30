import { ButtonSecondary } from '../Buttons.jsx'

export default function SecondaryActions({ actions }) {
  if (!actions?.length) return null

  return (
    <div className="secondary-actions">
      {actions.map((action) => (
        <ButtonSecondary
          key={action.label}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </ButtonSecondary>
      ))}
    </div>
  )
}
