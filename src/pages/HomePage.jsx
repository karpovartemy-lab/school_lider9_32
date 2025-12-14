import { useMemo, useState } from 'react'
import useWorkbookData from '../hooks/useWorkbookData'
import PresenceList from '../components/PresenceList'

function pickScoreColumn(headers) {
  const targetIndex = headers.findIndex((h) => /итог|балл/i.test(h || ''))
  if (targetIndex >= 0) return targetIndex
  return headers.length > 0 ? headers.length - 1 : 0
}

export default function HomePage({ presence, currentUserId }) {
  const { meta, data } = useWorkbookData()
  const [classFilter, setClassFilter] = useState('')

  const participants = useMemo(() => {
    const headers = meta.colHeaders ?? []
    const scoreIdx = pickScoreColumn(headers)
    const classIdx = headers.findIndex((h) => /класс/i.test(h || ''))
    const nameIdx = headers.findIndex((h) => /фио|участник|имя/i.test(h || '')) >= 0 ? headers.findIndex((h) => /фио|участник|имя/i.test(h || '')) : 0

    return (data || []).map((row, rowIndex) => {
      const name = `${row?.[nameIdx] ?? `Участник ${rowIndex + 1}`}`
      const scoreValue = Number(row?.[scoreIdx])
      const score = Number.isFinite(scoreValue) ? scoreValue : 0
      const className = classIdx >= 0 ? `${row?.[classIdx] ?? ''}` : ''
      return { rowIndex, name, score, className }
    })
  }, [data, meta.colHeaders])

  const filtered = classFilter ? participants.filter((p) => (p.className || '').toLowerCase() === classFilter.toLowerCase()) : participants
  const sorted = [...filtered].sort((a, b) => b.score - a.score)
  const topTen = sorted.slice(0, 10)
  const topThree = topTen.slice(0, 3)

  const classes = Array.from(new Set(participants.map((p) => p.className).filter(Boolean)))

  return (
    <div className="grid">
      <section className="grid-main">
        <div className="card">
          <div className="card-header winners-header">
            <div>
              <h2>Победители</h2>
              <p className="muted">Данные обновляются в реальном времени</p>
            </div>
            <div className="input-group inline">
              <label>Фильтр по классу</label>
              <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                <option value="">Все классы</option>
                {classes.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="podium">
            {topThree.map((item, index) => (
              <div key={item.rowIndex} className={`podium-item place-${index + 1}`}>
                <div className="place">{index + 1}</div>
                <div className="name">{item.name}</div>
                <div className="score">{item.score}</div>
                <div className="muted text-small">{item.className || 'Без класса'}</div>
              </div>
            ))}
            {topThree.length === 0 && <p className="muted">Пока нет данных</p>}
          </div>

          <div className="top-table-wrapper">
            <table className="rating-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Участник</th>
                  <th>Класс</th>
                  <th>Баллы</th>
                </tr>
              </thead>
              <tbody>
                {topTen.map((item, idx) => (
                  <tr key={item.rowIndex}>
                    <td>{idx + 1}</td>
                    <td>{item.name}</td>
                    <td>{item.className || '—'}</td>
                    <td>{item.score}</td>
                  </tr>
                ))}
                {topTen.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      Нет данных для отображения
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <aside className="grid-side">
        <PresenceList presence={presence} currentUserId={currentUserId} />
      </aside>
    </div>
  )
}
