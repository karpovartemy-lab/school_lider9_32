import { useMemo } from 'react'

export default function RankingTable({ columns, rows, isAdmin, onEditCell, onEditingRowChange }) {
  const normalizedColumns = useMemo(() => columns ?? [], [columns])
  const normalizedRows = useMemo(() => rows ?? [], [rows])

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>Рейтинг</h2>
          <p className="muted">Данные обновляются в реальном времени</p>
        </div>
      </div>
      <div className="table-wrapper">
        <table className="rating-table">
          <thead>
            <tr>
              <th>ФИО</th>
              {normalizedColumns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {normalizedRows.map((row) => (
              <tr key={row.id}>
                <td className="name-cell">{row.name || '—'}</td>
                {normalizedColumns.map((col) => {
                  const value = row.data?.[col] ?? ''
                  if (!isAdmin) {
                    return <td key={col}>{value}</td>
                  }

                  return (
                    <td key={col}>
                      <input
                        className="cell-input"
                        value={value}
                        onFocus={() => onEditingRowChange?.(row.id)}
                        onBlur={() => onEditingRowChange?.(null)}
                        onChange={(e) => onEditCell(row.id, col, e.target.value)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
