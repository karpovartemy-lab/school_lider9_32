import Spreadsheet from '../components/spreadsheet/Spreadsheet'
import { useWorkbook } from '../context/WorkbookContext'

export default function TablePage({ isAdmin }) {
  const { meta } = useWorkbook()

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>Полная таблица рейтинга</h2>
          <p className="muted">Редактирование как в Excel / Google Sheets</p>
        </div>
        {!isAdmin && <div className="pill muted">Только чтение</div>}
      </div>
      <Spreadsheet isAdmin={isAdmin} meta={meta} />
    </div>
  )
}
