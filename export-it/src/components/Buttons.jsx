import { faSpotify } from '@fortawesome/free-brands-svg-icons'
import { Button } from './ui/index.jsx'

/** @deprecated Use Button with variant="primary" */
export function ButtonPrimary({ icon, children, className = '', block = false, ...props }) {
  return (
    <Button variant="primary" iconLeft={icon} className={className} block={block} {...props}>
      {children}
    </Button>
  )
}

/** @deprecated Use Button with variant="secondary" */
export function ButtonSecondary({ icon, children, className = '', size, block = false, ...props }) {
  const isCompact = className.includes('btn-compact') || size === 'sm'
  return (
    <Button
      variant="secondary"
      iconLeft={icon}
      size={isCompact ? 'sm' : 'md'}
      className={className.replace('btn-compact', '').trim()}
      block={block || className.includes('btn-block')}
      {...props}
    >
      {children}
    </Button>
  )
}

/** @deprecated Use Button with variant="ghost" */
export function ButtonGhost({ icon, children, label, className = '', ...props }) {
  const ariaLabel = label || (typeof children === 'string' ? children : undefined)
  return (
    <Button
      variant="ghost"
      iconLeft={icon}
      className={className}
      aria-label={ariaLabel}
      title={ariaLabel}
      {...props}
    >
      {children}
    </Button>
  )
}

/** @deprecated Use Button with variant="spotify" */
export function ButtonSpotify({ children, loading, className = '', ...props }) {
  return (
    <Button
      variant="spotify"
      iconLeft={faSpotify}
      loading={loading}
      className={className}
      disabled={loading || props.disabled}
      {...props}
    >
      {children}
    </Button>
  )
}

/** @deprecated Use IconButton from ui/index.jsx */
export { IconButton } from './ui/index.jsx'

export function TextButton({ label, text, variant = '', className = '', ...props }) {
  const display = text ?? label
  const variantClass = variant ? ` text-button--${variant}` : ''
  return (
    <button
      type="button"
      className={`text-button${variantClass}${className ? ` ${className}` : ''}`}
      title={label}
      aria-label={label}
      {...props}
    >
      {display}
    </button>
  )
}

export { Button, IconButton as IconButtonBase, Input, Card, Panel, Badge } from './ui/index.jsx'
