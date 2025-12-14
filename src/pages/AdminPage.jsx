import { useCallback, useEffect, useState } from 'react'
import { collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore'
import ImportWorkbook from '../components/spreadsheet/ImportWorkbook'
import { firestore } from '../firebase'
import { useWorkbook } from '../context/WorkbookContext'

export default function AdminPage({ isAdmin }) {
  const { user } = useWorkbook()
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!isAdmin) return undefined
    const q = query(collection(firestore, 'history'), orderBy('ts', 'desc'))
    const unsub = onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.slice(0, 100).map((docSnap) => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          ts: data.ts?.toDate ? data.ts.toDate().toLocaleString('ru-RU') : '—',
          user: data.user ?? 'Неизвестно',
          rowId: data.rowId,
          col: data.col,
          before: data.before ?? '',
          after: data.after ?? '',
        }
      })
      setHistory(rows)
    })
    return () => unsub()
  }, [isAdmin])

  const handleImport = useCallback(
    async ({ meta, cells }) => {
      if (!isAdmin) return
      const batch = writeBatch(firestore)
      const metaRef = doc(firestore, 'meta', 'workbook')
      batch.set(metaRef, meta)

      const existing = await getDocs(collection(firestore, 'cells'))
      existing.forEach((docSnap) => batch.delete(docSnap.ref))

      cells.forEach((cell) => {
        const cellRef = doc(firestore, 'cells', `${cell.r}_${cell.c}`)
        batch.set(cellRef, {
          ...cell,
          updatedBy: user?.email ?? 'импорт',
          updatedAt: serverTimestamp(),
        })
      })

      await batch.commit()
    },
    [isAdmin, user]
  )

  if (!isAdmin) {
    return (
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Импорт и настройки</h2>
            <p className="muted">Недоступно. Требуются права администратора.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      <ImportWorkbook onImport={handleImport} />

      <div className="card history-card">
        <div className="card-header">
          <div>
            <h2>История изменений</h2>
            <p className="muted">Последние записи</p>
          </div>
        </div>
        <div className="history-table-wrapper">
          <table className="history-table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Пользователь</th>
                <th>Строка</th>
                <th>Колонка</th>
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
    </div>
  )
}
