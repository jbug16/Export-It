import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { ButtonPrimary } from '../Buttons.jsx'
import { SummaryActions, SummaryCard, SummaryField } from './SummaryCard.jsx'

export default function CompletionView({
  downloaded,
  total,
  savedPath,
  issueCount,
  onDownloadMore,
  compact,
}) {
  const songLabel = downloaded === 1 ? 'song' : 'songs'
  const countValue = `${downloaded} ${songLabel} downloaded${total > downloaded ? ` of ${total}` : ''}`

  return (
    <SummaryCard
      title="Done"
      ariaLabel="Download complete"
      className="completion-view"
      card={compact}
    >
      <SummaryField label="Songs" value={countValue} />
      {issueCount > 0 && (
        <SummaryField
          label="Issues"
          value={`${issueCount} need attention`}
          className="summary-field-error"
        />
      )}
      {savedPath && (
        <SummaryField label="Save location" value={savedPath} className="summary-field-path" />
      )}
      <SummaryActions>
        <ButtonPrimary icon={faDownload} onClick={onDownloadMore} block>
          Download more
        </ButtonPrimary>
      </SummaryActions>
    </SummaryCard>
  )
}
