import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import './BatchConverter.css'

interface BatchResult {
  index: number
  input: string
  output?: string
  status: 'success' | 'not_found' | 'ambiguous' | 'wrong_target'
  message?: string
}

interface BatchResponse {
  total: number
  all_convertible: boolean
  results: BatchResult[]
}

const API_URL = import.meta.env.VITE_API_URL || '/api'

const BatchConverter = () => {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [columnLetter, setColumnLetter] = useState('A')
  const [targetSystem, setTargetSystem] = useState<string>('syskomp')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BatchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Convert column letter (A, B, C...) to index (0, 1, 2...)
  const columnLetterToIndex = (letter: string): number => {
    return letter.toUpperCase().charCodeAt(0) - 65
  }

  // Convert index to column letter
  const indexToColumnLetter = (index: number): string => {
    return String.fromCharCode(65 + index)
  }

  const handleFileSelect = (selectedFile: File) => {
    const fileName = selectedFile.name.toLowerCase()
    if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      setFile(selectedFile)
      setError(null)
    } else {
      setError('Bitte wählen Sie eine CSV- oder Excel-Datei (.csv, .xlsx) aus')
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const parseCSV = (text: string, colIndex: number): string[] => {
    const lines = text.split('\n')
    const numbers: string[] = []

    // Check if first line is a header (contains text like "Materialnr" or non-numeric data)
    let startIndex = 0
    if (lines.length > 0) {
      const firstLine = lines[0].trim()
      const columns = firstLine.split(';')
      if (columns.length > colIndex) {
        const firstValue = columns[colIndex].trim()
        // If first value looks like a header (contains letters or is a known header term)
        if (firstValue && !/^\d+(\.\d+)*$/.test(firstValue)) {
          startIndex = 1 // Skip header row
        }
      }
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const columns = line.split(';')
      if (columns.length > colIndex) {
        const value = columns[colIndex].trim()
        if (value) {
          numbers.push(value)
        }
      }
    }

    return numbers
  }

  const parseExcel = async (file: File, colIndex: number): Promise<string[]> => {
    console.log('[parseExcel] Starting, colIndex:', colIndex)
    const data = await file.arrayBuffer()
    console.log('[parseExcel] File size:', data.byteLength)
    const workbook = XLSX.read(data, { type: 'array' })

    // Get first sheet
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    console.log('[parseExcel] Sheet name:', firstSheetName)

    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false })
    console.log('[parseExcel] Rows found:', jsonData.length)
    console.log('[parseExcel] First row:', jsonData[0])

    const numbers: string[] = []

    // Check if first row is a header
    let startIndex = 0
    if (jsonData.length > 0) {
      const firstRow = jsonData[0] as any[]
      if (firstRow && firstRow.length > colIndex) {
        const cellValue = firstRow[colIndex]
        console.log('[parseExcel] First cell value:', cellValue, 'type:', typeof cellValue)
        if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
          const firstValue = String(cellValue).trim()
          const isNumeric = /^\d+(\.\d+)*$/.test(firstValue)
          console.log('[parseExcel] Is numeric?', isNumeric)
          // If first value looks like a header (contains letters or is not a valid number)
          if (firstValue && !isNumeric) {
            startIndex = 1 // Skip header row
            console.log('[parseExcel] Detected header, will skip first row')
          }
        }
      }
    }

    console.log('[parseExcel] Parsing from row:', startIndex)
    for (let i = startIndex; i < jsonData.length; i++) {
      const row = jsonData[i] as any[]
      if (row && row.length > colIndex) {
        const cellValue = row[colIndex]
        if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
          const value = String(cellValue).trim()
          if (value && value !== 'undefined' && value !== 'null') {
            console.log('[parseExcel] Row', i, 'adding value:', value)
            numbers.push(value)
          }
        }
      }
    }

    console.log('[parseExcel] Total numbers extracted:', numbers.length, numbers)
    return numbers
  }

  const handleConvert = async () => {
    if (!file) {
      setError('Bitte wählen Sie eine Datei aus')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const colIndex = columnLetterToIndex(columnLetter)
      console.log('[handleConvert] Column letter:', columnLetter, '-> index:', colIndex)
      let numbers: string[] = []

      // Detect file type and parse accordingly
      const fileName = file.name.toLowerCase()
      console.log('[handleConvert] File name:', fileName)
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        console.log('[handleConvert] Parsing as Excel')
        numbers = await parseExcel(file, colIndex)
      } else {
        console.log('[handleConvert] Parsing as CSV')
        const text = await file.text()
        numbers = parseCSV(text, colIndex)
      }

      console.log('[handleConvert] Numbers extracted:', numbers.length, numbers)

      if (numbers.length === 0) {
        console.error('[handleConvert] No numbers found!')
        setError('Keine Nummern in der Datei gefunden')
        setLoading(false)
        return
      }

      const response = await fetch(`${API_URL}/batch-convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          numbers,
          target_system: targetSystem,
        }),
      })

      if (!response.ok) {
        throw new Error('API Fehler')
      }

      const data: BatchResponse = await response.json()
      setResult(data)
    } catch (err) {
      setError('Fehler bei der Konvertierung. Stellen Sie sicher, dass der Backend-Server läuft.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!result || !file) return

    const successResults = result.results.filter(r => r.status === 'success')

    if (successResults.length === 0) {
      setError('Keine erfolgreichen Konvertierungen zum Exportieren')
      return
    }

    // Create filename with original filename, target system, and date
    const originalFileName = file.name.replace(/\.[^/.]+$/, '')
    const date = new Date()
    const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-') // HH-MM-SS

    // Detect original file format
    const inputFileName = file.name.toLowerCase()
    const isExcel = inputFileName.endsWith('.xlsx') || inputFileName.endsWith('.xls')

    if (isExcel) {
      // Export as Excel
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Original', 'Konvertiert'],
        ...successResults.map(r => [r.input, r.output])
      ])

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Konvertierung')

      const fileName = `${originalFileName}-${targetSystem}-${dateStr}_${timeStr}.xlsx`
      XLSX.writeFile(workbook, fileName)
    } else {
      // Export as CSV
      const csvContent = 'Original;Konvertiert\n' + successResults
        .map(r => `${r.input};${r.output}`)
        .join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      const fileName = `${originalFileName}-${targetSystem}-${dateStr}_${timeStr}.csv`

      link.setAttribute('href', url)
      link.setAttribute('download', fileName)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'green'
      case 'not_found':
        return 'red'
      case 'ambiguous':
        return 'orange'
      case 'wrong_target':
        return 'yellow'
      default:
        return 'gray'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'success':
        return 'Erfolg'
      case 'not_found':
        return 'Nicht gefunden'
      case 'ambiguous':
        return 'Mehrdeutig'
      case 'wrong_target':
        return 'Falsches Zielsystem'
      default:
        return status
    }
  }

  return (
    <div className="batch-converter">
      <div className="upload-section">
        <div
          className={`drop-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />

          {file ? (
            <div className="file-info">
              <svg className="file-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <polyline points="13 2 13 9 20 9" />
              </svg>
              <p className="file-name">{file.name}</p>
              <p className="file-size">{(file.size / 1024).toFixed(2)} KB</p>
            </div>
          ) : (
            <div className="drop-zone-content">
              <svg className="upload-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p>CSV- oder Excel-Datei hier ablegen oder klicken zum Durchsuchen</p>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                Unterstützte Formate: .csv, .xlsx, .xls
              </p>
            </div>
          )}
        </div>

        <div className="options">
          <div className="option-group">
            <label>Spalte:</label>
            <select
              value={columnLetter}
              onChange={(e) => setColumnLetter(e.target.value)}
              className="column-input"
            >
              {Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map((letter) => (
                <option key={letter} value={letter}>{letter}</option>
              ))}
            </select>
          </div>

          <div className="option-group">
            <label>Zielsystem:</label>
            <select
              value={targetSystem}
              onChange={(e) => setTargetSystem(e.target.value)}
              className="system-select"
            >
              <option value="syskomp">Syskomp</option>
              <option value="bosch">Bosch</option>
              <option value="item">Item</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleConvert}
          disabled={!file || loading}
          className="convert-button"
        >
          {loading ? 'Konvertiere...' : 'Konvertieren'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {result && (
        <div className="results-section">
          <div className="results-header">
            <h3>Konvertierungsergebnisse</h3>
            <div className="results-summary">
              <span className="success-count">
                {result.results.filter(r => r.status === 'success').length} erfolgreich
              </span>
              <span className="failed-count">
                {result.results.filter(r => r.status !== 'success').length} fehlgeschlagen
              </span>
            </div>
          </div>

          {result.all_convertible && (
            <button onClick={handleExport} className="export-button">
              Exportieren
            </button>
          )}

          {result.results.filter(r => r.status === 'success').length > 0 && (
            <div className="conversion-summary">
              <h4>Konvertierungsliste</h4>
              <div className="conversion-list">
                {result.results
                  .filter(r => r.status === 'success')
                  .map((item, idx) => (
                    <div key={idx} className="conversion-item">
                      <span className="original-number">{item.input}</span>
                      <span className="arrow">→</span>
                      <span className="new-number">{item.output}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="results-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Eingabe</th>
                  <th>Ausgabe</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((item) => (
                  <tr key={item.index} className={`status-${item.status}`}>
                    <td>{item.index + 1}</td>
                    <td>{item.input}</td>
                    <td>{item.output || '-'}</td>
                    <td>
                      <span className={`status-badge status-${getStatusColor(item.status)}`}>
                        {getStatusLabel(item.status)}
                      </span>
                      {item.message && (
                        <span className="status-message">{item.message}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default BatchConverter
