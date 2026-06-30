import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'

const VARIANT_CLASS = {
  primary: 'btn--primary',
  secondary: 'btn--secondary',
  ghost: 'btn--ghost',
  danger: 'btn--danger',
  spotify: 'btn--spotify',
}

const SIZE_CLASS = {
  sm: 'btn--sm',
  md: 'btn--md',
  lg: 'btn--lg',
}

function joinClasses(...parts) {
  return parts.filter(Boolean).join(' ')
}

export function Button({
  variant = 'primary',
  size = 'md',
  iconLeft,
  loading = false,
  block = false,
  children,
  className = '',
  disabled = false,
  type = 'button',
  ...props
}) {
  const busy = loading || disabled

  return (
    <button
      type={type}
      className={joinClasses(
        'btn',
        VARIANT_CLASS[variant],
        size !== 'md' && SIZE_CLASS[size],
        block && 'btn--block',
        className,
      )}
      disabled={busy}
      aria-busy={loading || undefined}
      {...props}
    >
      {iconLeft ? (
        <FontAwesomeIcon
          icon={loading ? faSpinner : iconLeft}
          className={joinClasses('fa-icon', loading && 'fa-spin')}
        />
      ) : null}
      {children}
    </button>
  )
}

export function IconButton({
  icon,
  label,
  variant = 'secondary',
  loading = false,
  className = '',
  disabled = false,
  ...props
}) {
  const busy = loading || disabled
  const variantClass = variant === 'danger'
    ? 'icon-button--danger'
    : variant === 'ghost'
      ? 'icon-button--ghost'
      : 'icon-button--secondary'

  return (
    <button
      type="button"
      className={joinClasses('icon-button', variantClass, className)}
      title={label}
      aria-label={label}
      aria-busy={loading || undefined}
      disabled={busy}
      {...props}
    >
      <FontAwesomeIcon
        icon={loading ? faSpinner : icon}
        className={joinClasses('fa-icon', loading && 'fa-spin')}
      />
    </button>
  )
}

import { forwardRef } from 'react'

export const Input = forwardRef(function Input({ error = false, className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      className={joinClasses('input', error && 'input--error', className)}
      {...props}
    />
  )
})

export function Card({ className = '', children, ...props }) {
  return (
    <div className={joinClasses('card', className)} {...props}>
      {children}
    </div>
  )
}

export function Panel({ className = '', children, ...props }) {
  return (
    <div className={joinClasses('card', 'card--raised', className)} {...props}>
      {children}
    </div>
  )
}

export function Badge({ variant = 'muted', className = '', children, ...props }) {
  return (
    <span className={joinClasses('badge', `badge--${variant}`, className)} {...props}>
      {children}
    </span>
  )
}
