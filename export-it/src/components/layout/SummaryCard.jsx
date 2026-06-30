export function SummaryCard({ title, ariaLabel, className = '', card = true, children }) {
  const classes = ['section', card && 'sidebar-card', className].filter(Boolean).join(' ')

  return (
    <section className={classes} aria-label={ariaLabel}>
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  )
}

export function SummaryFields({ compact = false, children }) {
  return (
    <dl className={`summary-fields${compact ? ' summary-fields-compact' : ''}`}>
      {children}
    </dl>
  )
}

export function SummaryStat({ label, value }) {
  return (
    <div className="summary-field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function SummaryField({ label, value, children, className = '' }) {
  return (
    <div className={`summary-field${className ? ` ${className}` : ''}`}>
      <span className="summary-field-label">{label}</span>
      {children ?? <span className="summary-field-value">{value}</span>}
    </div>
  )
}

export function SummaryActions({ children }) {
  return (
    <div className="summary-actions summary-actions-stack">
      {children}
    </div>
  )
}
