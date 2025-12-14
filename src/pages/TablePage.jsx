import { useCallback, useMemo, useRef, useState } from 'react'
import { HotTable } from '@handsontable/react'
import { HyperFormula } from 'hyperformula'
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import PresenceList from '../components/PresenceList'
import { firestore } from '../firebase'
import useWorkbookData from '../hooks/useWorkbookData'
import { normalizeRussianFormula } from '../utils/formulas'

const hyperformulaInstance = HyperFormula.buildEmpty()

export default function TablePage({ user, isAdmin, presence, onEditingCellChange }) {
  const { meta, data, ruFormulas } = useWorkbookData()
  const hotRef = useRef(null)
  const pendingRu = useRef(new Map())
  const [activeFormula, setActiveFormula] = useState('')

  const colHeaders = useMemo(() => {
    if (meta.colHeaders?.length) return meta.colHeaders
    return true
  }, [meta.colHeaders])

  const handleBeforeChange = useCallback((changes) => {
    if (!changes) return
    changes.forEach((change) => {
      const [row, prop, , newValue] = change
      const { ru, en, isFormula } = normalizeRussianFormula(newValue)
      if (isFormula) {
        pendingRu.current.set(`${row}_${prop}`, ru)
        change[3] = en
      } else {
        pendingRu.current.set(`${row}_${prop}`, null)
      }
    })
  }, [])

  const handleAfterChange = useCallback(
    async (changes, source) => {
      if (source === 'loadData' || !changes || !isAdmin) return
      const hot = hotRef.current?.hotInstance
      const formulasPlugin = hot?.getPlugin('formulas')
      const engine = formulasPlugin?.engine

      const batch = writeBatch(firestore)
      changes.forEach(([row, prop, , newValue]) => {
        const ru = pendingRu.current.get(`${row}_${prop}`) ?? null
        const { en, isFormula } = normalizeRussianFormula(ru ?? newValue)
        const docRef = doc(firestore, 'cells', `${row}_${prop}`)
        let valueToSave = newValue ?? ''
        if (isFormula && engine) {
          const computed = engine.getCellValue({ row, col: prop, sheet: 0 })
          valueToSave = computed ?? ''
        }
        batch.set(
          docRef,
          {
            r: row,
            c: prop,
            v: valueToSave,
            fRu: isFormula ? ru : null,
            f: isFormula ? en : null,
            updatedAt: serverTimestamp(),
            updatedBy: user?.email ?? 'guest',
          },
          { merge: true }
        )
      })
      pendingRu.current.clear()
      await batch.commit()
    },
    [isAdmin, user?.email]
  )

  const handleAfterSelection = useCallback(
    (row, col) => {
      const ruFormula = ruFormulas.get(`${row}_${col}`) ?? ''
      setActiveFormula(ruFormula)
      onEditingCellChange?.({ r: row, c: col })
    },
    [onEditingCellChange, ruFormulas]
  )

  const cellPresence = useMemo(() => {
    const entries = Object.values(presence || {})
    return entries
      .filter((entry) => entry?.editing && entry.status !== 'offline')
      .map((entry) => ({
        uid: entry.uid,
        coords: entry.editing,
        name: entry.name,
      }))
  }, [presence])

  return (
    <div className="grid">
      <section className="grid-main full-width">
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Полная таблица рейтинга</h2>
              <p className="muted">Excel-опыт, копирование, авто-заполнение и формулы</p>
            </div>
            <div className="formula-bar">
              <label>Формула (RU)</label>
              <input value={activeFormula} readOnly placeholder="Выберите ячейку с формулой" />
            </div>
          </div>
          <div className="hot-wrapper">
            <HotTable
              ref={hotRef}
              data={data}
              height="70vh"
              width="100%"
              stretchH="all"
              colHeaders={colHeaders}
              rowHeaders={meta.rowHeaders}
              fixedColumnsStart={1}
              fixedRowsTop={1}
              manualColumnResize
              manualRowResize
              licenseKey="non-commercial-and-evaluation"
              readOnly={!isAdmin}
              formulas={{ engine: hyperformulaInstance }}
              contextMenu={isAdmin}
              fillHandle={isAdmin}
              autoWrapRow
              autoColumnSize
              allowEmpty
              preventOverflow="horizontal"
              viewportRowRenderingOffset={50}
              viewportColumnRenderingOffset={20}
              beforeChange={handleBeforeChange}
              afterChange={handleAfterChange}
              afterSelection={handleAfterSelection}
              cells={(row, col) => {
                const props = {}
                const ruFormula = ruFormulas.get(`${row}_${col}`)
                if (ruFormula) {
                  props.renderer = (instance, TD, r, c, prop, value) => {
                    const display = ruFormula.startsWith('=') ? instance.getDataAtCell(r, c) : ruFormula
                    const text = display ?? ''
                    TD.textContent = text
                    return TD
                  }
                }

                const occupied = cellPresence.find((item) => item.coords?.r === row && item.coords?.c === col)
                if (occupied) {
                  props.className = 'cell-occupied'
                  props.comment = { value: `${occupied.name || 'Кто-то'} редактирует` }
                }

                return props
              }}
            />
          </div>
        </div>
      </section>
      <aside className="grid-side">
        <PresenceList presence={presence} />
      </aside>
    </div>
  )
}
