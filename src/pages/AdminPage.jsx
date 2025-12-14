import { useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import PresenceList from '../components/PresenceList'
import useRankingData from '../hooks/useRankingData'
import { firestore } from '../firebase'

const LETTER_SCHEMES = {
  letters: ['а', 'б', 'в', 'г', 'д'],
  numbers: ['.1', '.2', '.3', '.4', '.5'],
}

export default function AdminPage({ isAdmin, user, presence }) {
  const { events, classes } = useRankingData()
  const [eventForm, setEventForm] = useState({ name: '', quarter: '1' })
  const [classForm, setClassForm] = useState({ parallel: '1', scheme: 'letters', single: '' })
  const [scoreForm, setScoreForm] = useState({ eventId: '', classIds: [], points: '' })
  const [isEditingEvents, setIsEditingEvents] = useState(false)
  const [isEditingClasses, setIsEditingClasses] = useState(false)

  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.quarter - b.quarter), [events])
  const sortedClasses = useMemo(() => [...classes].sort((a, b) => a.name.localeCompare(b.name)), [classes])

  if (!isAdmin) {
    return (
      <div className="grid">
        <section className="grid-main">
          <div className="card">
            <div className="card-header">
              <h2>Доступ ограничен</h2>
            </div>
            <p className="muted">Только администраторы могут управлять базой и баллами.</p>
          </div>
        </section>
      </div>
    )
  }

  const handleAddEvent = async () => {
    if (!eventForm.name.trim()) return
    try {
      await addDoc(collection(firestore, 'events'), {
        name: eventForm.name.trim(),
        quarter: Number(eventForm.quarter) || 1,
        createdAt: serverTimestamp(),
        createdBy: user?.uid ?? 'unknown',
      })
      setEventForm({ name: '', quarter: eventForm.quarter })
    } catch (error) {
      console.error('Ошибка сохранения мероприятия:', error)
      alert(`Ошибка сохранения: ${error.message}`)
    }
  }

  const handleSaveEvents = async (nextEvents) => {
    try {
      const batchWrites = nextEvents.map((item) => setDoc(doc(firestore, 'events', item.id), item))
      const currentIds = new Set(nextEvents.map((e) => e.id))
      const deletions = events.filter((e) => !currentIds.has(e.id)).map((e) => deleteDoc(doc(firestore, 'events', e.id)))
      await Promise.all([...batchWrites, ...deletions])
      setIsEditingEvents(false)
    } catch (error) {
      console.error('Ошибка сохранения списка мероприятий:', error)
      alert(`Ошибка сохранения: ${error.message}`)
    }
  }

  const handleAddClasses = async () => {
    const base = classForm.parallel.trim()
    if (!base) return
    const suffixes = LETTER_SCHEMES[classForm.scheme]
    const names = suffixes.map((suf) => `${base}${suf}`)
    const batch = writeBatch(firestore)
    try {
      names.forEach((name) => {
        const classRef = doc(collection(firestore, 'classes'))
        batch.set(classRef, {
          name,
          createdAt: serverTimestamp(),
          createdBy: user?.uid ?? 'unknown',
        })
      })
      await batch.commit()
    } catch (error) {
      console.error('Ошибка массового добавления классов:', error)
      alert(`Ошибка сохранения: ${error.message}`)
    }
  }

  const handleAddSingleClass = async () => {
    if (!classForm.single.trim()) return
    try {
      await addDoc(collection(firestore, 'classes'), {
        name: classForm.single.trim(),
        createdAt: serverTimestamp(),
        createdBy: user?.uid ?? 'unknown',
      })
      setClassForm((prev) => ({ ...prev, single: '' }))
    } catch (error) {
      console.error('Ошибка добавления класса:', error)
      alert(`Ошибка сохранения: ${error.message}`)
    }
  }

  const handleSaveClasses = async (nextClasses) => {
    try {
      const writers = nextClasses.map((cls) => setDoc(doc(firestore, 'classes', cls.id), cls))
      const currentIds = new Set(nextClasses.map((c) => c.id))
      const deletions = classes.filter((c) => !currentIds.has(c.id)).map((c) => deleteDoc(doc(firestore, 'classes', c.id)))
      await Promise.all([...writers, ...deletions])
      setIsEditingClasses(false)
    } catch (error) {
      console.error('Ошибка сохранения списка классов:', error)
      alert(`Ошибка сохранения: ${error.message}`)
    }
  }

  const handleAddScore = async () => {
    if (!scoreForm.eventId || scoreForm.classIds.length === 0) return
    const pointsValue = Number(scoreForm.points) || 0
    try {
      const ops = scoreForm.classIds.map((classId) =>
        setDoc(doc(firestore, 'scores', `${scoreForm.eventId}_${classId}`), {
          eventId: scoreForm.eventId,
          classId,
          points: pointsValue,
          updatedAt: serverTimestamp(),
          updatedBy: user?.email ?? 'admin',
        })
      )
      await Promise.all(ops)
      setScoreForm({ eventId: scoreForm.eventId, classIds: [], points: '' })
    } catch (error) {
      console.error('Ошибка сохранения баллов:', error)
      alert(`Ошибка сохранения: ${error.message}`)
    }
  }

  const handleToggleClass = (classId) => {
    setScoreForm((prev) => {
      const exists = prev.classIds.includes(classId)
      return {
        ...prev,
        classIds: exists ? prev.classIds.filter((id) => id !== classId) : [...prev.classIds, classId],
      }
    })
  }

  return (
    <div className="grid">
      <section className="grid-main">
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Мероприятия</h2>
              <p className="muted">Укажите четверть и название. Список сортируется автоматически.</p>
            </div>
            <button className="secondary" onClick={() => setIsEditingEvents((v) => !v)}>
              {isEditingEvents ? 'Свернуть' : 'Редактировать'}
            </button>
          </div>
          <div className="input-grid">
            <div className="input-group">
              <label>Четверть</label>
              <select value={eventForm.quarter} onChange={(e) => setEventForm((prev) => ({ ...prev, quarter: e.target.value }))}>
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Название мероприятия</label>
              <input
                value={eventForm.name}
                onChange={(e) => setEventForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Например: День чтецов"
              />
            </div>
            <button onClick={handleAddEvent}>Добавить мероприятие</button>
          </div>
          {isEditingEvents && (
            <div className="editable-list">
              {sortedEvents.map((event) => (
                <div key={event.id} className="editable-row">
                  <input
                    className="small"
                    type="number"
                    min="1"
                    max="4"
                    value={event.quarter}
                    onChange={(e) => (event.quarter = Number(e.target.value))}
                  />
                  <input
                    value={event.name}
                    onChange={(e) => (event.name = e.target.value)}
                    className="flex"
                  />
                  <button onClick={() => handleSaveEvents(sortedEvents.filter((ev) => ev.id !== event.id))} className="danger">
                    Удалить
                  </button>
                </div>
              ))}
              <button onClick={() => handleSaveEvents(sortedEvents)}>Сохранить</button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2>Классы</h2>
              <p className="muted">Добавляйте классы массово или по одному</p>
            </div>
            <button className="secondary" onClick={() => setIsEditingClasses((v) => !v)}>
              {isEditingClasses ? 'Свернуть' : 'Редактировать'}
            </button>
          </div>
          <div className="input-grid">
            <div className="input-group">
              <label>Параллель</label>
              <input
                value={classForm.parallel}
                onChange={(e) => setClassForm((prev) => ({ ...prev, parallel: e.target.value }))}
                placeholder="1"
              />
            </div>
            <div className="input-group">
              <label>Схема</label>
              <select value={classForm.scheme} onChange={(e) => setClassForm((prev) => ({ ...prev, scheme: e.target.value }))}>
                <option value="letters">буквы: а–д</option>
                <option value="numbers">цифры: .1 – .5</option>
              </select>
            </div>
            <button onClick={handleAddClasses}>Размножить</button>
          </div>
          <div className="input-grid">
            <div className="input-group">
              <label>Добавить один класс</label>
              <input
                value={classForm.single}
                onChange={(e) => setClassForm((prev) => ({ ...prev, single: e.target.value }))}
                placeholder="Например: 7Б"
              />
            </div>
            <button onClick={handleAddSingleClass}>Добавить один класс</button>
          </div>
          {isEditingClasses && (
            <div className="editable-list">
              {sortedClasses.map((cls) => (
                <div key={cls.id} className="editable-row">
                  <input value={cls.name} onChange={(e) => (cls.name = e.target.value)} className="flex" />
                  <button onClick={() => handleSaveClasses(sortedClasses.filter((c) => c.id !== cls.id))} className="danger">
                    Удалить
                  </button>
                </div>
              ))}
              <button onClick={() => handleSaveClasses(sortedClasses)}>Сохранить</button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2>Окно формирования таблицы</h2>
              <p className="muted">Добавляйте баллы для выбранного мероприятия и классов</p>
            </div>
          </div>
          <div className="input-grid">
            <div className="input-group">
              <label>Мероприятие</label>
              <select
                value={scoreForm.eventId}
                onChange={(e) => setScoreForm((prev) => ({ ...prev, eventId: e.target.value }))}
              >
                <option value="">Выберите мероприятие</option>
                {sortedEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} — {event.quarter} четв.
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Баллы</label>
              <input
                type="number"
                value={scoreForm.points}
                onChange={(e) => setScoreForm((prev) => ({ ...prev, points: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          <div className="class-checkboxes">
            {sortedClasses.map((cls) => (
              <label key={cls.id} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={scoreForm.classIds.includes(cls.id)}
                  onChange={() => handleToggleClass(cls.id)}
                />
                {cls.name}
              </label>
            ))}
          </div>
          <button onClick={handleAddScore}>Добавить в таблицу</button>
          <p className="muted text-small">
            Одиночное добавление — выберите один класс. Массовое — отметьте сразу несколько.
          </p>
        </div>

        <div className="card debug-panel">
          <div className="card-header">
            <div>
              <h2>Debug</h2>
              <p className="muted">Отображение данных из подписок</p>
            </div>
          </div>
          <div className="debug-grid">
            <div>
              <p className="muted">Events loaded: {events.length}</p>
              <ul>
                {events
                  .slice(-3)
                  .reverse()
                  .map((event) => (
                    <li key={event.id}>
                      {event.name} ({event.quarter} четв.)
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <p className="muted">Classes loaded: {classes.length}</p>
              <ul>
                {classes
                  .slice(-3)
                  .reverse()
                  .map((cls) => (
                    <li key={cls.id}>{cls.name}</li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
      <aside className="grid-side">
        <PresenceList presence={presence} currentUserId={user?.uid} />
      </aside>
    </div>
  )
}
