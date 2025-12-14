import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'

export default function ImportDialog({ onImport }) {
  const fileRef = useRef(null)
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFile = async (file) => {
    setError('')
    setIsProcessing(true)
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets['РЕЙТИНГ ИТОГ']
      if (!sheet) {
        throw new Error('Лист "РЕЙТИНГ ИТОГ" не найден')
      }
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
      if (rows.length < 2) {
        throw new Error('В таблице нет данных')
      }
      const [headerRow, ...dataRows] = rows
      const columns = headerRow.slice(1).map((item) => `${item}`.trim()).filter(Boolean)

      const parsedRows = dataRows
        .filter((cells) => cells.some((cell) => cell !== undefined && cell !== null && `${cell}`.trim() !== ''))
        .map((cells, index) => {
          const name = `${cells[0] ?? ''}`.trim()
          const data = {}
          columns.forEach((col, colIndex) => {
            data[col] = cells[colIndex + 1] ?? ''
          })
          return {
            id: name ? name.toLowerCase().replace(/\s+/g, '-') || `row-${index}` : `row-${index}`,
            name: name || `Строка ${index + 1}`,
            data,
          }
        })

      await onImport({ columns, rows: parsedRows })
      fileRef.current.value = ''
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

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>Импорт Excel</h2>
          <p className="muted">Лист "РЕЙТИНГ ИТОГ", файл "Итог.xlsx"</p>
        </div>
      </div>
      <div className="import-block">
        <input ref={fileRef} type="file" accept=".xlsx" onChange={onChange} />
        {isProcessing && <p className="muted">Импортируем...</p>}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
