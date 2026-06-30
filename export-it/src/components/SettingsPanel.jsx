import { useState } from 'react'
import {
  faChevronDown,
  faChevronRight,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ButtonPrimary, ButtonSecondary, IconButton } from './Buttons.jsx'

const QUALITY_OPTIONS = [
  { value: 0, label: 'Best available MP3' },
  { value: 2, label: 'High' },
  { value: 5, label: 'Medium' },
  { value: 9, label: 'Smaller file size' },
]

export default function SettingsPanel({ settings, onClose, onSave }) {
  const [draft, setDraft] = useState({ ...settings })
  const [advancedOpen, setAdvancedOpen] = useState(false)

  function set(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="settings-title">
        <header className="modal-header">
          <h2 id="settings-title">Settings</h2>
          <IconButton icon={faXmark} label="Close settings" onClick={onClose} className="modal-close" />
        </header>
        <div className="modal-body">
          <section className="settings-section">
            <h3 className="settings-section-title">Downloads</h3>
            <div className="settings-fields">
              <div className="settings-field">
                <label>
                  Format
                  <select value={draft.fmt || 'mp3'} onChange={(e) => set('fmt', e.target.value)}>
                    <option value="mp3">MP3</option>
                    <option value="m4a">M4A</option>
                  </select>
                </label>
              </div>
              <div className="settings-field">
                <label>
                  Quality
                  <select
                    value={String(draft.mp3_quality ?? 0)}
                    onChange={(e) => set('mp3_quality', Number(e.target.value))}
                  >
                    {QUALITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                <span className="settings-field-hint">Higher quality uses more disk space.</span>
              </div>
              <div className="settings-field">
                <label>
                  Default output folder
                  <input
                    type="text"
                    value={draft.output_dir || ''}
                    onChange={(e) => set('output_dir', e.target.value)}
                    placeholder="/path/to/Music"
                  />
                </label>
              </div>
              <label className="settings-check">
                <input type="checkbox" checked={draft.embed_art !== false} onChange={(e) => set('embed_art', e.target.checked)} />
                Embed artwork in files
              </label>
              <label className="settings-check">
                <input type="checkbox" checked={draft.write_m3u_plain !== false} onChange={(e) => set('write_m3u_plain', e.target.checked)} />
                Write .m3u playlist file
              </label>
              <label className="settings-check">
                <input type="checkbox" checked={Boolean(draft.write_m3u8)} onChange={(e) => set('write_m3u8', e.target.checked)} />
                Write .m3u8 playlist file
              </label>
            </div>
          </section>

          <button
            type="button"
            className="settings-advanced-toggle"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
          >
            <span>Advanced</span>
            <FontAwesomeIcon icon={advancedOpen ? faChevronDown : faChevronRight} className="fa-icon" />
          </button>

          {advancedOpen && (
            <section className="settings-section">
              <div className="settings-fields">
                <label className="settings-check">
                  <input type="checkbox" checked={Boolean(draft.force_download)} onChange={(e) => set('force_download', e.target.checked)} />
                  Download low-confidence matches automatically
                </label>
                <div className="settings-field">
                  <label>
                    Cookies browser
                    <input
                      type="text"
                      value={draft.cookies_browser || ''}
                      onChange={(e) => set('cookies_browser', e.target.value)}
                      placeholder="chrome, firefox, safari"
                    />
                  </label>
                  <span className="settings-field-hint">Used by yt-dlp when a site requires login cookies.</span>
                </div>
                <div className="settings-field">
                  <label>
                    Cookies file path
                    <input
                      type="text"
                      value={draft.cookies_file || ''}
                      onChange={(e) => set('cookies_file', e.target.value)}
                      placeholder="/path/to/cookies.txt"
                    />
                  </label>
                </div>
              </div>
            </section>
          )}
        </div>
        <footer className="modal-footer">
          <ButtonSecondary onClick={onClose}>Cancel</ButtonSecondary>
          <ButtonPrimary onClick={() => onSave(draft)}>Save</ButtonPrimary>
        </footer>
      </div>
    </div>
  )
}
