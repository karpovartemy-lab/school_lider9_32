import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { firestore } from '../firebase'

const defaultMeta = {
  rows: 20,
  cols: 10,
  colHeaders: [],
  rowHeaders: true,
}

export default function useWorkbookData() {
  const [meta, setMeta] = useState(defaultMeta)
  const [cells, setCells] = useState(new Map())

  useEffect(() => {
    const metaRef = doc(firestore, 'meta', 'workbook')
    const unsubMeta = onSnapshot(metaRef, (snapshot) => {
      const data = snapshot.data()
      if (data) {
        setMeta({
          rows: data.rows ?? defaultMeta.rows,
          cols: data.cols ?? defaultMeta.cols,
          colHeaders: data.colHeaders ?? [],
          rowHeaders: data.rowHeaders ?? true,
        })
      }
    })

    const cellsRef = collection(firestore, 'cells')
    const unsubCells = onSnapshot(cellsRef, (snapshot) => {
      const next = new Map()
      snapshot.forEach((docSnap) => {
        next.set(docSnap.id, docSnap.data())
      })
      setCells(next)
    })

    return () => {
      unsubMeta()
      unsubCells()
    }
  }, [])

  const { data, ruFormulas } = useMemo(() => {
    const data = Array.from({ length: meta.rows ?? 0 }, () => Array(meta.cols ?? 0).fill(''))
    const ruFormulas = new Map()
    cells.forEach((cell) => {
      if (data[cell.r] && typeof cell.c === 'number' && data[cell.r][cell.c] !== undefined) {
        data[cell.r][cell.c] = cell.f ?? cell.v ?? ''
        if (cell.fRu) {
          ruFormulas.set(`${cell.r}_${cell.c}`, cell.fRu)
        }
      }
    })

    return { data, ruFormulas }
  }, [cells, meta.cols, meta.rows])

  return { meta, cells, data, ruFormulas }
}
