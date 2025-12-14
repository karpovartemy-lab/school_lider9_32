import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, query } from 'firebase/firestore'
import { firestore } from '../firebase'
import { ruFormulaToEn, sanitizeRuFormula } from '../utils/formulas'

const WorkbookContext = createContext(null)

export function WorkbookProvider({ children, user, isAdmin, presenceWriterRef, pushHistory, presence }) {
  const [meta, setMeta] = useState({ rows: 20, cols: 10, colHeaders: [], rowHeaders: true })
  const [cells, setCells] = useState([])
  const [ruFormulas, setRuFormulas] = useState({})

  useEffect(() => {
    const metaRef = doc(firestore, 'meta', 'workbook')
    const unsubscribe = onSnapshot(metaRef, (snapshot) => {
      const data = snapshot.data()
      if (data) {
        setMeta({
          rows: data.rows ?? 20,
          cols: data.cols ?? 10,
          colHeaders: data.colHeaders ?? [],
          rowHeaders: data.rowHeaders ?? true,
        })
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const cellsRef = query(collection(firestore, 'cells'))
    const unsubscribe = onSnapshot(cellsRef, (snapshot) => {
      const entries = snapshot.docs.map((docSnap) => docSnap.data())
      const ruMap = {}
      entries.forEach((entry) => {
        if (entry.f) {
          ruMap[`${entry.r}_${entry.c}`] = sanitizeRuFormula(entry.f)
        }
      })
      setCells(entries)
      setRuFormulas(ruMap)
    })

    return () => unsubscribe()
  }, [])

  const gridData = useMemo(() => {
    const matrix = Array.from({ length: meta.rows }, () => Array(meta.cols).fill(''))

    cells.forEach((cell) => {
      if (cell.r >= meta.rows || cell.c >= meta.cols) return
      if (cell.f) {
        matrix[cell.r][cell.c] = ruFormulaToEn(cell.f)
      } else if (cell.v !== undefined && cell.v !== null) {
        matrix[cell.r][cell.c] = cell.v
      }
    })

    return matrix
  }, [cells, meta.cols, meta.rows])

  const value = useMemo(
    () => ({ meta, cells, gridData, ruFormulas, isAdmin, user, presenceWriterRef, pushHistory, presence }),
    [cells, gridData, isAdmin, meta, presence, presenceWriterRef, pushHistory, ruFormulas, user]
  )

  return <WorkbookContext.Provider value={value}>{children}</WorkbookContext.Provider>
}

export function useWorkbook() {
  const ctx = useContext(WorkbookContext)
  if (!ctx) throw new Error('useWorkbook must be used inside WorkbookProvider')
  return ctx
}
