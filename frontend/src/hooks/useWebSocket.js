import { useCallback, useEffect, useRef, useState } from 'react'
import { WS_URL } from '../config'
const RECONNECT_INTERVAL_MS = 3000

export function useWebSocket(onMessage) {
  const [status, setStatus] = useState('connecting')
  const [error, setError] = useState(null)
  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const unmountedRef = useRef(false)
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const scheduleReconnect = useCallback(() => {
    if (unmountedRef.current) return
    clearReconnectTimer()
    setStatus('reconnecting')
    reconnectTimerRef.current = setTimeout(() => {
      connectRef.current()
    }, RECONNECT_INTERVAL_MS)
  }, [clearReconnectTimer])

  const connectRef = useRef(() => {})

  connectRef.current = () => {
    if (unmountedRef.current) return

    const existing = wsRef.current
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    if (existing) {
      existing.onclose = null
      existing.onerror = null
      existing.close()
    }

    setStatus((prev) => (prev === 'connected' ? 'reconnecting' : 'connecting'))

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      clearReconnectTimer()
      setStatus('connected')
      setError(null)
    }

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        onMessageRef.current?.(payload)
      } catch {
        /* ignore malformed frames */
      }
    }

    ws.onerror = () => {
      setError('WebSocket connection error')
    }

    ws.onclose = () => {
      wsRef.current = null
      if (!unmountedRef.current) {
        scheduleReconnect()
      }
    }
  }

  const connect = useCallback(() => {
    clearReconnectTimer()
    connectRef.current()
  }, [clearReconnectTimer])

  useEffect(() => {
    unmountedRef.current = false
    connect()

    return () => {
      unmountedRef.current = true
      clearReconnectTimer()
      const ws = wsRef.current
      if (ws) {
        ws.onclose = null
        ws.onerror = null
        ws.close()
      }
      wsRef.current = null
    }
  }, [connect, clearReconnectTimer])

  return {
    connected: status === 'connected',
    status,
    error,
    reconnect: connect,
  }
}
