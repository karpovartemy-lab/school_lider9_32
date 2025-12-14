import { useMemo, useState } from 'react'
import { useWorkbook } from '../context/WorkbookContext'

function deriveName(meta, rowIndex, gridData) {
  if (meta.colHeaders?.length && meta.colHeaders[0]) {
    const value = gridData[rowIndex]?.[0]
    return value || `Участник ${rowIndex + 1}`
  }
  return `Участник ${rowIndex + 1}`
}

export default function HomePage() {
  const { meta, gridData } = useWorkbook()
  const [classFilter, setClassFilter] = useState('')

  const scoreColumnIndex = useMemo(() => {
    const targetNames = ['ИТОГО', 'БАЛЛЫ', 'РЕЗУЛЬТАТ', 'ОЧКИ']
    const idx = meta.colHeaders.findIndex((header) => targetNames.includes((header || '').toUpperCase()))
    if (idx !== -1) return idx
    return Math.max(meta.colHeaders.length - 1, 0)
  }, [meta.colHeaders])

  const classColumnIndex = useMemo(() => {
    const idx = meta.colHeaders.findIndex((header) => (header || '').toUpperCase().includes('КЛАСС'))
    return idx === -1 ? null : idx
  }, [meta.colHeaders])

  const ranked = useMemo(() => {
    const rows = gridData.map((row, index) => {
      const scoreRaw = row?.[scoreColumnIndex]
      const score = Number(scoreRaw) || 0
      const name = deriveName(meta, index, gridData)
      const classValue = classColumnIndex !== null ? row?.[classColumnIndex] : ''
      return { index, name, score, classValue }
    })

    const sliced = rows.slice(meta.colHeaders.length ? 1 : 0) // пропускаем строку заголовков из Excel

    const filtered = classFilter
      ? sliced.filter((row) => `${row.classValue ?? ''}`.toLowerCase().includes(classFilter.toLowerCase()))
      : sliced

    return filtered.sort((a, b) => b.score - a.score)
  }, [classColumnIndex, classFilter, gridData, meta, scoreColumnIndex])

  const topThree = ranked.slice(0, 3)
  const topTen = ranked.slice(0, 10)

  return (
    <div className="card">
      <div className="card-header winners-header">
        <div>
          <h2>Победители</h2>
          <p className="muted">Топ по столбцу «{meta.colHeaders[scoreColumnIndex] || 'Итого'}»</p>
        </div>
        <div className="input-group inline">
          <label>Фильтр по классу</label>
          <input
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            placeholder="Например: 9А или 10Б"
          />
        </div>
      </div>

      <div className="winners-grid">
        {topThree.map((row, idx) => (
          <div key={row.index} className={`winner-card place-${idx + 1}`}>
            <div className="place">{idx + 1}</div>
            <div className="name">{row.name}</div>
            <div className="muted">Баллы: {row.score}</div>
            {row.classValue && <div className="badge">{row.classValue}</div>}
          </div>
        ))}
      </div>

      <div className="top-list">
        <h3>Топ-10</h3>
        <ol>
          {topTen.map((row) => (
            <li key={row.index}>
              <div className="top-row">
                <div>
                  <strong>{row.name}</strong>
                  {row.classValue && <span className="muted"> — {row.classValue}</span>}
                </div>
                <span className="pill">{row.score}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
