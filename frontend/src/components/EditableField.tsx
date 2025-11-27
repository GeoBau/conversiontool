import { useState } from 'react'
import './ConversionTool.css'

interface EditableFieldProps {
  label: string
  value: string
  column: string  // D=Item, E=Bosch, F=Alvaris Artnr, H=ASK
  onSave: (value: string) => Promise<void>
  linkUrl?: string
  onCtrlClick?: (value: string) => void  // Ctrl+Click handler for search
}

const API_URL = import.meta.env.VITE_API_URL || '/api'

const EditableField = ({ label, value, column, onSave, linkUrl, onCtrlClick }: EditableFieldProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [validating, setValidating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState<{ number: string, exists: boolean } | null>(null)
  const [showNotFoundWarning, setShowNotFoundWarning] = useState(false)
  const [notFoundNumber, setNotFoundNumber] = useState<string | null>(null)

  const isEmpty = !value || value === '-' || value === ''

  // Check if input has correct length and format for Bosch/ASK/Syskomp
  // Supports pipe-separated multiple values (e.g., "1234567|1234568")
  const isManualTestReady = () => {
    const trimmed = inputValue.trim()
    if (!trimmed) return false

    // Split by pipe for multiple values
    const values = trimmed.split('|').map(v => v.trim()).filter(v => v)
    if (values.length === 0) return false

    // Check each value
    for (const val of values) {
      // Check if only digits
      if (!/^\d+$/.test(val)) return false

      if (column === 'E') {
        if (val.length !== 10) return false  // Bosch: 10 digits
      } else if (column === 'H') {
        if (val.length < 6 || val.length > 8) return false  // ASK: 6-8 digits
      } else if (column === 'A') {
        if (val.length !== 9 || !val.startsWith('1')) return false  // Syskomp neu: 9 digits, starts with 1
      } else if (column === 'B') {
        if (val.length !== 9 || (!val.startsWith('2') && !val.startsWith('4'))) return false  // Syskomp alt: 9 digits, starts with 2 or 4
      }
    }
    return true
  }

  const handleEdit = () => {
    setIsEditing(true)
    setInputValue(isEmpty ? '' : value)  // Vorhandene Nummer ins Eingabefeld setzen
    setError(null)
    setValidationStatus('idle')
  }

  const handleCancel = () => {
    setIsEditing(false)
    setInputValue('')
    setError(null)
    setValidationStatus('idle')
  }

  const handleManualTest = () => {
    const trimmed = inputValue.trim()

    // Open the corresponding URL
    if (column === 'E') {
      // Bosch
      window.open(`https://www.boschrexroth.com/de/de/search.html?q=${trimmed}&origin=header`, '_blank')
    } else if (column === 'H') {
      // ASK
      window.open('https://askgmbh.com/auctores/scs/imc', '_blank')
    }

    // Just open the URL, validation status doesn't need to change
    // User can save directly when format is correct
  }

  const handleValidate = async () => {
    if (!inputValue.trim()) {
      setError('Bitte geben Sie einen Wert ein')
      return
    }

    setValidating(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/validate-number`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          col: column,
          number: inputValue.trim(),
          check_url: true  // URL-Check aktiviert für Item/Alvaris
        }),
      })

      const data = await response.json()

      if (data.valid) {
        setValidationStatus('valid')
        setError(null)
      } else {
        // Check if it's a "not found" error (URL check failed) for Item/Alvaris
        const isNotFoundError = (column === 'D' || column === 'F' || column === 'G') &&
          (data.message?.includes('nicht gefunden') || data.message?.includes('0 Treffer') || data.message?.includes('not found'))

        if (isNotFoundError) {
          // Show warning dialog instead of error
          setNotFoundNumber(inputValue.trim())
          setShowNotFoundWarning(true)
          setValidationStatus('idle')  // Reset to allow user to choose
        } else {
          setValidationStatus('invalid')
          setError(data.message || 'Ungültige Nummer')
        }
      }
    } catch (err: any) {
      setError('Validierung fehlgeschlagen')
      setValidationStatus('invalid')
    } finally {
      setValidating(false)
    }
  }

  // Handle "not found" warning - user chooses to use the number anyway
  const handleNotFoundAccept = async () => {
    setShowNotFoundWarning(false)
    setNotFoundNumber(null)
    setValidationStatus('valid')  // Allow saving
    setError(null)
  }

  const handleNotFoundCancel = () => {
    setShowNotFoundWarning(false)
    setNotFoundNumber(null)
    setValidationStatus('idle')
  }

  // Check if Syskomp number already exists
  const checkSyskompExists = async (number: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: number.trim() })
      })
      const data = await response.json()
      return data.found === true
    } catch {
      return false
    }
  }

  const handleSave = async () => {
    // For Bosch/ASK/Syskomp: allow saving if format is correct (manual test ready)
    // For Item/Alvaris Artnr/Alvaris Matnr: require validation status 'valid'
    if (column === 'E' || column === 'H' || column === 'A' || column === 'B') {
      if (!isManualTestReady()) {
        if (column === 'A') {
          setError('Syskomp neu: 9 Ziffern, beginnt mit 1')
        } else if (column === 'B') {
          setError('Syskomp alt: 9 Ziffern, beginnt mit 2 oder 4')
        } else {
          setError('Bitte korrekte Anzahl Ziffern eingeben')
        }
        return
      }

      // For Syskomp columns (A and B): check if number already exists
      if (column === 'A' || column === 'B') {
        const trimmedValue = inputValue.trim()
        // Only check if value is different from current
        if (trimmedValue !== value) {
          setSaving(true)
          const exists = await checkSyskompExists(trimmedValue)
          setSaving(false)

          if (exists) {
            setDuplicateInfo({ number: trimmedValue, exists: true })
            setShowDuplicateWarning(true)
            return
          }
        }
      }
    } else {
      if (validationStatus !== 'valid') {
        setError('Bitte zuerst validieren')
        return
      }
    }

    await performSave()
  }

  const performSave = async () => {
    setSaving(true)
    setError(null)

    try {
      await onSave(inputValue.trim())
      setIsEditing(false)
      setInputValue('')
      setValidationStatus('idle')
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDuplicateCancel = () => {
    setShowDuplicateWarning(false)
    setDuplicateInfo(null)
  }

  const handleDuplicateContinue = async () => {
    setShowDuplicateWarning(false)
    setDuplicateInfo(null)
    await performSave()
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false)
    setSaving(true)
    setError(null)

    try {
      await onSave('')  // Save empty string = delete (for column A, this triggers row deletion)
      setIsEditing(false)
      setInputValue('')
      setValidationStatus('idle')
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // For Bosch/ASK/Syskomp: allow Enter if format is correct
      // For Item/Alvaris Artnr/Alvaris Matnr: require validation status 'valid'
      if ((column === 'E' || column === 'H' || column === 'A' || column === 'B') ? isManualTestReady() : validationStatus === 'valid') {
        handleSave()
      }
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  // Handle Ctrl+Click to trigger search
  const handleNumberClick = (e: React.MouseEvent) => {
    if (e.ctrlKey && onCtrlClick && value && value !== '-') {
      e.preventDefault()
      e.stopPropagation()
      onCtrlClick(value)
    }
  }

  return (
    <div className="result-row">
      <span className="result-label">{label}:</span>
      <span className="result-value">
        {!isEditing ? (
          <>
            {!isEmpty ? (
              <>
                {/* Split pipe-separated values and render each clickable */}
                {value.includes('|') ? (
                  <span>
                    {value.split('|').map((singleValue, idx) => {
                      const trimmedValue = singleValue.trim()
                      if (!trimmedValue) return null
                      return (
                        <span key={idx}>
                          {idx > 0 && <span style={{ color: '#999', margin: '0 4px' }}>|</span>}
                          {linkUrl ? (
                            <a
                              href={linkUrl.replace(encodeURIComponent(value), encodeURIComponent(trimmedValue))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="number-link"
                              onClick={(e) => {
                                if (e.ctrlKey && onCtrlClick) {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  onCtrlClick(trimmedValue)
                                }
                              }}
                              title={onCtrlClick ? 'Ctrl+Klick zum Suchen' : undefined}
                            >
                              {trimmedValue}
                            </a>
                          ) : (
                            <span
                              onClick={(e) => {
                                if (e.ctrlKey && onCtrlClick) {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  onCtrlClick(trimmedValue)
                                }
                              }}
                              style={{ cursor: onCtrlClick ? 'pointer' : undefined }}
                              title={onCtrlClick ? 'Ctrl+Klick zum Suchen' : undefined}
                            >
                              {trimmedValue}
                            </span>
                          )}
                        </span>
                      )
                    })}
                  </span>
                ) : linkUrl ? (
                  <a
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="number-link"
                    onClick={handleNumberClick}
                    style={{ cursor: onCtrlClick ? 'pointer' : undefined }}
                    title={onCtrlClick ? 'Ctrl+Klick zum Suchen' : undefined}
                  >
                    {value}
                  </a>
                ) : (
                  <span
                    onClick={handleNumberClick}
                    style={{ cursor: onCtrlClick ? 'pointer' : undefined }}
                    title={onCtrlClick ? 'Ctrl+Klick zum Suchen' : undefined}
                  >
                    {value}
                  </span>
                )}
                <button
                  onClick={handleEdit}
                  className="add-button"
                  title="Nummer ändern"
                >
                  Ändern
                </button>
              </>
            ) : (
              <button
                onClick={handleEdit}
                className="add-button"
                title="Nummer hinzufügen"
              >
                + Hinzufügen
              </button>
            )}
          </>
        ) : (
          <div className="editable-field">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={`${label} eingeben`}
              className="edit-input"
              autoFocus
              disabled={validating || saving}
            />
            {/* For Bosch, ASK and Syskomp: Manual Test button / Format check only */}
            {(column === 'E' || column === 'H') ? (
              <button
                onClick={handleManualTest}
                disabled={!isManualTestReady()}
                className="validate-button"
                title={column === 'E' ? 'Manuell auf Bosch-Website testen' : 'Manuell auf ASK-Website testen'}
              >
                {validationStatus === 'valid' ? '✓' : 'Man.Test'}
              </button>
            ) : (column === 'A' || column === 'B') ? (
              <span className="validate-button" style={{
                backgroundColor: isManualTestReady() ? '#28a745' : '#6c757d',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '3px',
                fontSize: '0.85em'
              }}>
                {isManualTestReady() ? '✓ OK' : 'Format'}
              </span>
            ) : (
              <button
                onClick={handleValidate}
                disabled={validating || saving || !inputValue.trim()}
                className="validate-button"
              >
                {validating ? '...' : validationStatus === 'valid' ? '✓' : 'Prüfen'}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={
                saving ||
                ((column === 'E' || column === 'H' || column === 'A' || column === 'B')
                  ? !isManualTestReady()  // Bosch/ASK/Syskomp: nur Format-Check
                  : validationStatus !== 'valid'  // Item/Alvaris: Validierung erforderlich
                )
              }
              className="save-button"
            >
              {saving ? 'Speichere...' : 'Speichern'}
            </button>
            {!isEmpty && (
              <button
                onClick={handleDeleteClick}
                disabled={saving || validating}
                className="delete-button"
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '4px 8px',
                  cursor: saving || validating ? 'not-allowed' : 'pointer',
                  fontSize: '0.9em',
                  marginLeft: '4px'
                }}
                title={column === 'A' ? 'Ganze Zeile löschen' : 'Nummer löschen'}
              >
                {column === 'A' ? 'Zeile löschen' : 'Löschen'}
              </button>
            )}
            <button
              onClick={handleCancel}
              disabled={validating || saving}
              className="cancel-button"
            >
              ✕
            </button>
            {error && (
              <div className="validation-error">{error}</div>
            )}
            {/* Success message only for Item/Alvaris after validation */}
            {validationStatus === 'valid' && !error && column !== 'E' && column !== 'H' && (
              <div className="validation-success">✓ Gültig</div>
            )}
            {/* Show length requirement for Bosch/ASK/Syskomp */}
            {(column === 'E' || column === 'H' || column === 'A' || column === 'B') && inputValue && !error && (
              <div className="validation-hint" style={{ fontSize: '0.85em', color: '#666', marginTop: '4px' }}>
                {column === 'E'
                  ? `Bosch: 10 Ziffern (mehrere mit | trennen)`
                  : column === 'H'
                  ? `ASK: 6-8 Ziffern (mehrere mit | trennen)`
                  : column === 'A'
                  ? `Syskomp neu: 9 Ziffern, beginnt mit 1`
                  : `Syskomp alt: 9 Ziffern, beginnt mit 2 oder 4`}
                {inputValue.includes('|') && ` - ${inputValue.split('|').filter(v => v.trim()).length} Werte`}
              </div>
            )}
          </div>
        )}
      </span>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: column === 'A' ? '#dc3545' : 'white',
            color: column === 'A' ? 'white' : 'black',
            padding: '20px 30px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.1em', marginBottom: '20px' }}>
              {column === 'A'
                ? `Möchten Sie die gesamte Zeile für "${value}" wirklich löschen?`
                : `Möchten Sie die ${label} "${value}" wirklich löschen?`
              }
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={handleDeleteConfirm}
                style={{
                  padding: '8px 20px',
                  backgroundColor: column === 'A' ? 'white' : '#dc3545',
                  color: column === 'A' ? '#dc3545' : 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Ja, löschen
              </button>
              <button
                onClick={handleDeleteCancel}
                style={{
                  padding: '8px 20px',
                  backgroundColor: column === 'A' ? 'rgba(255,255,255,0.2)' : '#6c757d',
                  color: 'white',
                  border: column === 'A' ? '1px solid white' : 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Error Modal */}
      {showDuplicateWarning && duplicateInfo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#dc3545',
            color: 'white',
            padding: '20px 30px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            maxWidth: '450px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5em', marginBottom: '10px' }}>❌ Fehler</div>
            <div style={{ fontSize: '1.1em', marginBottom: '20px' }}>
              Die {column === 'A' ? 'Syskomp neu' : 'Syskomp alt'} Nummer <strong>"{duplicateInfo.number}"</strong> existiert bereits!
            </div>
            <div style={{ fontSize: '0.95em', marginBottom: '20px', opacity: 0.9 }}>
              Syskomp-Nummern müssen eindeutig sein.
            </div>
            <button
              onClick={handleDuplicateCancel}
              style={{
                padding: '10px 30px',
                backgroundColor: 'white',
                color: '#dc3545',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Not Found Warning Modal for Item/Alvaris */}
      {showNotFoundWarning && notFoundNumber && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#ffc107',
            color: '#000',
            padding: '20px 30px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            maxWidth: '450px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5em', marginBottom: '10px' }}>⚠️ Hinweis</div>
            <div style={{ fontSize: '1.1em', marginBottom: '20px' }}>
              Artikel <strong>"{notFoundNumber}"</strong> existiert im Online-Shop nicht.
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={handleNotFoundAccept}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Übernehmen
              </button>
              <button
                onClick={handleNotFoundCancel}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#6c757d',
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
        </div>
      )}
    </div>
  )
}

export default EditableField
