import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import { HyperFormula } from 'hyperformula'
import { firestore } from '../../firebase'
import { useWorkbook } from '../../context/WorkbookContext'
import { looksLikeFormula, normalizeRussianFormula, ruFormulaToEn } from '../../utils/formulas'
import 'handsontable/dist/handsontable.full.css'

export default function Spreadsheet({ isAdmin, meta }) {
  const { gridData, ruFormulas, presenceWriterRef, pushHistory, user, presence } = useWorkbook()
  const hotRef = useRef(null)
  const hyperFormulaRef = useRef(null)
  const [pendingRuFormulas, setPendingRuFormulas] = useState({})

  useEffect(() => {
    if (!hyperFormulaRef.current) {
      hyperFormulaRef.current = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' })
    }
  }, [])

  const data = useMemo(() => gridData, [gridData])
  const editingByOthers = useMemo(() => {
    const entries = Object.values(presence || {})
    const map = new Set()
    entries.forEach((entry) => {
      if (user && entry.uid === user.uid) return
      if (entry.editing) {
        map.add(`${entry.editing.r}_${entry.editing.c}`)
      }
    })
    return map
  }, [presence, user])

  const handleBeforeChange = (changes) => {
    if (!changes) return
    const nextPending = { ...pendingRuFormulas }
    changes.forEach((change) => {
      const [row, prop, oldValue, newValue] = change
      if (looksLikeFormula(newValue)) {
        const ru = normalizeRussianFormula(newValue)
        nextPending[`${row}_${prop}`] = ru
        const translated = ruFormulaToEn(ru)
        // mutate value to English for HyperFormula
        change[3] = translated
      }
    })
    setPendingRuFormulas(nextPending)
  }

  const handleAfterChange = async (changes, source) => {
    if (!changes || source === 'loadData' || !isAdmin) return
    const hot = hotRef.current?.hotInstance
    const batch = writeBatch(firestore)
    const historyItems = []

    changes.forEach((change) => {
      const [row, prop, oldValue, newValue] = change
      const value = hot?.getDataAtCell(row, prop)
      const ruFormula = pendingRuFormulas[`${row}_${prop}`]
      const docId = `${row}_${prop}`
      const payload = {
        r: row,
        c: prop,
        v: ruFormula ? value : newValue,
        f: ruFormula || null,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email ?? 'неизвестно',
      }
      const cellRef = doc(collection(firestore, 'cells'), docId)
      batch.set(cellRef, payload)
      historyItems.push({
        rowId: row + 1,
        col: meta.colHeaders[prop] ?? `C${prop + 1}`,
        before: oldValue ?? '',
        after: ruFormula ? ruFormula : newValue,
      })
    })

    await batch.commit()
    setPendingRuFormulas({})
    presenceWriterRef.current({ editing: null })
    pushHistory(historyItems)
  }

  const handleSelection = (row, col) => {
    presenceWriterRef.current({ editing: { r: row, c: col } })
  }

  const cells = (row, col) => {
    const classes = []
    if (editingByOthers.has(`${row}_${col}`)) {
      classes.push('cell-locked')
    }
    return {
      readOnly: !isAdmin,
      className: classes.join(' '),
      renderer: (instance, td, rowIdx, colIdx, prop, value, cellProperties) => {
        const ru = ruFormulas[`${rowIdx}_${colIdx}`]
        const isFormula = looksLikeFormula(ru)
        const display = isFormula ? instance.getDataAtCell(rowIdx, colIdx) : value
        Handsontable.renderers.TextRenderer(instance, td, rowIdx, colIdx, prop, display, cellProperties)
      },
    }
  }

  const afterBeginEditing = (row, col) => {
    const editor = hotRef.current?.hotInstance?.getActiveEditor()
    const ru = ruFormulas[`${row}_${col}`]
    if (editor && ru) {
      editor.setValue(ru)
    }
  }

  return (
    <div className="sheet-wrapper">
      <HotTable
        ref={hotRef}
        data={data}
        colHeaders={meta.colHeaders?.length ? meta.colHeaders : true}
        rowHeaders={meta.rowHeaders ?? true}
        height="70vh"
        width="100%"
        stretchH="all"
        manualColumnResize
        manualRowResize
        manualColumnMove
        manualRowMove
        contextMenu
        dropdownMenu
        filters
        copyPaste
        undo
        redo
        fillHandle
        viewportColumnRenderingOffset={10}
        viewportRowRenderingOffset={20}
        fixedRowsTop={1}
        fixedColumnsLeft={1}
        licenseKey="non-commercial-and-evaluation"
        formulas={{ engine: hyperFormulaRef.current }}
        beforeChange={handleBeforeChange}
        afterChange={handleAfterChange}
        afterBeginEditing={afterBeginEditing}
        afterSelection={handleSelection}
        cells={cells}
      />
      {!isAdmin && <p className="muted text-small">Редактирование доступно только администраторам.</p>}
    </div>
  )
}
