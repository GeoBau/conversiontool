import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import './ConversionTool.css'

interface SearchResult {
  input_number: string
  input_type: string
  corresponding_number: string
  corresponding_type: string
  bez1: string
  bez2: string
  warengruppe: string
  warengruppe_description: string
  row_index: number
}

interface ApiResponse {
  found: boolean
  ambiguous?: boolean
  result?: SearchResult
  results?: SearchResult[]
  message?: string
  count?: number
  search_term?: string
  search_type?: string
}

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

const ConversionTool = () => {
  const [showHeadline, setShowHeadline] = useState(true)
  const [searchNumber, setSearchNumber] = useState('415901309')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cleaning, setCleaning] = useState(false)

  // Batch conversion states
  const [file, setFile] = useState<File | null>(null)
  const [columnLetter, setColumnLetter] = useState('A')
  const [targetSystem, setTargetSystem] = useState<string>('syskomp')
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchResult, setBatchResult] = useState<BatchResponse | null>(null)
  const [batchError, setBatchError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getSystemLabel = (type: string) => {
    switch (type) {
      case 'bosch':
        return 'Bosch'
      case 'syskomp':
        return 'Syskomp'
      case 'item':
        return 'Item'
      default:
        return type
    }
  }

  // Single search functions
  const handleSearch = async () => {
    const cleanedNumber = searchNumber.replace(/\s/g, '').trim()

    if (!cleanedNumber) {
      setError('Bitte geben Sie eine Nummer ein')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`${API_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ number: cleanedNumber }),
      })

      if (!response.ok) {
        throw new Error('API Fehler')
      }

      const data: ApiResponse = await response.json()
      setResult(data)
    } catch (err) {
      setError('Fehler bei der Suche. Stellen Sie sicher, dass der Backend-Server läuft.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Automatically clean database when ambiguous results are detected
  useEffect(() => {
    const cleanDatabase = async () => {
      if (result && result.found && result.ambiguous && !cleaning) {
        setCleaning(true)
        try {
          const response = await fetch(`${API_URL}/clean-duplicates`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          })

          if (response.ok) {
            const data = await response.json()
            console.log(`Cleaned database: removed ${data.duplicates_removed} duplicates`)
            // Re-search after cleaning
            setTimeout(() => {
              handleSearch()
              setCleaning(false)
            }, 1000)
          } else {
            console.error('Failed to clean database')
            setCleaning(false)
          }
        } catch (err) {
          console.error('Error cleaning database:', err)
          setCleaning(false)
        }
      }
    }

    cleanDatabase()
  }, [result])

  // Batch conversion functions
  const columnLetterToIndex = (letter: string): number => {
    return letter.toUpperCase().charCodeAt(0) - 65
  }

  const handleFileSelect = (selectedFile: File) => {
    const fileName = selectedFile.name.toLowerCase()
    if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      setFile(selectedFile)
      setBatchError(null)
    } else {
      setBatchError('Bitte wählen Sie eine CSV- oder Excel-Datei aus')
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const parseCSV = (text: string, colIndex: number): string[] => {
    const lines = text.split('\n')
    const numbers: string[] = []
    let startIndex = 0

    if (lines.length > 0) {
      const firstLine = lines[0].trim()
      const columns = firstLine.split(';')
      if (columns.length > colIndex) {
        const firstValue = columns[colIndex].trim()
        if (firstValue && !/^\d+(\.\d+)*$/.test(firstValue)) {
          startIndex = 1
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
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false })
    const numbers: string[] = []
    let startIndex = 0

    if (jsonData.length > 0) {
      const firstRow = jsonData[0] as any[]
      if (firstRow && firstRow.length > colIndex) {
        const cellValue = firstRow[colIndex]
        if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
          const firstValue = String(cellValue).trim()
          const isNumeric = /^\d+(\.\d+)*$/.test(firstValue)
          if (firstValue && !isNumeric) {
            startIndex = 1
          }
        }
      }
    }

    for (let i = startIndex; i < jsonData.length; i++) {
      const row = jsonData[i] as any[]
      if (row && row.length > colIndex) {
        const cellValue = row[colIndex]
        if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
          const value = String(cellValue).trim()
          if (value && value !== 'undefined' && value !== 'null') {
            numbers.push(value)
          }
        }
      }
    }

    return numbers
  }

  const handleConvert = async () => {
    if (!file) {
      setBatchError('Bitte wählen Sie eine Datei aus')
      return
    }

    setBatchLoading(true)
    setBatchError(null)
    setBatchResult(null)

    try {
      const colIndex = columnLetterToIndex(columnLetter)
      let numbers: string[] = []

      const fileName = file.name.toLowerCase()
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        numbers = await parseExcel(file, colIndex)
      } else {
        const text = await file.text()
        numbers = parseCSV(text, colIndex)
      }

      if (numbers.length === 0) {
        setBatchError('Keine Nummern in der Datei gefunden')
        setBatchLoading(false)
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
      setBatchResult(data)
    } catch (err) {
      setBatchError('Fehler bei der Konvertierung. Stellen Sie sicher, dass der Backend-Server läuft.')
      console.error(err)
    } finally {
      setBatchLoading(false)
    }
  }

  const handleExport = () => {
    if (!batchResult || !file) return

    // Create array with converted numbers (or ?number? for failures)
    const convertedNumbers = batchResult.results.map(r =>
      r.status === 'success' ? r.output : `?${r.input}?`
    )

    const originalFileName = file.name.replace(/\.[^/.]+$/, '')
    const date = new Date()
    const dateStr = date.toISOString().split('T')[0]
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-')

    const inputFileName = file.name.toLowerCase()
    const isExcel = inputFileName.endsWith('.xlsx') || inputFileName.endsWith('.xls')

    if (isExcel) {
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Konvertiert'],
        ...convertedNumbers.map(num => [num])
      ])

      // Apply red color to failed conversions (cells containing ?number?)
      convertedNumbers.forEach((num, index) => {
        const cellAddress = XLSX.utils.encode_cell({ r: index + 1, c: 0 }) // +1 to skip header
        if (num.startsWith('?')) {
          if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {}
          worksheet[cellAddress].s = {
            font: { color: { rgb: "FF0000" } }
          }
        }
      })

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Konvertierung')

      const fileName = `${originalFileName}-${targetSystem}-${dateStr}_${timeStr}.xlsx`
      XLSX.writeFile(workbook, fileName, { cellStyles: true })
    } else {
      const csvContent = 'Konvertiert\n' + convertedNumbers.join('\n')

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

  return (
    <div className="conversion-tool">
      {showHeadline && (
        <div className="tool-header">
          <h1>conversionTool</h1>
          <button className="toggle-headline" onClick={() => setShowHeadline(false)}>×</button>
        </div>
      )}

      <div className="tool-sections">
        {/* Single Input Section */}
        <div className="section single-section">
          <h2>Einzelsuche</h2>
          <div className="input-row">
            <input
              type="text"
              value={searchNumber}
              onChange={(e) => setSearchNumber(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Nummer eingeben"
              className="compact-input"
            />
            <button onClick={handleSearch} disabled={loading} className="compact-button">
              {loading ? 'Suche...' : 'Suchen'}
            </button>
          </div>

          {error && <div className="error-msg">{error}</div>}

          {result && !result.found && (
            <div className="not-found-msg">
              Keine Übereinstimmung für "{result.search_term}"
            </div>
          )}

          {result && result.found && !result.ambiguous && result.result && (
            <div className="result-compact">
              <div className="result-row">
                <span className="result-label">Eingabe:</span>
                <span className="result-value">{result.result.input_number}</span>
                <span className="result-badge">{getSystemLabel(result.result.input_type)}</span>
              </div>
              <div className="result-row">
                <span className="result-label">Entsprechung:</span>
                <span className="result-value">{result.result.corresponding_number}</span>
                <span className="result-badge">{getSystemLabel(result.result.corresponding_type)}</span>
              </div>
              {result.result.bez1 && (
                <div className="result-row">
                  <span className="result-label">Bezeichnung 1:</span>
                  <span className="result-value">{result.result.bez1}</span>
                </div>
              )}
              <div className="result-row">
                <span className="result-label">Bezeichnung 2:</span>
                <span className="result-value">{result.result.bez2 || '-'}</span>
              </div>
              <div className="result-row">
                <span className="result-label">Warengruppe:</span>
                <span className="result-value">
                  {result.result.warengruppe || '-'}
                  {result.result.warengruppe_description && ` - ${result.result.warengruppe_description}`}
                </span>
              </div>
            </div>
          )}

          {result && result.found && result.ambiguous && result.results && (
            <div className="not-found-msg">
              <p>Bereinige Datenbasis ...</p>
            </div>
          )}
        </div>

        {/* Batch Input Section */}
        <div className="section batch-section">
          <h2>Batch-Konvertierung</h2>

          <div className="file-upload-compact">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
            <button onClick={handleBrowseClick} className="compact-button">
              {file ? file.name : 'Datei wählen'}
            </button>
          </div>

          <div className="batch-options">
            <label>
              Spalte:
              <select value={columnLetter} onChange={(e) => setColumnLetter(e.target.value)}>
                {Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map((letter) => (
                  <option key={letter} value={letter}>{letter}</option>
                ))}
              </select>
            </label>

            <label>
              Zielsystem:
              <select value={targetSystem} onChange={(e) => setTargetSystem(e.target.value)}>
                <option value="syskomp">Syskomp</option>
                <option value="bosch">Bosch</option>
                <option value="item">Item</option>
              </select>
            </label>

            <button onClick={handleConvert} disabled={!file || batchLoading} className="compact-button">
              {batchLoading ? 'Konvertiere...' : 'Konvertieren'}
            </button>
          </div>

          {batchError && <div className="error-msg">{batchError}</div>}

          {batchResult && (
            <div className="batch-results-compact">
              <div className="results-summary-compact">
                <span className="success-badge">
                  ✓ {batchResult.results.filter(r => r.status === 'success').length}
                </span>
                <span className="failed-badge">
                  ✗ {batchResult.results.filter(r => r.status !== 'success').length}
                </span>
                <button onClick={handleExport} className="export-button-compact">Exportieren</button>
              </div>

              <div className="batch-results-list">
                {batchResult.results.map((item) => (
                  <div key={item.index} className={`batch-result-line status-${item.status}`}>
                    <span className="batch-input">{item.input}</span>
                    <span className="batch-arrow">{'>'}</span>
                    {item.status === 'success' ? (
                      <span className="batch-output">{item.output}</span>
                    ) : (
                      <span className="batch-output-error">?{item.input}?</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ConversionTool
