import { useState } from 'react'
import './NumberSearch.css'
import './ConversionTool.css' // For add-button styles

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

const API_URL = import.meta.env.VITE_API_URL || '/api'

const NumberSearch = () => {
  // Edit functionality for catalog numbers (item, bosch, alvaris)
  const [searchNumber, setSearchNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Edit state for catalog numbers
  const [editingNumber, setEditingNumber] = useState<string | null>(null)
  const [editedValue, setEditedValue] = useState('')

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

  const handleSearch = async () => {
    // Remove all spaces from the input
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

  const handleEditNumber = (number: string, type: string) => {
    // Only allow editing for item, bosch, alvaris (not syskomp)
    if (type === 'syskomp') {
      setError('Syskomp-Nummern können nicht bearbeitet werden')
      return
    }
    setEditingNumber(number)
    setEditedValue(number)
    setError(null)
  }

  const handleCancelEdit = () => {
    setEditingNumber(null)
    setEditedValue('')
  }

  const handleSaveEdit = async (oldNumber: string, type: string) => {
    if (!editedValue.trim()) {
      setError('Artikelnummer darf nicht leer sein')
      return
    }

    try {
      const response = await fetch(`${API_URL}/update-catalog-artikelnr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          catalog_type: type,
          old_artikelnr: oldNumber,
          new_artikelnr: editedValue.trim()
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Fehler beim Speichern')
      }

      // Update local state
      if (result && result.result) {
        const updatedResult = { ...result }
        if (updatedResult.result?.input_number === oldNumber) {
          updatedResult.result.input_number = editedValue.trim()
        }
        if (updatedResult.result?.corresponding_number === oldNumber) {
          updatedResult.result.corresponding_number = editedValue.trim()
        }
        setResult(updatedResult)
      } else if (result && result.results) {
        const updatedResult = { ...result }
        updatedResult.results = updatedResult.results?.map(item => ({
          ...item,
          input_number: item.input_number === oldNumber ? editedValue.trim() : item.input_number,
          corresponding_number: item.corresponding_number === oldNumber ? editedValue.trim() : item.corresponding_number
        }))
        setResult(updatedResult)
      }

      setEditingNumber(null)
      setEditedValue('')
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern der Artikelnummer')
    }
  }

  const renderEditableNumber = (number: string, type: string) => {
    const isEditing = editingNumber === number
    const canEdit = type !== 'syskomp'

    console.log('renderEditableNumber called:', { number, type, canEdit })

    if (isEditing) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="text"
            value={editedValue}
            onChange={(e) => setEditedValue(e.target.value)}
            style={{
              padding: '4px 8px',
              border: '1px solid #ccc',
              borderRadius: '3px',
              fontSize: '14px',
              width: '150px'
            }}
          />
          <button
            onClick={() => handleSaveEdit(number, type)}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Speichern
          </button>
          <button
            onClick={handleCancelEdit}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Abbrechen
          </button>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span className="number">{number}</span>
        {canEdit && (
          <button
            onClick={() => handleEditNumber(number, type)}
            className="add-button"
            title="Nummer ändern"
          >
            Ändern
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="number-search">
      <div className="search-box">
        <input
          type="text"
          value={searchNumber}
          onChange={(e) => setSearchNumber(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Artikelnummer eingeben (z.B. 415901309, 3842537592, 0.0.621.77)"
          className="search-input"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="search-button"
        >
          {loading ? 'Suche...' : 'Suchen'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {result && !result.found && (
        <div className="not-found">
          <h3>Keine Übereinstimmung gefunden</h3>
          <p>Für die Nummer "{result.search_term}" wurde keine Entsprechung gefunden.</p>
          <p className="hint">Erkannter Typ: {getSystemLabel(result.search_type || '')}</p>
        </div>
      )}

      {result && result.found && !result.ambiguous && result.result && (
        <div className="result-card">
          <h3>Ergebnis</h3>
          <div className="result-grid">
            <div className="result-item input">
              <label>Eingabe</label>
              <div className="number-display">
                {renderEditableNumber(result.result.input_number, result.result.input_type)}
                <span className="system-badge">{getSystemLabel(result.result.input_type)}</span>
              </div>
            </div>
            <div className="arrow">→</div>
            <div className="result-item output">
              <label>Entsprechung</label>
              <div className="number-display">
                {renderEditableNumber(result.result.corresponding_number, result.result.corresponding_type)}
                <span className="system-badge">{getSystemLabel(result.result.corresponding_type)}</span>
              </div>
            </div>
          </div>

          <div className="description-section">
            <div className="description-item">
              <label>Bezeichnung 1:</label>
              <p>{result.result.bez1 || '-'}</p>
            </div>
            <div className="description-item">
              <label>Bezeichnung 2:</label>
              <p>{result.result.bez2 || '-'}</p>
            </div>
            <div className="description-item">
              <label>Warengruppennummer:</label>
              <p>
                {result.result.warengruppe || '-'}
                {result.result.warengruppe_description && ` - ${result.result.warengruppe_description}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {result && result.found && result.ambiguous && result.results && (
        <div className="ambiguous-results">
          <h3>Mehrere Übereinstimmungen gefunden ({result.count})</h3>
          <p className="hint">Die Nummer kommt mehrmals in den Daten vor:</p>

          <div className="results-list">
            {result.results.map((item, index) => (
              <div key={index} className="result-card">
                <div className="result-grid">
                  <div className="result-item input">
                    <label>Eingabe</label>
                    <div className="number-display">
                      {renderEditableNumber(item.input_number, item.input_type)}
                      <span className="system-badge">{getSystemLabel(item.input_type)}</span>
                    </div>
                  </div>
                  <div className="arrow">→</div>
                  <div className="result-item output">
                    <label>Entsprechung</label>
                    <div className="number-display">
                      {renderEditableNumber(item.corresponding_number, item.corresponding_type)}
                      <span className="system-badge">{getSystemLabel(item.corresponding_type)}</span>
                    </div>
                  </div>
                </div>

                <div className="description-section">
                  <div className="description-item">
                    <label>Bezeichnung 1:</label>
                    <p>{item.bez1 || '-'}</p>
                  </div>
                  <div className="description-item">
                    <label>Bezeichnung 2:</label>
                    <p>{item.bez2 || '-'}</p>
                  </div>
                  <div className="description-item">
                    <label>Warengruppennummer:</label>
                    <p>
                      {item.warengruppe || '-'}
                      {item.warengruppe_description && ` - ${item.warengruppe_description}`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default NumberSearch
