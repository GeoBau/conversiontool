import { useState, useEffect } from 'react'
import './ConversionTool.css'

interface Catalog {
  path: string
  name: string
  type: string
}

interface ExistingMapping {
  syskomp_neu: string
  syskomp_alt: string
  other_catalog_nrs: {
    item: string
    bosch: string
    alvaris_artnr: string
    alvaris_matnr: string
    ask: string
  }
}

interface CatalogProduct {
  Artikelnummer: string
  Beschreibung: string
  Bild?: string
  URL?: string
  already_mapped?: boolean
  mapped_syskomp_neu?: string
  mapped_syskomp_alt?: string
  existing_mappings?: ExistingMapping[]  // All existing mappings for this article
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
  const [filterType] = useState<'all' | 'item' | 'bosch'>('all')
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

  // Manual entry state
  const [manualSyskompNeu, setManualSyskompNeu] = useState<string>('')
  const [manualSyskompAlt, setManualSyskompAlt] = useState<string>('')
  const [validationMessage, setValidationMessage] = useState<string>('')
  const [isNewEntry, setIsNewEntry] = useState(false) // true = "Neuaufnahme", false = "Passt"
  const [isManualEntryValid, setIsManualEntryValid] = useState(false) // true if manual entry is valid (either existing or new)

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

  // Validate manual entries when neue Nummer has 9 digits (alt is optional)
  useEffect(() => {
    if (manualSyskompNeu.length === 9) {
      // Validate with alt if provided, or empty string if not
      validateAndCheckNumbers(manualSyskompNeu, manualSyskompAlt)
    } else if (manualSyskompNeu || manualSyskompAlt) {
      setValidationMessage('')
      setIsNewEntry(false)
      setIsManualEntryValid(false)
    }
  }, [manualSyskompNeu, manualSyskompAlt])

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

  const validateAndCheckNumbers = async (neu: string, alt: string) => {
    // Validate format for neue Nummer (required)
    if (neu.length !== 9 || !neu.startsWith('1') || !/^\d+$/.test(neu)) {
      setValidationMessage('Syskomp neu: 9 Ziffern, beginnt mit 1')
      setIsNewEntry(false)
      setIsManualEntryValid(false)
      return
    }

    // Validate format for alte Nummer (optional, but if provided must be correct)
    if (alt && (alt.length !== 9 || (!alt.startsWith('2') && !alt.startsWith('4')) || !/^\d+$/.test(alt))) {
      setValidationMessage('Syskomp alt: 9 Ziffern, beginnt mit 2 oder 4')
      setIsNewEntry(false)
      setIsManualEntryValid(false)
      return
    }

    // Check if numbers exist via /api/search
    try {
      const neuResponse = await fetch(`${API_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: neu })
      })

      const neuData = await neuResponse.json()
      const neuExists = neuData.found

      // Check if neue Nummer exists
      if (neuExists) {
        setValidationMessage('✓ Artikelnummer ist vorhanden')
        setIsNewEntry(false)
        setIsManualEntryValid(true) // Valid: existing number found
        return
      }

      // If neue Nummer doesn't exist, check if alte Nummer exists (only if provided)
      if (alt && alt.length === 9) {
        const altResponse = await fetch(`${API_URL}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: alt })
        })

        const altData = await altResponse.json()
        const altExists = altData.found

        if (altExists) {
          setValidationMessage('✗ Fehler: neue Artnr neu / alte ist vorhanden')
          setIsNewEntry(false)
          setIsManualEntryValid(false) // Invalid: error state
          return
        }
      }

      // Both don't exist (or alt not provided) → Neuaufnahme
      setValidationMessage('→ Neue Artikelnummer (Neuaufnahme)')
      setIsNewEntry(true)
      setIsManualEntryValid(true) // Valid: new entry
    } catch (err) {
      console.error('Validation error:', err)
      setValidationMessage('Fehler bei der Prüfung')
      setIsNewEntry(false)
      setIsManualEntryValid(false)
    }
  }

  const handleSaveMapping = async () => {
    if (!selectedMatch && !isManualEntryValid) {
      setError('Bitte eine Syskomp-Nummer auswählen')
      return
    }

    // Just mark as ready to save, don't save yet
    setJustSaved(true)
    setError(null)
  }

  const actuallyPerformSave = async () => {
    const currentProduct = catalogProducts[currentIndex]
    if (!currentProduct) return

    // Determine column based on catalog type
    const catalogInfo = catalogs.find(c => c.path === selectedCatalog)
    const catalogType = catalogInfo?.type?.toLowerCase() || 'ask'

    try {
      if (isNewEntry) {
        // Create new entry
        const response = await fetch(`${API_URL}/create-entry`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            syskomp_neu: manualSyskompNeu,
            syskomp_alt: manualSyskompAlt,
            catalog_artnr: currentProduct.Artikelnummer,
            description: currentProduct.Beschreibung,
            catalog_type: catalogType
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Fehler beim Erstellen')
        }

        // Mark product as already mapped in the local state and update Syskomp numbers
        const updatedProducts = [...catalogProducts]
        updatedProducts[currentIndex] = {
          ...updatedProducts[currentIndex],
          already_mapped: true,
          mapped_syskomp_neu: manualSyskompNeu,
          mapped_syskomp_alt: manualSyskompAlt || ''
        }
        setCatalogProducts(updatedProducts)

        // Save for undo
        setLastSavedMapping({
          index: currentIndex,
          artikelnummer: currentProduct.Artikelnummer,
          syskompNummer: manualSyskompNeu
        })
        setCanUndo(true)
        setError(null)
      } else {
        // Update existing entry (either from selectedMatch or manual entry)
        const syskompNummer = selectedMatch || manualSyskompNeu
        if (!syskompNummer) return

        let col = 'H' // Default to ASK
        if (catalogType === 'alvaris') col = 'F' // Alvaris Artnr
        else if (catalogType === 'bosch') col = 'E'
        else if (catalogType === 'item') col = 'D'

        const response = await fetch(`${API_URL}/update-entry`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            syskomp_neu: syskompNummer,
            col: col,
            value: currentProduct.Artikelnummer,
            append: true  // Append with | if value already exists
          }),
        })

        const responseData = await response.json()

        if (!response.ok) {
          throw new Error(responseData.error || 'Fehler beim Speichern')
        }

        // Get the updated catalog numbers from response (value contains the full pipe-separated list)
        const updatedCatalogNrs = responseData.value || currentProduct.Artikelnummer

        // Mark product as already mapped in the local state and update Syskomp numbers
        const updatedProducts = [...catalogProducts]

        // Get the Syskomp alt number from the match or manual entry
        let syskompAlt = ''
        if (selectedMatch) {
          // If selected from match list, find the corresponding alt number
          const match = matches.find(m => m.syskomp_neu === selectedMatch)
          syskompAlt = match?.syskomp_alt || ''
        } else {
          // If manual entry
          syskompAlt = manualSyskompAlt || ''
        }

        // Create new mapping entry
        const newMapping = {
          syskomp_neu: syskompNummer,
          syskomp_alt: syskompAlt,
          other_catalog_nrs: {
            item: '',
            bosch: '',
            alvaris_artnr: catalogType === 'alvaris' ? updatedCatalogNrs : '',
            alvaris_matnr: '',
            ask: catalogType === 'ask' ? updatedCatalogNrs : ''
          }
        }

        // Update current product - add to existing mappings or create new
        const currentMappings = updatedProducts[currentIndex].existing_mappings || []
        const existingMappingIdx = currentMappings.findIndex(m => m.syskomp_neu === syskompNummer)

        let newMappings
        if (existingMappingIdx >= 0) {
          // Update existing mapping with new catalog numbers
          newMappings = [...currentMappings]
          newMappings[existingMappingIdx] = newMapping
        } else {
          // Add new mapping
          newMappings = [...currentMappings, newMapping]
        }

        updatedProducts[currentIndex] = {
          ...updatedProducts[currentIndex],
          already_mapped: true,
          mapped_syskomp_neu: syskompNummer,
          mapped_syskomp_alt: syskompAlt,
          existing_mappings: newMappings
        }

        // Also update all other products that have this Syskomp number in their mappings
        for (let i = 0; i < updatedProducts.length; i++) {
          if (i !== currentIndex) {
            const productMappings = updatedProducts[i].existing_mappings || []
            const mappingIdx = productMappings.findIndex(m => m.syskomp_neu === syskompNummer)

            if (mappingIdx >= 0) {
              // Update the catalog numbers for this Syskomp
              const updatedMappings = [...productMappings]
              updatedMappings[mappingIdx] = newMapping
              updatedProducts[i] = {
                ...updatedProducts[i],
                existing_mappings: updatedMappings
              }
            }
          }
        }

        setCatalogProducts(updatedProducts)

        // Save for undo
        setLastSavedMapping({
          index: currentIndex,
          artikelnummer: currentProduct.Artikelnummer,
          syskompNummer: syskompNummer
        })
        setCanUndo(true)
        setError(null)
      }
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
      throw err
    }
  }

  const handleNext = async () => {
    // If "Passt" was clicked, save before navigating
    if (justSaved && (selectedMatch || isManualEntryValid)) {
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
      // Clear manual inputs and reset validation when navigating
      setManualSyskompNeu('')
      setManualSyskompAlt('')
      setValidationMessage('')
      setIsNewEntry(false)
      setIsManualEntryValid(false)
      findMatches(catalogProducts[nextIndex].Beschreibung)
    }
  }

  const handlePrevious = async () => {
    // If "Passt" was clicked, save before navigating
    if (justSaved && (selectedMatch || isManualEntryValid)) {
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
      // Clear manual inputs and reset validation when navigating
      setManualSyskompNeu('')
      setManualSyskompAlt('')
      setValidationMessage('')
      setIsNewEntry(false)
      setIsManualEntryValid(false)
      findMatches(catalogProducts[prevIndex].Beschreibung)
    }
  }

  const handleUndo = async () => {
    // Scenario 1: User clicked "Passt" but hasn't navigated yet (not saved to backend)
    if (justSaved && !canUndo) {
      // Just clear the selection and reset states
      setSelectedMatch('')
      setManualSyskompNeu('')
      setManualSyskompAlt('')
      setValidationMessage('')
      setIsNewEntry(false)
      setIsManualEntryValid(false)
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
      setManualSyskompNeu('')
      setManualSyskompAlt('')
      setValidationMessage('')
      setIsNewEntry(false)
      setIsManualEntryValid(false)
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
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: '1 1 200px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '10px', whiteSpace: 'nowrap' }}>
                  Filtern bei Syskomp Beschreibung:
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
                {currentProduct.already_mapped && currentProduct.existing_mappings && currentProduct.existing_mappings.length > 0 && (
                  <div style={{ marginTop: '4px', fontSize: '10px', color: '#c62828' }}>
                    <div>(bereits zugeordnet)</div>
                    {/* Show ALL existing mappings with their catalog numbers */}
                    {currentProduct.existing_mappings.map((mapping, idx) => (
                      <div key={idx} style={{ marginTop: idx > 0 ? '6px' : '2px', paddingTop: idx > 0 ? '4px' : '0', borderTop: idx > 0 ? '1px dashed #ffcdd2' : 'none' }}>
                        <div>
                          <strong>Syskomp neu:</strong> {mapping.syskomp_neu}
                          {mapping.syskomp_alt && mapping.syskomp_alt !== '-' && (
                            <span> / <strong>alt:</strong> {mapping.syskomp_alt}</span>
                          )}
                        </div>
                        {/* Show catalog numbers for this mapping */}
                        {mapping.other_catalog_nrs && (
                          <div style={{ marginTop: '2px', color: '#666', fontSize: '9px' }}>
                            {catalogType === 'ask' && mapping.other_catalog_nrs.ask && mapping.other_catalog_nrs.ask !== '-' && (
                              <div>ASK: {mapping.other_catalog_nrs.ask.split('|').map((nr, i, arr) => (
                                <span key={i} style={{ backgroundColor: nr.trim() === currentProduct.Artikelnummer ? '#ffeb3b' : 'transparent', padding: '0 2px' }}>
                                  {nr.trim()}{i < arr.length - 1 ? ' | ' : ''}
                                </span>
                              ))}</div>
                            )}
                            {catalogType === 'alvaris' && mapping.other_catalog_nrs.alvaris_artnr && mapping.other_catalog_nrs.alvaris_artnr !== '-' && (
                              <div>Alvaris: {mapping.other_catalog_nrs.alvaris_artnr.split('|').map((nr, i, arr) => (
                                <span key={i} style={{ backgroundColor: nr.trim() === currentProduct.Artikelnummer ? '#ffeb3b' : 'transparent', padding: '0 2px' }}>
                                  {nr.trim()}{i < arr.length - 1 ? ' | ' : ''}
                                </span>
                              ))}</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', fontSize: '11px', marginBottom: '4px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '2px' }}>Syskomp neu:</label>
                    <input
                      type="text"
                      value={manualSyskompNeu || selectedMatch}
                      onChange={(e) => setManualSyskompNeu(e.target.value)}
                      maxLength={9}
                      style={{
                        width: '100px',
                        padding: '4px 6px',
                        border: '1px solid #ccc',
                        borderRadius: '3px',
                        backgroundColor: 'white',
                        fontSize: '11px'
                      }}
                      placeholder="1xxxxxxxx"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '2px' }}>Syskomp alt:</label>
                    <input
                      type="text"
                      value={manualSyskompAlt || matches.find(m => m.syskomp_neu === selectedMatch)?.syskomp_alt || ''}
                      onChange={(e) => setManualSyskompAlt(e.target.value)}
                      maxLength={9}
                      style={{
                        width: '100px',
                        padding: '4px 6px',
                        border: '1px solid #ccc',
                        borderRadius: '3px',
                        backgroundColor: 'white',
                        fontSize: '11px'
                      }}
                      placeholder="2/4xxxxxxx"
                    />
                  </div>
                </div>
                {validationMessage && (
                  <div style={{ fontSize: '10px', color: validationMessage.includes('vorhanden') ? 'green' : 'red', marginTop: '2px' }}>
                    {validationMessage}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={handleSaveMapping}
                    disabled={(!selectedMatch && !isManualEntryValid) || justSaved}
                    className="action-button"
                    style={{
                      flex: 2,
                      backgroundColor: ((selectedMatch || isManualEntryValid) && !justSaved) ? '#28a745' : justSaved ? '#2196f3' : '#ccc',
                      color: 'white',
                      fontWeight: 'bold',
                      padding: '6px 10px',
                      fontSize: '11px',
                      cursor: ((selectedMatch || isManualEntryValid) && !justSaved) ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {isNewEntry ? '✓ Neuaufnahme' : (justSaved ? 'Passt bestätigt' : 'Passt ?')}
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
                            // When a new match is clicked, reset states and clear manual inputs
                            setJustSaved(false)
                            setCanUndo(false)
                            setManualSyskompNeu('')
                            setManualSyskompAlt('')
                            setValidationMessage('')
                            setIsNewEntry(false)
                            setIsManualEntryValid(false)
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
