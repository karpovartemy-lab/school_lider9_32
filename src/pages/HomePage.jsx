import { useEffect, useState } from 'react'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import useRankingData from '../hooks/useRankingData'
import PresenceList from '../components/PresenceList'
import { firestore } from '../firebase'

function computeBestClasses(classes, totalsByClass) {
  const list = classes
    .map((cls) => ({ classId: cls.id, className: cls.name, points: totalsByClass.get(cls.id) || 0 }))
    .sort((a, b) => b.points - a.points)

  const result = []
  let currentPlace = 0
  let previousPoints = null

  for (let i = 0; i < list.length && currentPlace < 3; i += 1) {
    const item = list[i]
    if (previousPoints === null || item.points !== previousPoints) {
      currentPlace = result.length === 0 ? 1 : currentPlace + 1
      previousPoints = item.points
    }
    if (currentPlace > 3) break
    result.push({ place: currentPlace, ...item })
  }

  return result.slice(0, 3)
}

export default function HomePage({ presence, currentUserId, isAdmin }) {
  const { classes, bestClassDoc, totalsByClass } = useRankingData()
  const [manualRating, setManualRating] = useState([
    { place: 1, className: '', points: '' },
    { place: 2, className: '', points: '' },
    { place: 3, className: '', points: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [autoRating, setAutoRating] = useState([])

  useEffect(() => {
    if (bestClassDoc?.places) {
      setManualRating(
        [1, 2, 3].map((place) => bestClassDoc.places.find((p) => p.place === place) || { place, className: '', points: '' })
      )
    }
  }, [bestClassDoc])

  useEffect(() => {
    setAutoRating(computeBestClasses(classes, totalsByClass))
  }, [classes, totalsByClass])

  const handleManualChange = (index, field, value) => {
    setManualRating((prev) => prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)))
  }

  const handleSaveManual = async () => {
    setSaving(true)
    const payload = manualRating.map((item, idx) => ({ place: idx + 1, className: item.className, points: Number(item.points) || 0 }))
    const docRef = doc(firestore, 'bestClass', 'ranking')
    await setDoc(docRef, { places: payload, updatedAt: serverTimestamp() })
    setSaving(false)
  }

  const handleAutoFill = async () => {
    const payload = autoRating.map((item) => ({ place: item.place, className: item.className, points: item.points }))
    const docRef = doc(firestore, 'bestClass', 'ranking')
    await setDoc(docRef, { places: payload, updatedAt: serverTimestamp(), source: 'auto' })
  }

  const ratingToDisplay = bestClassDoc?.places?.length ? bestClassDoc.places : manualRating

  return (
    <div className="grid">
      <section className="grid-main">
        <div className="card">
          <div className="card-header winners-header">
            <div>
              <h2>Лучший класс</h2>
              <p className="muted">Рейтинг формируется автоматически или вручную админом</p>
            </div>
            {isAdmin && (
              <div className="actions-row">
                <button onClick={handleAutoFill} className="secondary">
                  Рассчитать автоматически
                </button>
              </div>
            )}
          </div>

          <div className="podium">
            {ratingToDisplay.map((item) => (
              <div key={item.place} className={`podium-item place-${item.place}`}>
                <div className="place">{item.place} место</div>
                <div className="name">{item.className || 'Класс не задан'}</div>
                <div className="score">{Number(item.points) || 0}</div>
              </div>
            ))}
            {ratingToDisplay.length === 0 && <p className="muted">Нет данных</p>}
          </div>

          {isAdmin && (
            <div className="best-class-editor">
              <h3>Ручное редактирование</h3>
              <p className="muted">Изменения сразу сохраняются при нажатии «Сохранить»</p>
              <div className="best-class-grid">
                {manualRating.map((item, index) => (
                  <div key={item.place} className="best-class-row">
                    <div className="input-group">
                      <label>{item.place} место — класс</label>
                      <input
                        value={item.className}
                        onChange={(e) => handleManualChange(index, 'className', e.target.value)}
                        placeholder="Например: 7Б"
                      />
                    </div>
                    <div className="input-group">
                      <label>Баллы</label>
                      <input
                        type="number"
                        value={item.points}
                        onChange={(e) => handleManualChange(index, 'points', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={handleSaveManual} disabled={saving}>
                {saving ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          )}
        </div>
      </section>
      <aside className="grid-side">
        <PresenceList presence={presence} currentUserId={currentUserId} />
        <div className="card">
          <div className="card-header">
            <h3>Текущий автоподсчёт</h3>
          </div>
          <ul className="meta-list">
            {autoRating.map((item) => (
              <li key={item.classId || item.className}>
                <strong>{item.place} место:</strong> {item.className || '—'} — {item.points} баллов
              </li>
            ))}
            {autoRating.length === 0 && <li className="muted">Пока нет баллов</li>}
          </ul>
        </div>
      </aside>
    </div>
  )
}
