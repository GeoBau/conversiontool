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
  already_mapped?: boolean
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
  const [gotoInput, setGotoInput] = useState('')

  // Undo state
  const [lastSavedMapping, setLastSavedMapping] = useState<{
    index: number
    artikelnummer: string
    syskompNummer: string
  } | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [justSaved, setJustSaved] = useState(false) // Track if we just saved

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

    // Just mark as ready to save, don't save yet
    setJustSaved(true)
    setError(null)
  }

  const actuallyPerformSave = async () => {
    if (!selectedMatch) return

    const currentProduct = catalogProducts[currentIndex]
    if (!currentProduct) return

    // Determine column based on catalog type
    const catalogInfo = catalogs.find(c => c.path === selectedCatalog)
    const catalogType = catalogInfo?.type?.toLowerCase() || 'ask'

    let col = 'H' // Default to ASK
    if (catalogType === 'alvaris') col = 'F' // Alvaris Artnr
    else if (catalogType === 'bosch') col = 'E'
    else if (catalogType === 'item') col = 'D'

    try {
      const response = await fetch(`${API_URL}/update-entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          syskomp_neu: selectedMatch,
          col: col,
          value: currentProduct.Artikelnummer
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Fehler beim Speichern')
      }

      // Mark product as already mapped in the local state
      const updatedProducts = [...catalogProducts]
      updatedProducts[currentIndex] = {
        ...updatedProducts[currentIndex],
        already_mapped: true
      }
      setCatalogProducts(updatedProducts)

      // Save for undo
      setLastSavedMapping({
        index: currentIndex,
        artikelnummer: currentProduct.Artikelnummer,
        syskompNummer: selectedMatch
      })
      setCanUndo(true)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
      throw err
    }
  }

  const handleNext = async () => {
    // If "Passt" was clicked, save before navigating
    if (justSaved && selectedMatch) {
      try {
        await actuallyPerformSave()
        // After saving successfully, keep canUndo active
        setCanUndo(true)
      } catch (err) {
        // Don't navigate if save failed
        return
      }
    }

    // Reset justSaved but keep canUndo if we just saved
    setJustSaved(false)

    if (currentIndex < catalogProducts.length - 1) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      setSelectedMatch('')
      findMatches(catalogProducts[nextIndex].Beschreibung)
    }
  }

  const handlePrevious = async () => {
    // If "Passt" was clicked, save before navigating
    if (justSaved && selectedMatch) {
      try {
        await actuallyPerformSave()
        // After saving successfully, keep canUndo active
        setCanUndo(true)
      } catch (err) {
        // Don't navigate if save failed
        return
      }
    }

    // Reset justSaved but keep canUndo if we just saved
    setJustSaved(false)

    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1
      setCurrentIndex(prevIndex)
      setSelectedMatch('')
      findMatches(catalogProducts[prevIndex].Beschreibung)
    }
  }

  const handleUndo = async () => {
    // Scenario 1: User clicked "Passt" but hasn't navigated yet (not saved to backend)
    if (justSaved && !canUndo) {
      // Just clear the selection and reset states
      setSelectedMatch('')
      setJustSaved(false)
      setError(null)
      return
    }

    // Scenario 2: Already saved to backend, need to call undo API
    if (!lastSavedMapping || !canUndo) return

    try {
      // Call undo endpoint
      const response = await fetch(`${API_URL}/undo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      })

      if (!response.ok) {
        throw new Error('Fehler beim Rückgängig machen')
      }

      // Go back to the saved mapping index
      setCurrentIndex(lastSavedMapping.index)
      setSelectedMatch('')
      findMatches(catalogProducts[lastSavedMapping.index].Beschreibung)

      // Disable undo after using it and reset saved state
      setCanUndo(false)
      setJustSaved(false)
      setLastSavedMapping(null)
    } catch (err: any) {
      setError(err.message || 'Fehler beim Rückgängig machen')
    }
  }

  const handleGoto = () => {
    // Disable undo when navigating
    setCanUndo(false)
    setJustSaved(false)

    const targetNumber = parseInt(gotoInput)
    if (!isNaN(targetNumber) && targetNumber >= 1 && targetNumber <= catalogProducts.length) {
      const targetIndex = targetNumber - 1
      setCurrentIndex(targetIndex)
      setSelectedMatch('')
      findMatches(catalogProducts[targetIndex].Beschreibung)
      setGotoInput('')
    }
  }

  const currentProduct = catalogProducts[currentIndex]
  const catalogInfo = catalogs.find(c => c.path === selectedCatalog)
  const catalogName = catalogInfo?.name || ''
  const catalogType = catalogInfo?.type?.toLowerCase() || 'ask'

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
          <div style={{ marginBottom: '8px', fontSize: '14px', color: '#666', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
            <span>Produkt {currentIndex + 1} / {catalogProducts.length} ({catalogName})</span>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input
                type="number"
                value={gotoInput}
                onChange={(e) => setGotoInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleGoto()}
                placeholder="#"
                min="1"
                max={catalogProducts.length}
                style={{ width: '50px', padding: '2px 4px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '2px' }}
              />
              <button
                onClick={handleGoto}
                disabled={!gotoInput}
                style={{ padding: '2px 8px', fontSize: '10px', border: '1px solid #409f95', backgroundColor: '#409f95', color: 'white', borderRadius: '2px', cursor: 'pointer' }}
              >
                Goto
              </button>
            </div>
          </div>

          {/* Filters Block - Above columns */}
          <div style={{ border: '1px solid #ccc', padding: '6px 8px', borderRadius: '3px', marginBottom: '8px', backgroundColor: '#f9f9f9' }}>
            <h3 style={{ marginTop: 0, marginBottom: '6px', fontSize: '11px' }}>Filter für Matches</h3>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Filter Type */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label style={{ fontWeight: 'bold', fontSize: '10px' }}>Typ:</label>
                <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '2px' }}>
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
                <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '2px' }}>
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
                <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '2px' }}>
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

              {/* Similarity Slider */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: '1 1 150px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '10px', whiteSpace: 'nowrap' }}>
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
                  style={{ flex: 1, minWidth: '80px' }}
                />
              </div>

              {/* Text Filter */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: '1 1 150px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '10px', whiteSpace: 'nowrap' }}>
                  Text:
                </label>
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filter..."
                  style={{ flex: 1, padding: '3px 5px', border: '1px solid #ccc', borderRadius: '2px', fontSize: '10px' }}
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
                <strong>Art. Nr:</strong> <span style={{ color: currentProduct.already_mapped ? '#c62828' : 'inherit', fontWeight: currentProduct.already_mapped ? 'bold' : 'normal' }}>{currentProduct.Artikelnummer}</span>
                {currentProduct.already_mapped && <span style={{ marginLeft: '8px', fontSize: '10px', color: '#c62828' }}>(bereits zugeordnet)</span>}
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
                    src={`${API_URL}/image/${catalogType}/${currentProduct.Artikelnummer}`}
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

            {/* RIGHT COLUMN: Input Fields, Buttons, Matches */}
            <div>
              {/* Syskomp Input Fields */}
              <div style={{ marginBottom: '8px', display: 'flex', gap: '8px', fontSize: '11px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '2px' }}>Syskomp neu:</label>
                  <input
                    type="text"
                    value={selectedMatch}
                    readOnly
                    maxLength={10}
                    style={{
                      width: '100px',
                      padding: '4px 6px',
                      border: '1px solid #ccc',
                      borderRadius: '3px',
                      backgroundColor: '#f5f5f5',
                      fontSize: '11px'
                    }}
                    placeholder="-"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '2px' }}>Syskomp alt:</label>
                  <input
                    type="text"
                    value={matches.find(m => m.syskomp_neu === selectedMatch)?.syskomp_alt || ''}
                    readOnly
                    maxLength={10}
                    style={{
                      width: '100px',
                      padding: '4px 6px',
                      border: '1px solid #ccc',
                      borderRadius: '3px',
                      backgroundColor: '#f5f5f5',
                      fontSize: '11px'
                    }}
                    placeholder="-"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={handleSaveMapping}
                    disabled={!selectedMatch || justSaved}
                    className="action-button"
                    style={{
                      flex: 2,
                      backgroundColor: (selectedMatch && !justSaved) ? '#28a745' : '#ccc',
                      color: 'white',
                      fontWeight: 'bold',
                      padding: '6px 10px',
                      fontSize: '11px',
                      cursor: (selectedMatch && !justSaved) ? 'pointer' : 'not-allowed'
                    }}
                  >
                    ✓ Passt
                  </button>
                  <button onClick={handlePrevious} disabled={currentIndex === 0} style={{ flex: 1, padding: '4px 6px', fontSize: '10px' }}>
                    ◀ Zurück
                  </button>
                  <button onClick={handleNext} disabled={currentIndex >= catalogProducts.length - 1} style={{ flex: 1, padding: '4px 6px', fontSize: '10px' }}>
                    Weiter ▶
                  </button>
                  <button
                    onClick={handleUndo}
                    disabled={!canUndo && !justSaved}
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      fontSize: '10px',
                      backgroundColor: (canUndo || justSaved) ? '#ff9800' : '#e0e0e0',
                      color: (canUndo || justSaved) ? 'white' : '#999',
                      border: '1px solid #ccc',
                      cursor: (canUndo || justSaved) ? 'pointer' : 'not-allowed',
                      borderRadius: '3px'
                    }}
                  >
                    ↶ Undo
                  </button>
                </div>
              </div>

              {/* Top Matches */}
              <div>
                <h4 style={{ marginBottom: '6px', fontSize: '12px' }}>Top Matches ({filteredMatches.length})</h4>
                {matchLoading ? (
                  <div style={{ fontSize: '10px', padding: '4px' }}>Suche Matches...</div>
                ) : (
                  <div style={{
                    border: '1px solid #ccc',
                    maxHeight: '500px',
                    overflowY: 'auto',
                    fontSize: '10px'
                  }}>
                    {filteredMatches.length === 0 ? (
                      <div style={{ padding: '6px', fontSize: '10px' }}>Keine Matches gefunden</div>
                    ) : (
                      filteredMatches.map((match, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedMatch(match.syskomp_neu)
                            // When a new match is clicked, reset states
                            setJustSaved(false)
                            setCanUndo(false)
                          }}
                          style={{
                            padding: '4px 6px',
                            cursor: 'pointer',
                            backgroundColor: selectedMatch === match.syskomp_neu ? '#e3f2fd' : 'transparent',
                            borderBottom: '1px solid #eee',
                            fontSize: '10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 'bold' }}>
                              {match.syskomp_neu} {match.syskomp_alt && match.syskomp_alt !== '-' ? `/ ${match.syskomp_alt}` : ''}
                            </span>
                            <span style={{ color: '#555' }}>
                              {' - ' + match.description.split(';').filter(line => line.trim()).map(line => line.trim()).join(' - ')}
                            </span>
                          </div>
                          <span style={{ color: '#666', marginLeft: '8px', whiteSpace: 'nowrap' }}>
                            {(match.similarity * 100).toFixed(0)}%
                          </span>
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
