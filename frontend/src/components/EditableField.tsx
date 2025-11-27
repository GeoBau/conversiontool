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
        setValidationStatus('invalid')
        setError(data.message || 'Ungültige Nummer')
      }
    } catch (err: any) {
      setError('Validierung fehlgeschlagen')
      setValidationStatus('invalid')
    } finally {
      setValidating(false)
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
    } else {
      if (validationStatus !== 'valid') {
        setError('Bitte zuerst validieren')
        return
      }
    }

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

  const handleDelete = async () => {
    if (!confirm(`Möchten Sie die ${label} "${value}" wirklich löschen?`)) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onSave('')  // Save empty string = delete
      setIsEditing(false)
      setInputValue('')
      setValidationStatus('idle')
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen')
    } finally {
      setSaving(false)
    }
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
                {linkUrl ? (
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
                onClick={handleDelete}
                disabled={saving || validating}
                className="delete-button"
                style={{
                  backgroundColor: '#ff6b6b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '4px 8px',
                  cursor: saving || validating ? 'not-allowed' : 'pointer',
                  fontSize: '0.9em',
                  marginLeft: '4px'
                }}
                title="Nummer löschen"
              >
                Löschen
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
    </div>
  )
}

export default EditableField
