import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { enFormulaToRu, normalizeRussianFormula } from '../../utils/formulas'

function parseSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error('Выбранный лист не найден')
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, raw: true })
  return rows
}

function extractFormulas(sheet) {
  const formulas = {}
  Object.entries(sheet)
    .filter(([key]) => /^[A-Z]+\d+$/.test(key))
    .forEach(([cellKey, cell]) => {
      if (cell && cell.f) {
        formulas[cellKey] = cell.f
      }
    })
  return formulas
}

export default function ImportWorkbook({ onImport }) {
  const fileRef = useRef(null)
  const [workbook, setWorkbook] = useState(null)
  const [sheetName, setSheetName] = useState('')
  const [headerRow, setHeaderRow] = useState(0)
  const [preview, setPreview] = useState([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const sheetNames = useMemo(() => workbook?.SheetNames ?? [], [workbook])

  const refreshPreview = (nextWorkbook = workbook, nextSheet = sheetName, nextHeaderRow = headerRow) => {
    if (!nextWorkbook || !nextSheet) return
    try {
      const rows = parseSheet(nextWorkbook, nextSheet)
      setPreview(rows.slice(nextHeaderRow, nextHeaderRow + 10))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleFile = async (file) => {
    setError('')
    setStatus('')
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array', cellFormula: true })
    setWorkbook(wb)
    const firstSheet = wb.SheetNames[0]
    setSheetName(firstSheet)
    refreshPreview(wb, firstSheet, 0)
  }

  const handleLoad = async () => {
    if (!workbook || !sheetName) return
    try {
      setStatus('Импортируем...')
      const rows = parseSheet(workbook, sheetName)
      const sheet = workbook.Sheets[sheetName]
      const formulas = extractFormulas(sheet)
      const header = rows[headerRow] ?? []
      const dataRows = rows.slice(headerRow + 1)
      const colHeaders = header.map((cell) => `${cell ?? ''}`.trim()).filter(Boolean)
      const rowsCount = Math.max(dataRows.length + 1, 10)
      const colsCount = Math.max(colHeaders.length, 5)

      const cells = []

      dataRows.forEach((rowValues, rowIndex) => {
        rowValues.forEach((cellValue, colIndex) => {
          if (colIndex >= colsCount) return
          const r = rowIndex + 1 // reserve first row for header display
          const c = colIndex
          const address = XLSX.utils.encode_cell({ r: r + headerRow, c })
          const excelFormula = formulas[address]
          const ruFormula = excelFormula ? normalizeRussianFormula(enFormulaToRu(`=${excelFormula}`)) : null
          const payload = { r, c, v: ruFormula ? null : cellValue ?? '', f: ruFormula }
          cells.push(payload)
        })
      })

      // header row cells
      header.forEach((value, colIndex) => {
        const payload = { r: 0, c: colIndex, v: value ?? '', f: null }
        cells.push(payload)
      })

      await onImport({
        meta: { rows: rowsCount, cols: colsCount, colHeaders, rowHeaders: true },
        cells,
      })
      setStatus('Импорт завершён и отправлен в Firestore')
      setError('')
    } catch (err) {
      setError(err.message)
      setStatus('')
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>Импорт Excel</h2>
          <p className="muted">Выберите лист, строку заголовков и отправьте в Firestore</p>
        </div>
      </div>
      <div className="import-block">
        <input ref={fileRef} type="file" accept=".xlsx" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {sheetNames.length > 0 && (
          <div className="import-controls">
            <label>
              Лист:
              <select value={sheetName} onChange={(e) => { setSheetName(e.target.value); refreshPreview(workbook, e.target.value, headerRow) }}>
                {sheetNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Строка заголовков:
              <input
                type="number"
                min="0"
                value={headerRow}
                onChange={(e) => {
                  const value = Number(e.target.value) || 0
                  setHeaderRow(value)
                  refreshPreview(workbook, sheetName, value)
                }}
              />
            </label>
            <button onClick={handleLoad}>Загрузить в Firestore</button>
          </div>
        )}

        {status && <p className="muted">{status}</p>}
        {error && <p className="error">{error}</p>}

        {preview.length > 0 && (
          <div className="preview">
            <h4>Первые 10 строк предпросмотра</h4>
            <table>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx}>
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx}>{`${cell ?? ''}`}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
