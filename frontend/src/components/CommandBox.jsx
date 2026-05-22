import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { sendCommand } from '../api/endpoints'

const SIDEBAR_WIDTH = '16rem'
const BAR_HEIGHT_PX = 72

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function makeTransactionId() {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `TXN-${ts}-${rand}`
}

const ENTITY_CHIP_STYLES = {
  zone: 'border-sky-500/50 bg-sky-500/20 text-sky-200',
  resource_type: 'border-orange-500/50 bg-orange-500/20 text-orange-200',
  severity: 'border-red-500/50 bg-red-500/20 text-red-200',
  incident_type: 'border-purple-500/50 bg-purple-500/20 text-purple-200',
}

const ENTITY_LABELS = {
  zone: 'Zone',
  resource_type: 'Resource',
  severity: 'Severity',
  incident_type: 'Incident',
}

function EntityChips({ entities }) {
  if (!entities || typeof entities !== 'object') return null

  const entries = Object.entries(entities).filter(
    ([, value]) => value != null && String(value).trim() !== '',
  )

  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">No entities extracted.</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
            ENTITY_CHIP_STYLES[key] ?? 'border-slate-500/50 bg-slate-700/50 text-slate-200'
          }`}
        >
          <span className="text-[10px] uppercase opacity-70">
            {ENTITY_LABELS[key] ?? key}
          </span>
          <span>{String(value).replace(/_/g, ' ')}</span>
        </span>
      ))}
    </div>
  )
}

export default function CommandBox() {
  const [mounted, setMounted] = useState(false)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [response, setResponse] = useState(null)
  const [transactionId, setTransactionId] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceConfidence, setVoiceConfidence] = useState(null)
  const [speechSupported] = useState(() => !!getSpeechRecognition())
  const [speechError, setSpeechError] = useState(null)

  const recognitionRef = useRef(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const submitCommand = useCallback(async (commandText) => {
    const trimmed = commandText.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    setResponse(null)
    setTransactionId(makeTransactionId())

    try {
      const result = await sendCommand(trimmed)
      setResponse(result)
      setPanelOpen(true)
    } catch (err) {
      setError(err.message || 'Command failed')
      setPanelOpen(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    submitCommand(text)
  }

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop()
    } catch {
      /* ignore */
    }
    setListening(false)
  }, [])

  const startListening = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognition()
    if (!SpeechRecognitionCtor) {
      setSpeechError('Speech recognition is not supported in this browser.')
      return
    }

    setSpeechError(null)
    setVoiceConfidence(null)

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onstart = () => setListening(true)

    recognition.onresult = (event) => {
      const result = event.results[0]?.[0]
      if (!result) return

      const transcript = result.transcript.trim()
      if (result.confidence != null && !Number.isNaN(result.confidence)) {
        setVoiceConfidence(result.confidence)
      }
      setText(transcript)
      submitCommand(transcript)
    }

    recognition.onerror = (event) => {
      setListening(false)
      if (event.error !== 'aborted') {
        setSpeechError(
          event.error === 'not-allowed'
            ? 'Microphone access denied.'
            : `Speech recognition error: ${event.error}`,
        )
      }
    }

    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    recognition.start()
  }, [submitCommand])

  const toggleVoice = () => {
    if (listening) stopListening()
    else startListening()
  }

  const closePanel = () => {
    setPanelOpen(false)
    setError(null)
  }

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort()
      } catch {
        /* ignore */
      }
    }
  }, [])

  if (!mounted) return null

  const panelBottom = listening ? BAR_HEIGHT_PX + 36 : BAR_HEIGHT_PX

  return createPortal(
    <>
      {/* Response panel — above command bar */}
      {panelOpen && (
        <div
          className="command-panel"
          style={{
            position: 'fixed',
            left: SIDEBAR_WIDTH,
            right: 0,
            bottom: panelBottom,
            zIndex: 10001,
            maxHeight: 'min(50vh, 420px)',
            margin: '0 1rem',
            borderRadius: '0.75rem 0.75rem 0 0',
            border: '1px solid #475569',
            borderBottom: 'none',
            backgroundColor: '#1e293b',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.45)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          role="dialog"
          aria-label="Command response"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              borderBottom: '1px solid #334155',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#fb923c' }}>
              Command Response
            </h3>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close panel"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '1.25rem',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '0.25rem 0.5rem',
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ overflowY: 'auto', padding: '1rem', fontSize: '0.875rem' }}>
            {transactionId && (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.7rem', color: '#64748b' }}>
                Transaction ID:{' '}
                <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>
                  {transactionId}
                </span>
              </p>
            )}

            {error && (
              <p style={{ margin: 0, color: '#fca5a5' }}>{error}</p>
            )}

            {response && !error && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <p
                    style={{
                      margin: '0 0 0.35rem',
                      fontSize: '0.65rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#64748b',
                    }}
                  >
                    Intent detected
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, color: '#f8fafc', textTransform: 'capitalize' }}>
                      {response.intent?.replace(/_/g, ' ')}
                    </span>
                    {response.confidence != null && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                          border: '1px solid rgba(249,115,22,0.4)',
                          backgroundColor: 'rgba(249,115,22,0.15)',
                          color: '#fdba74',
                        }}
                      >
                        {(response.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p
                    style={{
                      margin: '0 0 0.5rem',
                      fontSize: '0.65rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#64748b',
                    }}
                  >
                    Entities extracted
                  </p>
                  <EntityChips entities={response.entities} />
                </div>

                <div>
                  <p
                    style={{
                      margin: '0 0 0.35rem',
                      fontSize: '0.65rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#64748b',
                    }}
                  >
                    Action taken
                  </p>
                  <p style={{ margin: 0, color: '#fb923c', fontWeight: 500 }}>
                    {response.action_taken}
                  </p>
                </div>

                <div>
                  <p
                    style={{
                      margin: '0 0 0.35rem',
                      fontSize: '0.65rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#64748b',
                    }}
                  >
                    Explanation
                  </p>
                  <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.5 }}>
                    {response.explanation}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Persistent command bar */}
      <div
        className="command-bar"
        style={{
          position: 'fixed',
          left: SIDEBAR_WIDTH,
          right: 0,
          bottom: 0,
          zIndex: 10002,
          minHeight: BAR_HEIGHT_PX,
          backgroundColor: '#0f172a',
          borderTop: '1px solid #334155',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
          padding: '0.75rem 1.25rem',
          boxSizing: 'border-box',
        }}
      >
        {listening && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
              fontSize: '0.8rem',
              color: '#f87171',
              fontWeight: 500,
            }}
            role="status"
            aria-live="polite"
          >
            <span style={{ position: 'relative', display: 'flex', width: 12, height: 12 }}>
              <span
                className="animate-ping"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  opacity: 0.75,
                }}
              />
              <span
                className="animate-pulse"
                style={{
                  position: 'relative',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                }}
              />
            </span>
            Listening...
          </div>
        )}

        {speechError && (
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#fca5a5' }}>
            {speechError}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            maxWidth: 1200,
            margin: '0 auto',
            width: '100%',
          }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <input
              type="text"
              className="command-bar-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a command... e.g. Dispatch ambulance to Zone 3"
              disabled={loading || listening}
              autoComplete="off"
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.65rem 1rem',
                paddingRight: voiceConfidence != null ? '3.5rem' : '1rem',
                fontSize: '0.875rem',
                lineHeight: 1.4,
                color: '#f8fafc',
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '0.5rem',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#f97316'
                e.target.style.boxShadow = '0 0 0 1px #f97316'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#475569'
                e.target.style.boxShadow = 'none'
              }}
            />
            {voiceConfidence != null && (
              <span
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  padding: '0.15rem 0.45rem',
                  borderRadius: '9999px',
                  border: '1px solid rgba(249,115,22,0.4)',
                  backgroundColor: 'rgba(249,115,22,0.15)',
                  color: '#fdba74',
                }}
              >
                {Math.round(voiceConfidence * 100)}%
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={toggleVoice}
            disabled={!speechSupported || loading}
            title={
              speechSupported
                ? listening
                  ? 'Stop listening'
                  : 'Voice command'
                : 'Speech recognition not supported'
            }
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
            style={{
              flexShrink: 0,
              width: 42,
              height: 42,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '0.5rem',
              border: listening ? '1px solid #ef4444' : '1px solid #475569',
              backgroundColor: listening ? 'rgba(239,68,68,0.25)' : '#1e293b',
              color: listening ? '#fca5a5' : '#cbd5e1',
              cursor: speechSupported && !loading ? 'pointer' : 'not-allowed',
              opacity: speechSupported && !loading ? 1 : 0.45,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              width={20}
              height={20}
              aria-hidden="true"
            >
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 14 0h-2ZM11 18.92V21h2v-2.08A7.001 7.001 0 0 0 19 13h-2a5 5 0 0 1-10 0H5a7.001 7.001 0 0 0 6 5.92Z" />
            </svg>
          </button>

          <button
            type="submit"
            disabled={loading || listening || !text.trim()}
            style={{
              flexShrink: 0,
              padding: '0.65rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              background: 'linear-gradient(to right, #dc2626, #f97316)',
              cursor: loading || listening || !text.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || listening || !text.trim() ? 0.5 : 1,
            }}
          >
            {loading ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </div>
    </>,
    document.body,
  )
}
