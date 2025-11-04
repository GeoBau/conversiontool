import { useState, useEffect } from 'react'
import './ConversionTool.css'

interface Catalog {
  path: string
  name: string
  type: string
}

interface CatalogProduct {
  Artikelnummer: string
  Beschreibung: string
  Bild?: string
  URL?: string
}

interface PortfolioMatch {
  syskomp_neu: string
  syskomp_alt: string
  description: string
  item: string
  bosch: string
  alvaris_artnr: string
  alvaris_matnr: string
  ask: string
  similarity: number
}

const API_URL = import.meta.env.VITE_API_URL || '/api'

const CatalogMapper = () => {
  // Catalog selection
  const [catalogs, setCatalogs] = useState<Catalog[]>([])
  const [selectedCatalog, setSelectedCatalog] = useState<string>('')
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Matching
  const [matches, setMatches] = useState<PortfolioMatch[]>([])
  const [selectedMatch, setSelectedMatch] = useState<string>('')
  const [filterType, setFilterType] = useState<'all' | 'item' | 'bosch'>('all')
  const [minSimilarity, setMinSimilarity] = useState(0)
  const [matchLoading, setMatchLoading] = useState(false)

  // Fetch available catalogs on mount
  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        const response = await fetch(`${API_URL}/scan-catalogs`)
        if (response.ok) {
          const data = await response.json()
          setCatalogs(data.catalogs || [])
        }
      } catch (err) {
        console.error('Failed to fetch catalogs:', err)
      }
    }
    fetchCatalogs()
  }, [])

  const handleLoadCatalog = async () => {
    if (!selectedCatalog) {
      setError('Bitte einen Katalog auswählen')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/load-catalog`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          catalog_path: selectedCatalog
        }),
      })

      if (!response.ok) {
        throw new Error('Fehler beim Laden des Katalogs')
      }

      const data = await response.json()
      setCatalogProducts(data.products || [])
      setCurrentIndex(0)

      // Load matches for first product
      if (data.products && data.products.length > 0) {
        await findMatches(data.products[0].Beschreibung)
      }
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }

  const findMatches = async (description: string) => {
    if (!description) {
      setMatches([])
      return
    }

    setMatchLoading(true)

    try {
      const response = await fetch(`${API_URL}/find-similar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description,
          min_similarity: minSimilarity / 100,
          filter_type: filterType
        }),
      })

      if (!response.ok) {
        throw new Error('Fehler beim Suchen')
      }

      const data = await response.json()
      setMatches(data.matches || [])
    } catch (err) {
      console.error('Match error:', err)
      setMatches([])
    } finally {
      setMatchLoading(false)
    }
  }

  const handleSaveMapping = async () => {
    if (!selectedMatch) {
      setError('Bitte eine Syskomp-Nummer auswählen')
      return
    }

    const currentProduct = catalogProducts[currentIndex]
    if (!currentProduct) return

    try {
      const response = await fetch(`${API_URL}/update-entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          syskomp_neu: selectedMatch,
          col: 'H',
          value: currentProduct.Artikelnummer
        }),
      })

      if (!response.ok) {
        throw new Error('Fehler beim Speichern')
      }

      // Move to next product
      handleNext()
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
    }
  }

  const handleNext = () => {
    if (currentIndex < catalogProducts.length - 1) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      setSelectedMatch('')
      findMatches(catalogProducts[nextIndex].Beschreibung)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1
      setCurrentIndex(prevIndex)
      setSelectedMatch('')
      findMatches(catalogProducts[prevIndex].Beschreibung)
    }
  }

  const handleSkip = () => {
    handleNext()
  }

  const currentProduct = catalogProducts[currentIndex]
  const catalogName = catalogs.find(c => c.path === selectedCatalog)?.name || ''

  return (
    <div className="catalog-mapper">
      <h2>Katalog Mapper</h2>

      {/* Catalog Selection */}
      <div className="mapper-section">
        <h3>Katalog auswählen</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={selectedCatalog}
            onChange={(e) => setSelectedCatalog(e.target.value)}
            style={{ flex: 1, padding: '8px' }}
          >
            <option value="">-- Katalog wählen --</option>
            {catalogs.map((cat) => (
              <option key={cat.path} value={cat.path}>
                {cat.name} ({cat.type})
              </option>
            ))}
          </select>
          <button
            onClick={handleLoadCatalog}
            disabled={loading || !selectedCatalog}
            className="action-button"
          >
            {loading ? 'Laden...' : 'Laden'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: 'red', padding: '10px', marginTop: '10px' }}>
          {error}
        </div>
      )}

      {catalogProducts.length > 0 && currentProduct && (
        <>
          {/* Progress */}
          <div className="mapper-progress">
            Produkt {currentIndex + 1} / {catalogProducts.length} ({catalogName})
          </div>

          {/* Current Product Display */}
          <div className="mapper-section" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
            {/* Left: Product Info */}
            <div>
              <h3>Katalog-Produkt</h3>
              <div style={{ marginBottom: '10px' }}>
                <strong>Art. Nr:</strong> {currentProduct.Artikelnummer}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Beschreibung:</strong><br />
                {currentProduct.Beschreibung}
              </div>
              {currentProduct.URL && (
                <a
                  href={currentProduct.URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#007bff' }}
                >
                  🔗 Link zum Shop
                </a>
              )}
            </div>

            {/* Right: Filters */}
            <div>
              <h3>Filter für Matches</h3>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ marginRight: '15px' }}>
                  <input
                    type="radio"
                    value="all"
                    checked={filterType === 'all'}
                    onChange={(e) => {
                      setFilterType(e.target.value as 'all')
                      findMatches(currentProduct.Beschreibung)
                    }}
                  /> Alle
                </label>
                <label style={{ marginRight: '15px' }}>
                  <input
                    type="radio"
                    value="item"
                    checked={filterType === 'item'}
                    onChange={(e) => {
                      setFilterType(e.target.value as 'item')
                      findMatches(currentProduct.Beschreibung)
                    }}
                  /> Item
                </label>
                <label>
                  <input
                    type="radio"
                    value="bosch"
                    checked={filterType === 'bosch'}
                    onChange={(e) => {
                      setFilterType(e.target.value as 'bosch')
                      findMatches(currentProduct.Beschreibung)
                    }}
                  /> Bosch
                </label>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label>Min. Ähnlichkeit: {minSimilarity}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={minSimilarity}
                  onChange={(e) => {
                    setMinSimilarity(Number(e.target.value))
                  }}
                  onMouseUp={() => findMatches(currentProduct.Beschreibung)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* Matches */}
          <div className="mapper-section">
            <h3>Top Matches aus Portfolio ({matches.length})</h3>
            {matchLoading ? (
              <div>Suche Matches...</div>
            ) : (
              <div style={{
                border: '1px solid #ccc',
                maxHeight: '300px',
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}>
                {matches.length === 0 ? (
                  <div style={{ padding: '10px' }}>Keine Matches gefunden</div>
                ) : (
                  matches.map((match, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedMatch(match.syskomp_neu)}
                      style={{
                        padding: '8px',
                        cursor: 'pointer',
                        backgroundColor: selectedMatch === match.syskomp_neu ? '#e3f2fd' : 'transparent',
                        borderBottom: '1px solid #eee'
                      }}
                    >
                      <strong>{match.syskomp_neu}</strong> | {match.item || match.bosch || '-'} ({(match.similarity * 100).toFixed(0)}%) - {match.description.substring(0, 60)}...
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mapper-section" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button onClick={handlePrevious} disabled={currentIndex === 0}>
              ◀ Zurück
            </button>
            <button onClick={handleSkip}>
              Überspringen
            </button>
            <button
              onClick={handleSaveMapping}
              disabled={!selectedMatch}
              className="action-button"
              style={{
                backgroundColor: selectedMatch ? '#28a745' : '#ccc',
                color: 'white',
                fontWeight: 'bold'
              }}
            >
              ✓ Passt (Speichern)
            </button>
            <button onClick={handleNext} disabled={currentIndex >= catalogProducts.length - 1}>
              Weiter ▶
            </button>
          </div>

          {selectedMatch && (
            <div style={{ textAlign: 'center', marginTop: '10px', color: 'green' }}>
              Gewählt: {selectedMatch} → wird in Spalte H (ASK) gespeichert
            </div>
          )}
        </>
      )}

      {catalogProducts.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Bitte einen Katalog laden
        </div>
      )}
    </div>
  )
}

export default CatalogMapper
