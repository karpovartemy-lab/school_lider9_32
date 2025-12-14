export default function PresenceList({ presence, currentUserId }) {
  const onlineEntries = Object.values(presence || {})
    .filter((item) => item && item.status !== 'offline')
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>Онлайн</h2>
          <p className="muted">Кто сейчас смотрит или редактирует</p>
        </div>
      </div>
      <div className="presence-list">
        {onlineEntries.length === 0 && <p className="muted">Никого нет онлайн</p>}
        {onlineEntries.map((entry) => (
          <div key={entry.uid} className={`presence-item ${entry.uid === currentUserId ? 'me' : ''}`}>
            <div className="presence-avatar">{(entry.name || '?').slice(0, 2).toUpperCase()}</div>
            <div>
              <div className="presence-name">{entry.name || 'Неизвестно'}</div>
              <div className="muted text-small">
                {entry.editing?.r !== undefined && entry.editing?.c !== undefined
                  ? `Редактирует ${entry.editing.r + 1}:${entry.editing.c + 1}`
                  : 'Просматривает'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
