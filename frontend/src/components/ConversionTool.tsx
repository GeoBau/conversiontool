import { useState, useRef } from 'react'
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

  // Batch conversion states
  const [file, setFile] = useState<File | null>(null)
  const [fileDirectoryHandle, setFileDirectoryHandle] = useState<any>(null)
  const [originalFileData, setOriginalFileData] = useState<any[][] | null>(null)
  const [columnLetter, setColumnLetter] = useState('A')
  const [targetSystem, setTargetSystem] = useState<string>('syskomp')
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchResult, setBatchResult] = useState<BatchResponse | null>(null)
  const [batchError, setBatchError] = useState<string | null>(null)
  const [showInfoModal, setShowInfoModal] = useState(false)
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

  // Batch conversion functions
  const columnLetterToIndex = (letter: string): number => {
    return letter.toUpperCase().charCodeAt(0) - 65
  }

  const escapeCsvValue = (value: any): string => {
    // Prevent CSV injection by escaping formulas
    const stringValue = String(value)

    // Check if value starts with dangerous characters
    if (stringValue.match(/^[=+\-@\t\r]/)) {
      // Prepend with single quote to prevent formula execution
      return `'${stringValue}`
    }

    return stringValue
  }

  const sanitizeFilename = (filename: string): string => {
    // Remove path separators and dangerous characters
    return filename
      .replace(/[<>:"|?*\x00-\x1f]/g, '') // Remove dangerous characters
      .replace(/^\.+/, '') // Remove leading dots
      .replace(/\.\./g, '.') // Replace double dots
      .replace(/\\/g, '') // Remove backslashes
      .replace(/\//g, '') // Remove forward slashes
      .trim()
      .slice(0, 255) // Limit length
  }

  const verifyMimeType = async (file: File): Promise<boolean> => {
    const validMimeTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // fallback for some systems
    ]

    // Check browser-reported MIME type
    if (!validMimeTypes.includes(file.type) && file.type !== '') {
      return false
    }

    // Read file signature (magic bytes) for additional verification
    try {
      const buffer = await file.slice(0, 4).arrayBuffer()
      const bytes = new Uint8Array(buffer)

      // Check for ZIP signature (XLSX files are ZIP archives)
      // Magic bytes: 50 4B 03 04 or 50 4B 05 06 or 50 4B 07 08
      if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
        return true // XLSX file
      }

      // CSV files don't have magic bytes, so we accept if extension matches
      if (file.name.toLowerCase().endsWith('.csv')) {
        return true
      }

      return false
    } catch {
      // If we can't read the file, fall back to extension check
      return true
    }
  }

  const handleFileSelect = async (selectedFile: File) => {
    const fileName = selectedFile.name.toLowerCase()
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes

    // Check file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setBatchError(`Datei ist zu groß. Maximum: 10MB (Ihre Datei: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB)`)
      return
    }

    // Check file extension
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx')) {
      setBatchError('Bitte wählen Sie eine CSV- oder XLSX-Datei aus')
      return
    }

    // Verify MIME type and file signature
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
      setFileDirectoryHandle(null) // No directory handle available from regular input
    }
  }

  const handleBrowseClick = async () => {
    // Try to use File System Access API first
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

        // Try to get the parent directory handle
        try {
          // Note: Getting parent directory is not directly supported in the API
          // but we can store the file handle and use it as startIn for save dialog
          setFileDirectoryHandle(fileHandle)
        } catch (err) {
          console.log('Could not get directory handle:', err)
          setFileDirectoryHandle(null)
        }
      } catch (err) {
        // User cancelled or error - do nothing
        console.log('File picker cancelled or failed:', err)
      }
    } else {
      // Fallback to regular file input
      fileInputRef.current?.click()
    }
  }

  const parseCSV = (text: string, colIndex: number): { numbers: string[], fullData: any[][] } => {
    const lines = text.split('\n')
    const numbers: string[] = []
    const fullData: any[][] = []

    // Check if first row is a header
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

    // Process all lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue  // Skip completely empty lines

      const columns = line.split(';')
      fullData.push(columns)

      // Extract number if this is a data row (not header)
      if (i > 0 || !hasHeader) {
        if (columns.length > colIndex) {
          const value = columns[colIndex].trim()
          if (value) {
            numbers.push(value)
          }
        }
      }
    }

    console.log('CSV parse:', { hasHeader, totalLines: lines.length, rowsParsed: fullData.length, numbersFound: numbers.length, colIndex })

    return { numbers, fullData }
  }

  const parseExcel = async (file: File, colIndex: number): Promise<{ numbers: string[], fullData: any[][] }> => {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' }) as any[][]
    const numbers: string[] = []

    // Check if first row is a header
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

    // Extract numbers from data rows
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

    console.log('Excel parse:', { hasHeader, startRow, totalRows: jsonData.length, numbersFound: numbers.length, colIndex })

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

      // Store the original file data
      setOriginalFileData(fullData)

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

  const handleExport = async () => {
    if (!batchResult || !file || !originalFileData) return

    const colIndex = columnLetterToIndex(columnLetter)

    // Create array with converted numbers (or ?number? for failures)
    const convertedNumbers = batchResult.results.map(r =>
      r.status === 'success' ? r.output : `?${r.input}?`
    )

    // Create modified data by replacing only the specified column
    const modifiedData = originalFileData.map((row, index) => {
      const newRow = [...row]

      // Determine if this row should be modified
      // Skip header row if it exists (check if first value in target column is not numeric)
      const isHeaderRow = index === 0 && row[colIndex] && !/^\d+(\.\d+)*$/.test(String(row[colIndex]).trim())

      if (!isHeaderRow && convertedNumbers.length > 0) {
        // Calculate the data row index (accounting for potential header)
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

        // Apply red color to failed conversions (cells containing ?number?)
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

        const fileName = `${originalFileName}-${targetSystem}.xlsx`

        // Use File System Access API if available
        if ('showSaveFilePicker' in window) {
          const options: any = {
            suggestedName: fileName,
            types: [{
              description: 'Excel Files',
              accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
            }]
          }

          // Use the same directory as the input file if available
          if (fileDirectoryHandle) {
            options.startIn = fileDirectoryHandle
          }

          const fileHandle = await (window as any).showSaveFilePicker(options)

          const writableStream = await fileHandle.createWritable()
          const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', cellStyles: true })
          await writableStream.write(buffer)
          await writableStream.close()
        } else {
          // Fallback to direct download
          XLSX.writeFile(workbook, fileName, { cellStyles: true })
        }
      } else {
        // CSV export - escape values to prevent CSV injection
        const csvContent = modifiedData.map(row =>
          row.map(cell => escapeCsvValue(cell)).join(';')
        ).join('\n')
        const fileName = `${originalFileName}-${targetSystem}.csv`

        // Use File System Access API if available
        if ('showSaveFilePicker' in window) {
          const options: any = {
            suggestedName: fileName,
            types: [{
              description: 'CSV Files',
              accept: { 'text/csv': ['.csv'] }
            }]
          }

          // Use the same directory as the input file if available
          if (fileDirectoryHandle) {
            options.startIn = fileDirectoryHandle
          }

          const fileHandle = await (window as any).showSaveFilePicker(options)

          const writableStream = await fileHandle.createWritable()
          await writableStream.write(csvContent)
          await writableStream.close()
        } else {
          // Fallback to direct download
          // Escape CSV values to prevent injection
          const escapedContent = csvContent.split('\n').map((line, idx) => {
            if (idx === 0) return line // Keep header unchanged
            const values = line.split(';')
            return values.map(v => escapeCsvValue(v)).join(';')
          }).join('\n')

          const blob = new Blob([escapedContent], { type: 'text/csv;charset=utf-8;' })
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
      // User cancelled the save dialog or error occurred
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
            <div className="ambiguous-results">
              {result.results.map((item, index) => (
                <div key={index} className="result-compact">
                  <div className="result-row">
                    <span className="result-label">Eingabe:</span>
                    <span className="result-value">{item.input_number}</span>
                    <span className="result-badge">{getSystemLabel(item.input_type)}</span>
                  </div>
                  <div className="result-row">
                    <span className="result-label">Entsprechung:</span>
                    <span className="result-value">{item.corresponding_number}</span>
                    <span className="result-badge">{getSystemLabel(item.corresponding_type)}</span>
                  </div>
                  {item.bez1 && (
                    <div className="result-row">
                      <span className="result-label">Bezeichnung 1:</span>
                      <span className="result-value">{item.bez1}</span>
                    </div>
                  )}
                  <div className="result-row">
                    <span className="result-label">Bezeichnung 2:</span>
                    <span className="result-value">{item.bez2 || '-'}</span>
                  </div>
                  <div className="result-row">
                    <span className="result-label">Warengruppe:</span>
                    <span className="result-value">
                      {item.warengruppe || '-'}
                      {item.warengruppe_description && ` - ${item.warengruppe_description}`}
                    </span>
                  </div>
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
              <p><strong>xlsx-Dateien:</strong></p>
              <p>Die Konvertierung kann nur in der angegebenen Spalte ersten Tab des Files (üblicherweise "Tabelle1" bezeichnet) erfolgen. </p>
              <p>Bei 'Konvertieren' werden die möglichen neuen Artnr im Vergleich zu den vorhandenen angezeigt. 
                Es erfolgt keine Speicherung der Daten, es ist nur eine Anzeige.
                Die Datei bleibt unverändert.</p>
              <p>Bei 'Speichern unter' legen sie den Dateinamen fest, unter dem die Datei mit den geänderten Artikelnummern gespeichert wird.
                Die Formatierung der Felder werden auf das Standardformat zurückgesetzt.
                Macros, Formeln werden nicht ausgeführt und gehen verloren, nur das Ergebnis bleibt im Feld erhalten
                </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConversionTool
