import { faDownload, faFolderOpen } from '@fortawesome/free-solid-svg-icons'
import { ButtonPrimary, IconButton } from '../Buttons.jsx'
import { Input } from '../ui/index.jsx'
import { SummaryActions, SummaryCard, SummaryFields, SummaryStat } from './SummaryCard.jsx'

const FORMAT_OPTIONS = [
  { value: 'mp3', label: 'MP3' },
  { value: 'm4a', label: 'M4A' },
]

export default function DownloadSummaryCard({
  itemCount,
  songCount,
  settings,
  outDir,
  onSettingsChange,
  onOutDirChange,
  onBrowseFolder,
  browseDisabled,
  browseLoading,
  downloadLabel,
  onDownload,
  disabled,
}) {
  const itemWord = itemCount === 1 ? 'item' : 'items'
  const songWord = songCount === 1 ? 'song' : 'songs'

  function setSetting(key, value) {
    onSettingsChange({ ...settings, [key]: value })
  }

  const format = settings.fmt || 'mp3'

  return (
    <SummaryCard title="Download setup" ariaLabel="Download setup" className="download-summary">
      <SummaryFields compact>
        <SummaryStat label="Items" value={`${itemCount} ${itemWord}`} />
        <SummaryStat label="Songs" value={`${songCount} ${songWord}`} />
      </SummaryFields>

      <div className="summary-field summary-field-edit">
        <span className="summary-field-label label" id="summary-format-label">Format</span>
        <div className="format-segment" role="group" aria-labelledby="summary-format-label">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={format === opt.value ? 'format-segment-btn active' : 'format-segment-btn'}
              aria-pressed={format === opt.value}
              onClick={() => setSetting('fmt', opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="summary-field summary-field-edit">
        <label className="summary-field-label label" htmlFor="summary-out-dir">Save location</label>
        <div className="summary-path-row">
          <Input
            id="summary-out-dir"
            type="text"
            value={outDir}
            onChange={(e) => onOutDirChange(e.target.value)}
            placeholder="/path/to/Music"
          />
          <IconButton
            className="summary-browse-btn"
            icon={faFolderOpen}
            label={browseLoading ? 'Opening folder picker…' : 'Browse for folder'}
            onClick={onBrowseFolder}
            loading={browseLoading}
            disabled={browseDisabled && !browseLoading}
          />
        </div>
      </div>

      <SummaryActions>
        <ButtonPrimary icon={faDownload} onClick={onDownload} disabled={disabled} block>
          {downloadLabel}
        </ButtonPrimary>
      </SummaryActions>
    </SummaryCard>
  )
}
