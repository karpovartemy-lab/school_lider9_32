import { useMemo, useState } from 'react'
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import PresenceList from '../components/PresenceList'
import useRankingData from '../hooks/useRankingData'
import { firestore } from '../firebase'

function QuarterTable({
  quarter,
  events,
  classes,
  scoreIndex,
  isAdmin,
  isEditing,
  onUpdateScore,
  onDeleteEvent,
  onDeleteClass,
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3>{quarter} четверть</h3>
          <p className="muted">Баллы по мероприятиям</p>
        </div>
      </div>
      <div className="table-wrapper">
        <table className="rating-table">
          <thead>
            <tr>
              <th>Мероприятие</th>
              {classes.map((cls) => (
                <th key={cls.id}>
                  <div className="table-heading">
                    <span>{cls.name}</span>
                    {isEditing && isAdmin && (
                      <button className="link danger" onClick={() => onDeleteClass(cls)}>
                        Удалить класс
                      </button>
                    )}
                  </div>
                </th>
              ))}
              {isEditing && isAdmin && <th>Действия</th>}
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td className="name-cell">{event.name}</td>
                {classes.map((cls) => {
                  const key = `${event.id}_${cls.id}`
                  const value = scoreIndex[key] ?? ''
                  if (!isEditing || !isAdmin) {
                    return <td key={cls.id}>{value === '' ? '—' : value}</td>
                  }
                  return (
                    <td key={cls.id}>
                      <input
                        className="cell-input"
                        type="number"
                        value={value}
                        onChange={(e) => onUpdateScore(event.id, cls.id, e.target.value)}
                        placeholder="0"
                      />
                    </td>
                  )
                })}
                {isEditing && isAdmin && (
                  <td>
                    <button className="danger" onClick={() => onDeleteEvent(event)}>
                      Удалить строку
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={classes.length + 1} className="muted">
                  Нет мероприятий для этой четверти
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function TablePage({ isAdmin, presence }) {
  const { table } = useRankingData()
  const [isEditing, setIsEditing] = useState(false)

  const quarters = useMemo(() => Object.keys(table.eventsByQuarter).map(Number).sort((a, b) => a - b), [table.eventsByQuarter])

  const handleUpdateScore = async (eventId, classId, value) => {
    const numeric = Number(value) || 0
    await setDoc(doc(firestore, 'scores', `${eventId}_${classId}`), {
      eventId,
      classId,
      points: numeric,
      updatedAt: serverTimestamp(),
    })
  }

  const handleDeleteEvent = async (event) => {
    if (!isAdmin) return
    await deleteDoc(doc(firestore, 'events', event.id))
    const scoresRef = collection(firestore, 'scores')
    const q = query(scoresRef, where('eventId', '==', event.id))
    const snapshot = await getDocs(q)
    await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)))
  }

  const handleDeleteClass = async (cls) => {
    if (!isAdmin) return
    await deleteDoc(doc(firestore, 'classes', cls.id))
    const scoresRef = collection(firestore, 'scores')
    const q = query(scoresRef, where('classId', '==', cls.id))
    const snapshot = await getDocs(q)
    await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)))
  }

  return (
    <div className="grid">
      <section className="grid-main full-width">
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Общая таблица</h2>
              <p className="muted">Структура формируется автоматически по четвертям и мероприятиям</p>
            </div>
            {isAdmin && (
              <button className="secondary" onClick={() => setIsEditing((v) => !v)}>
                {isEditing ? 'Завершить редактирование' : 'Редактировать таблицу'}
              </button>
            )}
          </div>
        </div>

        {quarters.map((quarter) => (
          <QuarterTable
            key={quarter}
            quarter={quarter}
            events={table.eventsByQuarter[quarter] || []}
            classes={table.classOrder}
            scoreIndex={table.scoreIndex}
            isAdmin={isAdmin}
            isEditing={isEditing}
            onUpdateScore={handleUpdateScore}
            onDeleteEvent={handleDeleteEvent}
            onDeleteClass={handleDeleteClass}
          />
        ))}
        {quarters.length === 0 && (
          <div className="card">
            <p className="muted">Добавьте мероприятия и классы, чтобы построить таблицу.</p>
          </div>
        )}
      </section>
      <aside className="grid-side">
        <PresenceList presence={presence} />
      </aside>
    </div>
  )
}
