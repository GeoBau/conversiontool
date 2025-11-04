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
  const [filterText, setFilterText] = useState('')
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

  // Client-side text filtering of matches
  const filteredMatches = matches.filter(match => {
    if (!filterText.trim()) return true
    const searchText = filterText.toLowerCase()
    return match.description.toLowerCase().includes(searchText)
  })

  return (
    <div className="catalog-mapper">
      <h2>Katalog Mapper</h2>

      {/* Catalog Selection - hide when products are loaded */}
      {catalogProducts.length === 0 && (
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
      )}

      {error && (
        <div style={{ color: 'red', padding: '10px', marginTop: '10px' }}>
          {error}
        </div>
      )}

      {catalogProducts.length > 0 && currentProduct && (
        <div style={{ width: '100%', padding: '0 15px', boxSizing: 'border-box' }}>
          {/* Progress */}
          <div style={{ marginBottom: '20px', fontSize: '14px', color: '#666', textAlign: 'center' }}>
            Produkt {currentIndex + 1} / {catalogProducts.length} ({catalogName})
          </div>

          {/* Filters Block - Above columns */}
          <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '4px', marginBottom: '20px', backgroundColor: '#f9f9f9' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Filter für Matches</h3>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {/* Filter Type */}
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Typ:</label>
                <div>
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
              </div>

              {/* Similarity Slider */}
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Ähnlichkeit: {minSimilarity}%
                </label>
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

              {/* Text Filter */}
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Text in Beschreibung:
                </label>
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filter nach Text..."
                  style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '3px' }}
                />
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="mapper-columns">
            {/* LEFT COLUMN: Katalog-Produkt */}
            <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '4px' }}>
              <h3 style={{ marginTop: 0 }}>Katalog-Produkt</h3>

              <div style={{ marginBottom: '15px' }}>
                <strong>Art. Nr:</strong> {currentProduct.Artikelnummer}
              </div>

              <div style={{ marginBottom: '15px' }}>
                <strong>Beschreibung:</strong><br />
                {currentProduct.Beschreibung.split(';').map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>

              {currentProduct.Bild && (
                <div style={{ marginBottom: '15px' }}>
                  <img
                    src={`/api/image/ask/${currentProduct.Artikelnummer}`}
                    alt={currentProduct.Artikelnummer}
                    style={{ maxWidth: '100%', height: 'auto', border: '1px solid #ddd' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              )}

              {currentProduct.URL && (
                <a
                  href={currentProduct.URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#007bff', textDecoration: 'none' }}
                >
                  🔗 Link zum Shop
                </a>
              )}
            </div>

            {/* RIGHT COLUMN: Buttons, Matches */}
            <div>
              {/* Action Buttons */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <button onClick={handlePrevious} disabled={currentIndex === 0} style={{ flex: 1 }}>
                    ◀ Zurück
                  </button>
                  <button onClick={handleSkip} style={{ flex: 1 }}>
                    Überspringen
                  </button>
                  <button onClick={handleNext} disabled={currentIndex >= catalogProducts.length - 1} style={{ flex: 1 }}>
                    Weiter ▶
                  </button>
                </div>
                <button
                  onClick={handleSaveMapping}
                  disabled={!selectedMatch}
                  className="action-button"
                  style={{
                    width: '100%',
                    backgroundColor: selectedMatch ? '#28a745' : '#ccc',
                    color: 'white',
                    fontWeight: 'bold',
                    padding: '10px 16px'
                  }}
                >
                  ✓ Passt (Speichern)
                </button>
              </div>

              {/* Top Matches */}
              <div>
                <h4 style={{ marginBottom: '10px' }}>Top Matches ({filteredMatches.length})</h4>
                {matchLoading ? (
                  <div>Suche Matches...</div>
                ) : (
                  <div style={{
                    border: '1px solid #ccc',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    fontSize: '13px'
                  }}>
                    {filteredMatches.length === 0 ? (
                      <div style={{ padding: '10px' }}>Keine Matches gefunden</div>
                    ) : (
                      filteredMatches.map((match, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedMatch(match.syskomp_neu)}
                          style={{
                            padding: '10px',
                            cursor: 'pointer',
                            backgroundColor: selectedMatch === match.syskomp_neu ? '#e3f2fd' : 'transparent',
                            borderBottom: '1px solid #eee'
                          }}
                        >
                          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                            {match.syskomp_neu} {match.syskomp_alt && match.syskomp_alt !== '-' ? `/ ${match.syskomp_alt}` : ''}
                            <span style={{ float: 'right', color: '#666' }}>
                              {(match.similarity * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#555' }}>
                            {match.description}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer: Selected Match Info */}
          {selectedMatch && (
            <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '4px', marginTop: '15px' }}>
              Gewählt: <strong>{selectedMatch}</strong> → wird in Spalte H (ASK) gespeichert
            </div>
          )}
        </div>
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
