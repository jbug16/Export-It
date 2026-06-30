import { useState } from 'react'

export default function SettingsPanel({ settings, onClose, onSave }) {
  const [draft, setDraft] = useState({ ...settings })

  function set(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="settings-title">
        <header className="modal-header">
          <h2 id="settings-title">Settings</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>×</button>
        </header>
        <div className="modal-body settings-grid">
          <label>
            Format
            <select value={draft.fmt || 'mp3'} onChange={(e) => set('fmt', e.target.value)}>
              <option value="mp3">MP3</option>
              <option value="m4a">M4A</option>
            </select>
          </label>
          <label>
            MP3 quality (0 = best VBR)
            <input type="number" min={0} max={10} value={draft.mp3_quality ?? 0} onChange={(e) => set('mp3_quality', Number(e.target.value))} />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={draft.embed_art !== false} onChange={(e) => set('embed_art', e.target.checked)} />
            Embed artwork
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={draft.write_m3u_plain !== false} onChange={(e) => set('write_m3u_plain', e.target.checked)} />
            Write .m3u playlist
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={Boolean(draft.write_m3u8)} onChange={(e) => set('write_m3u8', e.target.checked)} />
            Write .m3u8 playlist
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={Boolean(draft.force_download)} onChange={(e) => set('force_download', e.target.checked)} />
            Force download low-confidence matches
          </label>
          <label>
            Default output folder
            <input type="text" value={draft.output_dir || ''} onChange={(e) => set('output_dir', e.target.value)} placeholder="/path/to/Music" />
          </label>
          <label>
            Cookies browser (yt-dlp)
            <input type="text" value={draft.cookies_browser || ''} onChange={(e) => set('cookies_browser', e.target.value)} placeholder="chrome, firefox, safari" />
          </label>
          <label>
            Cookies file path
            <input type="text" value={draft.cookies_file || ''} onChange={(e) => set('cookies_file', e.target.value)} placeholder="/path/to/cookies.txt" />
          </label>
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(draft)}>Save</button>
        </footer>
      </div>
    </div>
  )
}
