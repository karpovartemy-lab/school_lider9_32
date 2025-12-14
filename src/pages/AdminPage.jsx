import { useCallback, useState } from 'react'
import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore'
import ImportDialog from '../components/ImportDialog'
import PresenceList from '../components/PresenceList'
import useWorkbookData from '../hooks/useWorkbookData'
import { firestore } from '../firebase'

export default function AdminPage({ isAdmin, user, presence }) {
  const [status, setStatus] = useState('')
  const { meta } = useWorkbookData()

  const handleImport = useCallback(
    async ({ meta: nextMeta, cells }) => {
      if (!isAdmin) throw new Error('Только администратор может импортировать данные')
      setStatus('Импортируем данные...')

      const existing = await getDocs(collection(firestore, 'cells'))
      const batches = []
      let batch = writeBatch(firestore)
      let ops = 0

      const commitBatch = () => {
        batches.push(batch.commit())
        batch = writeBatch(firestore)
        ops = 0
      }

      const metaRef = doc(firestore, 'meta', 'workbook')
      batch.set(metaRef, nextMeta)
      ops += 1

      existing.forEach((docSnap) => {
        batch.delete(docSnap.ref)
        ops += 1
        if (ops >= 400) commitBatch()
      })

      cells.forEach((cell) => {
        const cellRef = doc(firestore, 'cells', `${cell.r}_${cell.c}`)
        batch.set(
          cellRef,
          {
            ...cell,
            updatedAt: serverTimestamp(),
            updatedBy: user?.email ?? 'import',
          },
          { merge: true }
        )
        ops += 1
        if (ops >= 400) commitBatch()
      })

      if (ops > 0) {
        batches.push(batch.commit())
      }

      await Promise.all(batches)
      setStatus('Импорт завершен')
    },
    [isAdmin, user?.email]
  )

  if (!isAdmin) {
    return (
      <div className="grid">
        <section className="grid-main">
          <div className="card">
            <div className="card-header">
              <h2>Доступ ограничен</h2>
            </div>
            <p className="muted">Только администраторы могут импортировать и редактировать данные.</p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="grid">
      <section className="grid-main">
        <ImportDialog onImport={handleImport} />
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Текущая конфигурация</h2>
              <p className="muted">{status || 'Обновите таблицу через импорт Excel'}</p>
            </div>
          </div>
          <ul className="meta-list">
            <li>
              <strong>Строк:</strong> {meta.rows}
            </li>
            <li>
              <strong>Столбцов:</strong> {meta.cols}
            </li>
            <li>
              <strong>Колонки:</strong> {meta.colHeaders?.join(', ') || '—'}
            </li>
          </ul>
        </div>
      </section>
      <aside className="grid-side">
        <PresenceList presence={presence} currentUserId={user?.uid} />
      </aside>
    </div>
  )
}
