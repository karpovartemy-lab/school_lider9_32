import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { normalizeRussianFormula } from '../utils/formulas'

const EN_TO_RU = {
  SUM: 'СУММ',
  AVERAGE: 'СРЗНАЧ',
  MIN: 'МИН',
  MAX: 'МАКС',
  COUNT: 'СЧЁТ',
}

function translateToRu(formula) {
  if (!formula || typeof formula !== 'string') return formula
  if (!formula.startsWith('=')) return formula
  return formula.replace(/=([A-ZА-ЯЁ]+)/i, (_, fn) => `=${EN_TO_RU[fn.toUpperCase()] ?? fn}`)
}

export default function ImportDialog({ onImport }) {
  const fileRef = useRef(null)
  const [workbook, setWorkbook] = useState(null)
  const [sheetNames, setSheetNames] = useState([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [headerRowIndex, setHeaderRowIndex] = useState(0)
  const [preview, setPreview] = useState([])
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const selectedSheetObject = useMemo(() => workbook?.Sheets?.[selectedSheet] ?? null, [selectedSheet, workbook])

  useEffect(() => {
    if (!selectedSheetObject) {
      setPreview([])
      return
    }
    const rows = XLSX.utils.sheet_to_json(selectedSheetObject, { header: 1, defval: '', raw: true })
    setPreview(rows.slice(0, 10))
  }, [selectedSheetObject])

  const handleFile = async (file) => {
    setError('')
    setIsProcessing(true)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellFormula: true })
      setWorkbook(wb)
      setSheetNames(wb.SheetNames)
      setSelectedSheet(wb.SheetNames?.[0] ?? '')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const onChange = (event) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  const buildPayload = () => {
    if (!selectedSheetObject) throw new Error('Выберите лист Excel')
    const rows = XLSX.utils.sheet_to_json(selectedSheetObject, { header: 1, defval: '', raw: true })
    if (rows.length === 0) throw new Error('Лист пустой')
    const header = rows[headerRowIndex] || []
    const dataRows = rows.slice(headerRowIndex + 1).filter((r) => r.some((cell) => `${cell}`.trim() !== ''))
    const colsCount = Math.max(...header.map((_, idx) => idx + 1), ...dataRows.map((row) => row.length))

    const colHeaders = header.map((cell, idx) => `${cell || `Колонка ${idx + 1}`}`)
    const meta = {
      rows: dataRows.length,
      cols: colsCount,
      colHeaders,
      rowHeaders: true,
    }

    const cells = []
    dataRows.forEach((row, rowIndex) => {
      for (let colIndex = 0; colIndex < colsCount; colIndex += 1) {
        const excelRowIndex = headerRowIndex + 1 + rowIndex
        const cellRef = XLSX.utils.encode_cell({ r: excelRowIndex, c: colIndex })
        const sheetCell = selectedSheetObject[cellRef]
        const rawValue = row[colIndex]
        const formulaValue = sheetCell?.f ? `=${sheetCell.f}` : null
        const ruFormula = formulaValue ? translateToRu(formulaValue) : null
        const { en, isFormula } = normalizeRussianFormula(ruFormula ?? rawValue)

        cells.push({
          r: rowIndex,
          c: colIndex,
          v: isFormula ? sheetCell?.v ?? '' : rawValue ?? '',
          f: isFormula ? en : null,
          fRu: isFormula ? ruFormula ?? (typeof rawValue === 'string' ? rawValue : formulaValue) : null,
        })
      }
    })

    return { meta, cells }
  }

  const handleImport = async () => {
    try {
      setIsProcessing(true)
      const payload = buildPayload()
      await onImport?.(payload)
      fileRef.current.value = ''
    } catch (err) {
      setError(err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>Импорт Excel</h2>
          <p className="muted">Выберите файл, лист, строку заголовков и отправьте в Firestore</p>
        </div>
      </div>
      <div className="import-block">
        <div className="input-group">
          <label>Файл Excel</label>
          <input ref={fileRef} type="file" accept=".xlsx" onChange={onChange} />
        </div>
        {sheetNames.length > 0 && (
          <div className="input-group">
            <label>Лист</label>
            <select value={selectedSheet} onChange={(e) => setSelectedSheet(e.target.value)}>
              {sheetNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}
        {preview.length > 0 && (
          <div className="input-group">
            <label>Строка заголовков</label>
            <input
              type="number"
              min={1}
              max={preview.length}
              value={headerRowIndex + 1}
              onChange={(e) => setHeaderRowIndex(Math.max(0, Number(e.target.value) - 1))}
            />
          </div>
        )}
        {preview.length > 0 && (
          <div className="preview">
            <p className="muted">Первые 10 строк:</p>
            <table className="preview-table">
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx} className={idx === headerRowIndex ? 'header-row' : ''}>
                    <td className="muted">{idx + 1}</td>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx}>{`${cell}`}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="actions">
          <button onClick={handleImport} disabled={isProcessing || !selectedSheetObject}>
            Загрузить в Firestore
          </button>
          {isProcessing && <p className="muted">Обрабатываем файл...</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    </div>
  )
}
