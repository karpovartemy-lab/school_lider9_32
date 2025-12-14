import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { firestore } from '../firebase'

export default function useRankingData() {
  const [events, setEvents] = useState([])
  const [classes, setClasses] = useState([])
  const [scores, setScores] = useState([])
  const [bestClassDoc, setBestClassDoc] = useState(null)

  useEffect(() => {
    const eventsRef = collection(firestore, 'events')
    const classesRef = collection(firestore, 'classes')
    const scoresRef = collection(firestore, 'scores')
    const bestClassRef = doc(firestore, 'bestClass', 'ranking')

    const unsubEvents = onSnapshot(query(eventsRef, orderBy('quarter'), orderBy('createdAt')), (snapshot) => {
      const list = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      setEvents(list)
    })

    const unsubClasses = onSnapshot(query(classesRef, orderBy('name')), (snapshot) => {
      const list = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      setClasses(list)
    })

    const unsubScores = onSnapshot(scoresRef, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      setScores(list)
    })

    const unsubBestClass = onSnapshot(bestClassRef, (snapshot) => {
      setBestClassDoc(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null)
    })

    return () => {
      unsubEvents()
      unsubClasses()
      unsubScores()
      unsubBestClass()
    }
  }, [])

  const table = useMemo(() => {
    const classOrder = [...classes].sort((a, b) => a.name.localeCompare(b.name))
    const eventsByQuarter = events.reduce((acc, event) => {
      const quarter = event.quarter || 1
      acc[quarter] = acc[quarter] || []
      acc[quarter].push(event)
      return acc
    }, {})

    Object.values(eventsByQuarter).forEach((list) => list.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)))

    const scoreIndex = scores.reduce((acc, score) => {
      if (!score.eventId || !score.classId) return acc
      acc[`${score.eventId}_${score.classId}`] = Number(score.points) || 0
      return acc
    }, {})

    return { classOrder, eventsByQuarter, scoreIndex }
  }, [classes, events, scores])

  const totalsByClass = useMemo(() => {
    const totals = new Map()
    scores.forEach((score) => {
      const points = Number(score.points)
      if (!Number.isFinite(points)) return
      totals.set(score.classId, (totals.get(score.classId) || 0) + points)
    })
    return totals
  }, [scores])

  return { events, classes, scores, table, bestClassDoc, totalsByClass }
}
