import { useState } from 'react'
import './NumberSearch.css'

interface SearchResult {
  input_number: string
  input_type: string
  corresponding_number: string
  corresponding_type: string
  bez1: string
  bez2: string
  warengruppe: string
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
  const [searchNumber, setSearchNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

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
                <span className="number">{result.result.input_number}</span>
                <span className="system-badge">{getSystemLabel(result.result.input_type)}</span>
              </div>
            </div>
            <div className="arrow">→</div>
            <div className="result-item output">
              <label>Entsprechung</label>
              <div className="number-display">
                <span className="number">{result.result.corresponding_number}</span>
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
              <p>{result.result.warengruppe || '-'}</p>
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
                      <span className="number">{item.input_number}</span>
                      <span className="system-badge">{getSystemLabel(item.input_type)}</span>
                    </div>
                  </div>
                  <div className="arrow">→</div>
                  <div className="result-item output">
                    <label>Entsprechung</label>
                    <div className="number-display">
                      <span className="number">{item.corresponding_number}</span>
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
                    <p>{item.warengruppe || '-'}</p>
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
