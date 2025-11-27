import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import EditableField from './EditableField'
import CatalogMapper from './CatalogMapper'
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
  const [currentTab, setCurrentTab] = useState<'search' | 'batch' | 'mapper'>('search')
  const [mapperKey, setMapperKey] = useState(0)
  const [searchNumber, setSearchNumber] = useState('140000067')
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

  // New entry form states
  const [showNewEntryForm, setShowNewEntryForm] = useState(false)
  const [newEntry, setNewEntry] = useState({
    syskomp_neu: '',
    syskomp_alt: '',
    description: '',
    item: '',
    bosch: '',
    alvaris_artnr: '',
    alvaris_matnr: '',
    ask: ''
  })
  const [newEntryLoading, setNewEntryLoading] = useState(false)
  const [newEntryError, setNewEntryError] = useState<string | null>(null)
  const [newEntrySuccess, setNewEntrySuccess] = useState<string | null>(null)
  const [newEntryImage, setNewEntryImage] = useState<File | null>(null)
  const [newEntryImagePreview, setNewEntryImagePreview] = useState<string | null>(null)

  // Edit description states (per syskomp_neu)
  const [editingDescription, setEditingDescription] = useState<string | null>(null)
  const [descriptionValue, setDescriptionValue] = useState('')
  const [descriptionSaving, setDescriptionSaving] = useState(false)

  // Edit image states (per syskomp_neu)
  const [editingImage, setEditingImage] = useState<string | null>(null)
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)
  const [imageSaving, setImageSaving] = useState(false)

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

  const handleUpdateEntry = async (syskomp_neu: string, col: string, value: string) => {
    try {
      // If deleting Syskomp neu (column A), delete the entire row
      if (col === 'A' && !value.trim()) {
        const response = await fetch(`${API_URL}/delete-row`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ syskomp_neu }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Fehler beim Löschen der Zeile')
        }

        // Clear result after deletion
        setResult(null)
        setSearchNumber('')
        return
      }

      const response = await fetch(`${API_URL}/update-entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          syskomp_neu,
          col,
          value
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Fehler beim Speichern')
      }

      // Nach erfolgreicher Aktualisierung neu suchen
      await handleSearch()

    } catch (err: any) {
      throw new Error(err.message || 'Fehler beim Aktualisieren')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Handle image selection for new entry (from file input or paste)
  const processImageFile = (file: File) => {
    // Check file type
    if (!file.type.startsWith('image/')) {
      setNewEntryError('Bitte nur Bilddateien auswählen (PNG, JPG, etc.)')
      return
    }
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setNewEntryError('Bild darf max. 5MB groß sein')
      return
    }
    setNewEntryImage(file)
    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setNewEntryImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
    setNewEntryError(null)
  }

  const handleNewEntryImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processImageFile(file)
    }
  }

  // Handle paste event for screenshot
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile()
        if (file) {
          e.preventDefault()
          processImageFile(file)
          break
        }
      }
    }
  }

  // Handle create new entry
  const handleCreateEntry = async () => {
    if (!newEntry.syskomp_neu.trim()) {
      setNewEntryError('Syskomp neu ist erforderlich')
      return
    }

    setNewEntryLoading(true)
    setNewEntryError(null)
    setNewEntrySuccess(null)

    try {
      const response = await fetch(`${API_URL}/create-entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newEntry),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Fehler beim Erstellen')
      }

      const data = await response.json()

      // Upload image if selected
      if (newEntryImage) {
        const formData = new FormData()
        formData.append('image', newEntryImage)
        formData.append('syskomp_neu', data.syskomp_neu)

        const imageResponse = await fetch(`${API_URL}/upload-image`, {
          method: 'POST',
          body: formData,
        })

        if (!imageResponse.ok) {
          console.error('Bild-Upload fehlgeschlagen')
        }
      }

      setNewEntrySuccess(`Eintrag ${data.syskomp_neu} erfolgreich erstellt!`)

      // Reset form
      setNewEntry({
        syskomp_neu: '',
        syskomp_alt: '',
        description: '',
        item: '',
        bosch: '',
        alvaris_artnr: '',
        alvaris_matnr: '',
        ask: ''
      })
      setNewEntryImage(null)
      setNewEntryImagePreview(null)

      // Search for the new entry
      setSearchNumber(data.syskomp_neu)
      setTimeout(() => handleSearch(), 500)

    } catch (err: any) {
      setNewEntryError(err.message || 'Fehler beim Erstellen des Eintrags')
    } finally {
      setNewEntryLoading(false)
    }
  }

  // Handle description edit
  const handleEditDescription = (syskomp_neu: string, currentDescription: string) => {
    setEditingDescription(syskomp_neu)
    setDescriptionValue(currentDescription || '')
  }

  const handleSaveDescription = async (syskomp_neu: string) => {
    setDescriptionSaving(true)
    try {
      await handleUpdateEntry(syskomp_neu, 'C', descriptionValue)
      setEditingDescription(null)
      setDescriptionValue('')
    } catch (err) {
      console.error('Failed to save description:', err)
    } finally {
      setDescriptionSaving(false)
    }
  }

  const handleCancelDescription = () => {
    setEditingDescription(null)
    setDescriptionValue('')
  }

  // Handle image edit
  const handleEditImage = (syskomp_neu: string) => {
    setEditingImage(syskomp_neu)
    setEditImageFile(null)
    setEditImagePreview(null)
  }

  const processEditImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      return
    }
    setEditImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setEditImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleEditImagePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile()
        if (file) {
          e.preventDefault()
          processEditImageFile(file)
          break
        }
      }
    }
  }

  const handleSaveImage = async (syskomp_neu: string) => {
    if (!editImageFile) return

    setImageSaving(true)
    try {
      const formData = new FormData()
      formData.append('image', editImageFile)
      formData.append('syskomp_neu', syskomp_neu)

      const response = await fetch(`${API_URL}/upload-image`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        setEditingImage(null)
        setEditImageFile(null)
        setEditImagePreview(null)
        // Refresh search to show new image
        await handleSearch()
      }
    } catch (err) {
      console.error('Failed to save image:', err)
    } finally {
      setImageSaving(false)
    }
  }

  const handleCancelImage = () => {
    setEditingImage(null)
    setEditImageFile(null)
    setEditImagePreview(null)
  }

  // Handle Ctrl+Click on any number to search for it
  const handleCtrlClickSearch = (number: string) => {
    setSearchNumber(number)
    // Trigger search with the new number
    setTimeout(async () => {
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
            number: number.trim()
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'API Fehler')
        }

        const data: SearchResult = await response.json()
        setResult(data)

      } catch (err: any) {
        setError(err.message || 'Fehler bei der Suche.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }, 0)
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

      {/* Tab Navigation */}
      <div className="tab-navigation" style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #ccc', paddingBottom: '10px' }}>
        <button
          onClick={() => {
            setCurrentTab('search')
            setShowNewEntryForm(false)
          }}
          style={{
            padding: '10px 20px',
            background: currentTab === 'search' && !showNewEntryForm ? '#007bff' : '#f0f0f0',
            color: currentTab === 'search' && !showNewEntryForm ? 'white' : 'black',
            border: 'none',
            cursor: 'pointer',
            fontWeight: currentTab === 'search' && !showNewEntryForm ? 'bold' : 'normal'
          }}
        >
          Suche
        </button>
        <button
          onClick={() => {
            setCurrentTab('search')
            setShowNewEntryForm(true)
            setSearchNumber('')
            setResult(null)
            setError(null)
          }}
          style={{
            padding: '10px 20px',
            background: showNewEntryForm && currentTab === 'search' ? '#28a745' : '#f0f0f0',
            color: showNewEntryForm && currentTab === 'search' ? 'white' : 'black',
            border: 'none',
            cursor: 'pointer',
            fontWeight: showNewEntryForm && currentTab === 'search' ? 'bold' : 'normal'
          }}
        >
          + Neuer Eintrag
        </button>
        <button
          onClick={() => setCurrentTab('batch')}
          style={{
            padding: '10px 20px',
            background: currentTab === 'batch' ? '#007bff' : '#f0f0f0',
            color: currentTab === 'batch' ? 'white' : 'black',
            border: 'none',
            cursor: 'pointer',
            fontWeight: currentTab === 'batch' ? 'bold' : 'normal'
          }}
        >
          Batch
        </button>
        <button
          onClick={() => {
            setCurrentTab('mapper')
            setMapperKey(prev => prev + 1)
          }}
          style={{
            padding: '10px 20px',
            background: currentTab === 'mapper' ? '#007bff' : '#f0f0f0',
            color: currentTab === 'mapper' ? 'white' : 'black',
            border: 'none',
            cursor: 'pointer',
            fontWeight: currentTab === 'mapper' ? 'bold' : 'normal'
          }}
        >
          Mapper
        </button>
      </div>

      {/* Render each tab independently */}
      {currentTab === 'search' && (
        <div className="tab-content">
          {currentTab === 'search' && (
            <div className="section single-section">
              <h2>Artikelnummersuche (über alle Kataloge Bosch, Item, Alvaris, Ask)</h2>

          <div className="input-row">
            <input
              type="text"
              value={searchNumber}
              onChange={(e) => setSearchNumber(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Nummer eingeben"
              style={{ flex: 1 }}
              className="compact-input"
            />
            <button onClick={handleSearch} disabled={loading} className="compact-button">
              {loading ? 'Suche...' : 'Suchen'}
            </button>
          </div>

          {error && <div className="error-msg">{error}</div>}

          {/* New Entry Form */}
          {showNewEntryForm && (
            <div style={{
              border: '1px solid #28a745',
              borderRadius: '6px',
              padding: '15px',
              marginBottom: '20px',
              background: '#f8fff8'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#28a745' }}>Neuen Syskomp-Eintrag erstellen</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
                    Syskomp neu * <span style={{ fontSize: '0.8em', color: '#666' }}>(9 Ziffern, beginnt mit 1)</span>
                  </label>
                  <input
                    type="text"
                    value={newEntry.syskomp_neu}
                    onChange={(e) => setNewEntry({ ...newEntry, syskomp_neu: e.target.value })}
                    placeholder="z.B. 110000123"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
                    Syskomp alt <span style={{ fontSize: '0.8em', color: '#666' }}>(9 Ziffern, beginnt mit 2 oder 4)</span>
                  </label>
                  <input
                    type="text"
                    value={newEntry.syskomp_alt}
                    onChange={(e) => setNewEntry({ ...newEntry, syskomp_alt: e.target.value })}
                    placeholder="z.B. 210000123"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Beschreibung</label>
                <textarea
                  value={newEntry.description}
                  onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                  placeholder="Produktbeschreibung eingeben..."
                  rows={3}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Item <span style={{ fontSize: '0.8em', color: '#666' }}>(z.B. 0.0.479.76)</span></label>
                  <input
                    type="text"
                    value={newEntry.item}
                    onChange={(e) => setNewEntry({ ...newEntry, item: e.target.value })}
                    placeholder="0.0.xxx.xx"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Bosch <span style={{ fontSize: '0.8em', color: '#666' }}>(10 Ziffern)</span></label>
                  <input
                    type="text"
                    value={newEntry.bosch}
                    onChange={(e) => setNewEntry({ ...newEntry, bosch: e.target.value })}
                    placeholder="0820055051"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Alvaris Artnr <span style={{ fontSize: '0.8em', color: '#666' }}>(7 Ziffern)</span></label>
                  <input
                    type="text"
                    value={newEntry.alvaris_artnr}
                    onChange={(e) => setNewEntry({ ...newEntry, alvaris_artnr: e.target.value })}
                    placeholder="1010072"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Alvaris Matnr <span style={{ fontSize: '0.8em', color: '#666' }}>(max 10, mit Buchstaben)</span></label>
                  <input
                    type="text"
                    value={newEntry.alvaris_matnr}
                    onChange={(e) => setNewEntry({ ...newEntry, alvaris_matnr: e.target.value })}
                    placeholder="ANTSTEP.60"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>ASK <span style={{ fontSize: '0.8em', color: '#666' }}>(6-8 Ziffern)</span></label>
                <input
                  type="text"
                  value={newEntry.ask}
                  onChange={(e) => setNewEntry({ ...newEntry, ask: e.target.value })}
                  placeholder="1234567"
                  style={{ width: '50%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              {/* Bild-Upload mit Paste-Unterstützung */}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
                  Produktbild <span style={{ fontSize: '0.8em', color: '#666' }}>(optional, max 5MB)</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleNewEntryImageSelect}
                  />
                  <span style={{ color: '#666', fontSize: '0.85em' }}>oder</span>
                </div>
                {/* Paste-Zone für Screenshots */}
                <div
                  onPaste={handlePaste}
                  tabIndex={0}
                  style={{
                    border: newEntryImagePreview ? '2px solid #28a745' : '2px dashed #ccc',
                    borderRadius: '6px',
                    padding: '20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: newEntryImagePreview ? '#f8fff8' : '#fafafa',
                    outline: 'none',
                    transition: 'border-color 0.2s, background 0.2s'
                  }}
                  onFocus={(e) => {
                    if (!newEntryImagePreview) {
                      e.currentTarget.style.borderColor = '#007bff'
                      e.currentTarget.style.background = '#f0f7ff'
                    }
                  }}
                  onBlur={(e) => {
                    if (!newEntryImagePreview) {
                      e.currentTarget.style.borderColor = '#ccc'
                      e.currentTarget.style.background = '#fafafa'
                    }
                  }}
                >
                  {newEntryImagePreview ? (
                    <div>
                      <img
                        src={newEntryImagePreview}
                        alt="Vorschau"
                        style={{
                          maxWidth: '300px',
                          maxHeight: '200px',
                          border: '1px solid #ccc',
                          borderRadius: '4px'
                        }}
                      />
                      <div style={{ marginTop: '10px' }}>
                        <button
                          onClick={() => {
                            setNewEntryImage(null)
                            setNewEntryImagePreview(null)
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '0.9em'
                          }}
                        >
                          Bild entfernen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#666' }}>
                      <div style={{ fontSize: '1.5em', marginBottom: '8px' }}>📋</div>
                      <div>Hier klicken und <strong>Strg+V</strong> drücken</div>
                      <div style={{ fontSize: '0.85em', marginTop: '4px' }}>um Screenshot einzufügen</div>
                    </div>
                  )}
                </div>
              </div>

              {newEntryError && (
                <div style={{ color: '#dc3545', marginBottom: '10px', padding: '8px', background: '#fee', borderRadius: '4px' }}>
                  {newEntryError}
                </div>
              )}

              {newEntrySuccess && (
                <div style={{ color: '#28a745', marginBottom: '10px', padding: '8px', background: '#efe', borderRadius: '4px' }}>
                  {newEntrySuccess}
                </div>
              )}

              <button
                onClick={handleCreateEntry}
                disabled={newEntryLoading || !newEntry.syskomp_neu.trim()}
                style={{
                  padding: '10px 24px',
                  background: newEntryLoading || !newEntry.syskomp_neu.trim() ? '#ccc' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: newEntryLoading || !newEntry.syskomp_neu.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '1em',
                  fontWeight: 'bold'
                }}
              >
                {newEntryLoading ? 'Erstelle...' : 'Eintrag erstellen'}
              </button>
            </div>
          )}

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
                    {/* Syskomp neu - Editierbar */}
                    <EditableField
                      label="Syskomp neu"
                      value={match.syskomp_neu}
                      column="A"
                      onSave={async (value) => await handleUpdateEntry(match.syskomp_neu, 'A', value)}
                      linkUrl={match.syskomp_neu && match.syskomp_neu !== '-' ? `https://shop.syskomp-group.com/de-DE/search?query=${encodeURIComponent(match.syskomp_neu)}` : undefined}
                      onCtrlClick={handleCtrlClickSearch}
                    />

                    {/* Syskomp alt - Editierbar */}
                    <EditableField
                      label="Syskomp alt"
                      value={match.syskomp_alt}
                      column="B"
                      onSave={async (value) => await handleUpdateEntry(match.syskomp_neu, 'B', value)}
                      linkUrl={match.syskomp_alt && match.syskomp_alt !== '-' ? `https://shop.syskomp-group.com/de-DE/search?query=${encodeURIComponent(match.syskomp_alt)}` : undefined}
                      onCtrlClick={handleCtrlClickSearch}
                    />

                    {/* Item - Immer anzeigen, editierbar wenn leer */}
                    <EditableField
                      label="Item"
                      value={match.item}
                      column="D"
                      onSave={async (value) => await handleUpdateEntry(match.syskomp_neu, 'D', value)}
                      linkUrl={match.item && match.item !== '-' ? `https://www.item24.com/de-de/search/?q=${encodeURIComponent(match.item)}` : undefined}
                      onCtrlClick={handleCtrlClickSearch}
                    />

                    {/* Bosch - Immer anzeigen, editierbar wenn leer */}
                    <EditableField
                      label="Bosch"
                      value={match.bosch}
                      column="E"
                      onSave={async (value) => await handleUpdateEntry(match.syskomp_neu, 'E', value)}
                      linkUrl={match.bosch && match.bosch !== '-' ? `https://www.boschrexroth.com/de/de/search.html?q=${encodeURIComponent(match.bosch)}&origin=header` : undefined}
                      onCtrlClick={handleCtrlClickSearch}
                    />

                    {/* Alvaris Artnr - Immer anzeigen, editierbar wenn leer */}
                    <EditableField
                      label="Alvaris Artnr"
                      value={match.alvaris_artnr}
                      column="F"
                      onSave={async (value) => await handleUpdateEntry(match.syskomp_neu, 'F', value)}
                      linkUrl={match.alvaris_artnr && match.alvaris_artnr !== '-' ? `https://www.alvaris.com/de/?s=${encodeURIComponent(match.alvaris_artnr)}&trp-form-language=de` : undefined}
                      onCtrlClick={handleCtrlClickSearch}
                    />

                    {/* Alvaris Matnr - Immer anzeigen, editierbar wenn leer */}
                    <EditableField
                      label="Alvaris Matnr"
                      value={match.alvaris_matnr}
                      column="G"
                      onSave={async (value) => await handleUpdateEntry(match.syskomp_neu, 'G', value)}
                      onCtrlClick={handleCtrlClickSearch}
                    />

                    {/* ASK - Immer anzeigen, editierbar wenn leer */}
                    <EditableField
                      label="ASK"
                      value={match.ask}
                      column="H"
                      onSave={async (value) => await handleUpdateEntry(match.syskomp_neu, 'H', value)}
                      linkUrl={match.ask && match.ask !== '-' ? 'https://askgmbh.com/auctores/scs/imc' : undefined}
                      onCtrlClick={handleCtrlClickSearch}
                    />
                  </div>

                  {/* Beschreibung - editierbar */}
                  <div className="result-row description" style={{ marginTop: '10px' }}>
                    <span className="result-label">Beschreibung:</span>
                    <span className="result-value" style={{ display: 'block', width: '100%' }}>
                      {editingDescription === match.syskomp_neu ? (
                        <div style={{ marginTop: '5px' }}>
                          <textarea
                            value={descriptionValue}
                            onChange={(e) => setDescriptionValue(e.target.value)}
                            rows={4}
                            style={{
                              width: '100%',
                              padding: '8px',
                              borderRadius: '4px',
                              border: '1px solid #ccc',
                              resize: 'vertical',
                              fontFamily: 'inherit'
                            }}
                            placeholder="Beschreibung eingeben..."
                          />
                          <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleSaveDescription(match.syskomp_neu)}
                              disabled={descriptionSaving}
                              style={{
                                padding: '6px 12px',
                                background: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: descriptionSaving ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {descriptionSaving ? 'Speichere...' : 'Speichern'}
                            </button>
                            <button
                              onClick={handleCancelDescription}
                              disabled={descriptionSaving}
                              style={{
                                padding: '6px 12px',
                                background: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {match.description ? (
                            <>
                              {match.description.split('\n').map((line, i) => (
                                <div key={i}>{line}</div>
                              ))}
                              <button
                                onClick={() => handleEditDescription(match.syskomp_neu, match.description)}
                                className="add-button"
                                style={{ marginTop: '5px' }}
                              >
                                Ändern
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleEditDescription(match.syskomp_neu, '')}
                              className="add-button"
                            >
                              + Hinzufügen
                            </button>
                          )}
                        </>
                      )}
                    </span>
                  </div>

                  {/* Bild - editierbar */}
                  <div className="result-row" style={{ marginTop: '10px' }}>
                    <span className="result-label">Bild:</span>
                    <span className="result-value" style={{ display: 'block', width: '100%' }}>
                      {editingImage === match.syskomp_neu ? (
                        <div style={{ marginTop: '5px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) processEditImageFile(file)
                              }}
                            />
                            <span style={{ color: '#666', fontSize: '0.85em' }}>oder</span>
                          </div>
                          <div
                            onPaste={handleEditImagePaste}
                            tabIndex={0}
                            style={{
                              border: editImagePreview ? '2px solid #28a745' : '2px dashed #ccc',
                              borderRadius: '6px',
                              padding: '15px',
                              textAlign: 'center',
                              cursor: 'pointer',
                              background: editImagePreview ? '#f8fff8' : '#fafafa',
                              outline: 'none'
                            }}
                          >
                            {editImagePreview ? (
                              <img
                                src={editImagePreview}
                                alt="Vorschau"
                                style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '4px' }}
                              />
                            ) : (
                              <div style={{ color: '#666' }}>
                                <div>Hier klicken + <strong>Strg+V</strong></div>
                                <div style={{ fontSize: '0.85em' }}>für Screenshot</div>
                              </div>
                            )}
                          </div>
                          <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleSaveImage(match.syskomp_neu)}
                              disabled={imageSaving || !editImageFile}
                              style={{
                                padding: '6px 12px',
                                background: imageSaving || !editImageFile ? '#ccc' : '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: imageSaving || !editImageFile ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {imageSaving ? 'Speichere...' : 'Speichern'}
                            </button>
                            <button
                              onClick={handleCancelImage}
                              disabled={imageSaving}
                              style={{
                                padding: '6px 12px',
                                background: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {match.image ? (
                            <div className={`result-image ${match.image.crop_top_70 ? 'crop-alvaris' : ''}`}>
                              <img
                                src={`/images/${match.image.artnr}.png`}
                                alt="Produkt"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                }}
                              />
                              <button
                                onClick={() => handleEditImage(match.syskomp_neu)}
                                className="add-button"
                                style={{ marginTop: '5px', display: 'block' }}
                              >
                                Ändern
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEditImage(match.syskomp_neu)}
                              className="add-button"
                            >
                              + Hinzufügen
                            </button>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
          )}
        </div>
      )}

      {currentTab === 'batch' && (
        <div className="tab-content">
        {currentTab === 'batch' && (
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
        )}
        </div>
      )}

      {currentTab === 'mapper' && (
        <CatalogMapper key={mapperKey} />
      )}

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
