import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import './ConversionTool.css'

interface SearchMatch {
  found_in_col: string
  found_in_col_name: string
  syskomp_neu: string
  syskomp_alt: string
  item: string
  bosch: string
  alvaris_artnr: string
  alvaris_matnr: string
  ask: string
  description: string
  image?: {
    type: string
    artnr: string
    crop_top_70: boolean
  }
}

interface SearchResult {
  found: boolean
  search_term?: string
  count?: number
  matches?: SearchMatch[]
  error?: string
}

interface BatchResult {
  index: number
  input: string
  output?: string
  status: 'success' | 'not_found' | 'empty' | 'invalid_conversion'
  message?: string
  from_col?: string
}

interface BatchResponse {
  total: number
  success: number
  failed: number
  results: BatchResult[]
}

interface StatsData {
  syskomp: number
  item: number
  bosch: number
  alvaris: number
  ask: number
}

const API_URL = import.meta.env.VITE_API_URL || '/api'

const PortfolioConversion = () => {
  const [showHeadline, setShowHeadline] = useState(true)
  const [searchNumber, setSearchNumber] = useState('403538558')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Batch conversion states
  const [file, setFile] = useState<File | null>(null)
  const [fileDirectoryHandle, setFileDirectoryHandle] = useState<any>(null)
  const [originalFileData, setOriginalFileData] = useState<any[][] | null>(null)
  const [columnLetter, setColumnLetter] = useState('A')
  const [targetCol, setTargetCol] = useState<'A' | 'B'>('A')
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchResult, setBatchResult] = useState<BatchResponse | null>(null)
  const [batchError, setBatchError] = useState<string | null>(null)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [stats, setStats] = useState<StatsData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_URL}/stats`)
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      }
    }
    fetchStats()
  }, [])

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
        body: JSON.stringify({
          number: cleanedNumber
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'API Fehler')
      }

      const data: SearchResult = await response.json()
      setResult(data)

    } catch (err: any) {
      setError(err.message || 'Fehler bei der Suche. Stellen Sie sicher, dass der Backend-Server läuft.')
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

  // Batch conversion functions
  const columnLetterToIndex = (letter: string): number => {
    return letter.toUpperCase().charCodeAt(0) - 65
  }

  const escapeCsvValue = (value: any): string => {
    const stringValue = String(value)
    if (stringValue.match(/^[=+\-@\t\r]/)) {
      return `'${stringValue}`
    }
    return stringValue
  }

  const sanitizeFilename = (filename: string): string => {
    return filename
      .replace(/[<>:"|?*\x00-\x1f]/g, '')
      .replace(/^\.+/, '')
      .replace(/\.\./g, '.')
      .replace(/\\/g, '')
      .replace(/\//g, '')
      .trim()
      .slice(0, 255)
  }

  const verifyMimeType = async (file: File): Promise<boolean> => {
    const validMimeTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]

    if (!validMimeTypes.includes(file.type) && file.type !== '') {
      return false
    }

    try {
      const buffer = await file.slice(0, 4).arrayBuffer()
      const bytes = new Uint8Array(buffer)

      if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
        return true
      }

      if (file.name.toLowerCase().endsWith('.csv')) {
        return true
      }

      return false
    } catch {
      return true
    }
  }

  const handleFileSelect = async (selectedFile: File) => {
    const fileName = selectedFile.name.toLowerCase()
    const MAX_FILE_SIZE = 10 * 1024 * 1024

    if (selectedFile.size > MAX_FILE_SIZE) {
      setBatchError(`Datei ist zu groß. Maximum: 10MB (Ihre Datei: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB)`)
      return
    }

    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx')) {
      setBatchError('Bitte wählen Sie eine CSV- oder XLSX-Datei aus')
      return
    }

    const isValidMime = await verifyMimeType(selectedFile)
    if (!isValidMime) {
      setBatchError('Ungültiger Dateityp. Die Datei scheint nicht dem angegebenen Format zu entsprechen.')
      return
    }

    setFile(selectedFile)
    setBatchError(null)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
      setFileDirectoryHandle(null)
    }
  }

  const handleBrowseClick = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [{
            description: 'Excel and CSV Files',
            accept: {
              'text/csv': ['.csv'],
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
            }
          }],
          multiple: false
        })

        const file = await fileHandle.getFile()
        handleFileSelect(file)
        setFileDirectoryHandle(fileHandle)
      } catch (err) {
        console.log('File picker cancelled or failed:', err)
      }
    } else {
      fileInputRef.current?.click()
    }
  }

  const parseCSV = (text: string, colIndex: number): { numbers: string[], fullData: any[][] } => {
    const lines = text.split('\n')
    const numbers: string[] = []
    const fullData: any[][] = []

    let hasHeader = false
    if (lines.length > 0) {
      const firstLine = lines[0].trim()
      if (firstLine) {
        const columns = firstLine.split(';')
        if (columns.length > colIndex) {
          const firstValue = columns[colIndex].trim()
          if (firstValue && !/^\d+(\.\d+)*$/.test(firstValue)) {
            hasHeader = true
          }
        }
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const columns = line.split(';')
      fullData.push(columns)

      if (i > 0 || !hasHeader) {
        if (columns.length > colIndex) {
          const value = columns[colIndex].trim()
          if (value) {
            numbers.push(value)
          }
        }
      }
    }

    return { numbers, fullData }
  }

  const parseExcel = async (file: File, colIndex: number): Promise<{ numbers: string[], fullData: any[][] }> => {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' }) as any[][]
    const numbers: string[] = []

    let hasHeader = false
    if (jsonData.length > 0) {
      const firstRow = jsonData[0] as any[]
      if (firstRow && firstRow.length > colIndex) {
        const cellValue = firstRow[colIndex]
        if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
          const firstValue = String(cellValue).trim()
          const isNumeric = /^\d+(\.\d+)*$/.test(firstValue)
          if (firstValue && !isNumeric) {
            hasHeader = true
          }
        }
      }
    }

    const startRow = hasHeader ? 1 : 0
    for (let i = startRow; i < jsonData.length; i++) {
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

    return { numbers, fullData: jsonData }
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
      let fullData: any[][] = []

      const fileName = file.name.toLowerCase()
      if (fileName.endsWith('.xlsx')) {
        const result = await parseExcel(file, colIndex)
        numbers = result.numbers
        fullData = result.fullData
      } else {
        const text = await file.text()
        const result = parseCSV(text, colIndex)
        numbers = result.numbers
        fullData = result.fullData
      }

      if (numbers.length === 0) {
        setBatchError('Keine Nummern in der Datei gefunden')
        setBatchLoading(false)
        return
      }

      setOriginalFileData(fullData)

      const response = await fetch(`${API_URL}/batch-convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          numbers,
          target_col: targetCol,
          mode: 'extern'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'API Fehler')
      }

      const data: BatchResponse = await response.json()
      setBatchResult(data)
    } catch (err: any) {
      setBatchError(err.message || 'Fehler bei der Konvertierung.')
      console.error(err)
    } finally {
      setBatchLoading(false)
    }
  }

  const handleExport = async () => {
    if (!batchResult || !file || !originalFileData) return

    const colIndex = columnLetterToIndex(columnLetter)

    const convertedNumbers = batchResult.results.map(r =>
      r.status === 'success' ? r.output : `?${r.input}?`
    )

    const modifiedData = originalFileData.map((row, index) => {
      const newRow = [...row]

      const isHeaderRow = index === 0 && row[colIndex] && !/^\d+(\.\d+)*$/.test(String(row[colIndex]).trim())

      if (!isHeaderRow && convertedNumbers.length > 0) {
        const firstDataValue = originalFileData[0]?.[colIndex]
        const hasHeader = firstDataValue && !/^\d+(\.\d+)*$/.test(String(firstDataValue).trim())
        const dataRowIndex = hasHeader ? index - 1 : index

        if (dataRowIndex >= 0 && dataRowIndex < convertedNumbers.length) {
          newRow[colIndex] = convertedNumbers[dataRowIndex]
        }
      }

      return newRow
    })

    const originalFileName = sanitizeFilename(file.name).replace(/\.[^/.]+$/, '')
    const inputFileName = file.name.toLowerCase()
    const isExcel = inputFileName.endsWith('.xlsx')

    try {
      if (isExcel) {
        const worksheet = XLSX.utils.aoa_to_sheet(modifiedData)

        modifiedData.forEach((row, rowIndex) => {
          const cellValue = row[colIndex]
          if (cellValue && String(cellValue).startsWith('?')) {
            const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })
            if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {}
            worksheet[cellAddress].s = {
              font: { color: { rgb: "FF0000" } }
            }
          }
        })

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')

        const fileName = `${originalFileName}-syskomp${targetCol}.xlsx`

        if ('showSaveFilePicker' in window) {
          const options: any = {
            suggestedName: fileName,
            types: [{
              description: 'Excel Files',
              accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
            }]
          }

          if (fileDirectoryHandle) {
            options.startIn = fileDirectoryHandle
          }

          const fileHandle = await (window as any).showSaveFilePicker(options)

          const writableStream = await fileHandle.createWritable()
          const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', cellStyles: true })
          await writableStream.write(buffer)
          await writableStream.close()
        } else {
          XLSX.writeFile(workbook, fileName, { cellStyles: true })
        }
      } else {
        const csvContent = modifiedData.map(row =>
          row.map(cell => escapeCsvValue(cell)).join(';')
        ).join('\n')
        const fileName = `${originalFileName}-syskomp${targetCol}.csv`

        if ('showSaveFilePicker' in window) {
          const options: any = {
            suggestedName: fileName,
            types: [{
              description: 'CSV Files',
              accept: { 'text/csv': ['.csv'] }
            }]
          }

          if (fileDirectoryHandle) {
            options.startIn = fileDirectoryHandle
          }

          const fileHandle = await (window as any).showSaveFilePicker(options)

          const writableStream = await fileHandle.createWritable()
          await writableStream.write(csvContent)
          await writableStream.close()
        } else {
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
          const link = document.createElement('a')
          const url = URL.createObjectURL(blob)

          link.setAttribute('href', url)
          link.setAttribute('download', fileName)
          link.style.visibility = 'hidden'
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
      }
    } catch (err) {
      console.log('Export cancelled or failed:', err)
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

          {result && result.found && result.matches && (
            <div className="search-results">
              <div className="results-count">
                {result.count} {result.count === 1 ? 'Treffer' : 'Treffer'} für "{result.search_term}"
              </div>
              {result.matches.map((match, index) => (
                <div key={index} className="result-compact">
                  <div className="result-header">
                    Gefunden in: <strong>{match.found_in_col_name}</strong>
                  </div>
                  <div className="result-grid">
                    {match.syskomp_neu && match.syskomp_neu !== '-' && (
                      <div className="result-row highlight">
                        <span className="result-label">Syskomp neu:</span>
                        <span className="result-value">{match.syskomp_neu}</span>
                      </div>
                    )}
                    {match.syskomp_alt && match.syskomp_alt !== '-' && (
                      <div className="result-row highlight">
                        <span className="result-label">Syskomp alt:</span>
                        <span className="result-value">{match.syskomp_alt}</span>
                      </div>
                    )}
                    {match.item && match.item !== '-' && (
                      <div className="result-row">
                        <span className="result-label">Item:</span>
                        <span className="result-value">
                          <a
                            href={`https://www.item24.com/de-de/search/?q=${encodeURIComponent(match.item)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="number-link"
                          >
                            {match.item}
                          </a>
                        </span>
                      </div>
                    )}
                    {match.bosch && match.bosch !== '-' && (
                      <div className="result-row">
                        <span className="result-label">Bosch:</span>
                        <span className="result-value">
                          <a
                            href={`https://www.boschrexroth.com/de/de/search.html?q=${encodeURIComponent(match.bosch)}&origin=header`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="number-link"
                          >
                            {match.bosch}
                          </a>
                        </span>
                      </div>
                    )}
                    {((match.alvaris_artnr && match.alvaris_artnr !== '-') ||
                      (match.alvaris_matnr && match.alvaris_matnr !== '-')) && (
                      <div className="result-row">
                        <span className="result-label">Alvaris:</span>
                        <span className="result-value">
                          {match.alvaris_artnr && match.alvaris_artnr !== '-' ? (
                            <a
                              href={`https://www.alvaris.com/de/?s=${encodeURIComponent(match.alvaris_artnr)}&trp-form-language=de`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="number-link"
                            >
                              {match.alvaris_artnr}
                            </a>
                          ) : '-'}
                          {' / '}
                          {match.alvaris_matnr && match.alvaris_matnr !== '-' ? match.alvaris_matnr : '-'}
                        </span>
                      </div>
                    )}
                    {match.ask && match.ask !== '-' && (
                      <div className="result-row">
                        <span className="result-label">ASK:</span>
                        <span className="result-value">{match.ask}</span>
                      </div>
                    )}
                  </div>
                  {match.description && (
                    <div className="result-row description">
                      <span className="result-label">Beschreibung:</span>
                      <span className="result-value">{match.description.split('\n').map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}</span>
                    </div>
                  )}
                  {match.image && (
                    <div className={`result-image ${match.image.crop_top_70 ? 'crop-alvaris' : ''}`}>
                      <img
                        src={`/images/${match.image.artnr}.png`}
                        alt="Produkt"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
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
              accept=".csv,.xlsx"
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
            <button onClick={handleBrowseClick} className="compact-button">
              {file ? sanitizeFilename(file.name) : 'Datei wählen (csv, xlsx)'}
            </button>
            <button
              onClick={() => setShowInfoModal(true)}
              className="info-button"
              title="Informationen"
            >
              ⓘ
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
              Ziel:
              <select value={targetCol} onChange={(e) => setTargetCol(e.target.value as 'A' | 'B')}>
                <option value="A">A: Syskomp neu</option>
                <option value="B">B: Syskomp alt</option>
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
                  ✓ {batchResult.success}
                </span>
                <span className="failed-badge">
                  ✗ {batchResult.failed}
                </span>
                <button onClick={handleExport} className="export-button-compact">Speichern unter</button>
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

      {/* Info Modal */}
      {showInfoModal && (
        <div className="modal-overlay" onClick={() => setShowInfoModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Dateiinformationen</h3>
              <button className="modal-close" onClick={() => setShowInfoModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Die Dateien sind begrenzt auf 10MB.</p>
              <p><strong>Batch-Konvertierung:</strong></p>
              <p>Ersetzt Nummern in der ausgewählten Spalte mit Syskomp neu (A) oder Syskomp alt (B).</p>
              <p>Nicht gefundene Nummern werden als ?nummer? markiert.</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer with stats */}
      {stats && (
        <div className="stats-footer">
          SG: {stats.syskomp} / Item: {stats.item} / Bosch: {stats.bosch} / Alvaris: {stats.alvaris} / ASK: {stats.ask} records
        </div>
      )}
    </div>
  )
}

export default PortfolioConversion
