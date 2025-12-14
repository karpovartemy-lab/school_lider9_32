export default function HistoryPanel({ history }) {
  return (
    <div className="card history-card">
      <div className="card-header">
        <div>
          <h2>История изменений</h2>
          <p className="muted">Доступно только администраторам</p>
        </div>
      </div>
      <div className="history-table-wrapper">
        <table className="history-table">
          <thead>
            <tr>
              <th>Время</th>
              <th>Пользователь</th>
              <th>Строка</th>
              <th>Поле</th>
              <th>Было</th>
              <th>Стало</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id}>
                <td>{item.ts}</td>
                <td>{item.user}</td>
                <td>{item.rowId}</td>
                <td>{item.col}</td>
                <td className="muted">{item.before}</td>
                <td>{item.after}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan="6" className="muted">
                  История пока пустая
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
