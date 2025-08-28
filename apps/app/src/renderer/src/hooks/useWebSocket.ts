import { useState, useEffect, useRef, useCallback } from 'react'

type WebSocketStatus = 'connecting' | 'open' | 'closing' | 'closed' | 'error'

interface UseWebSocketOptions {
  onOpen?: (event: WebSocketEventMap['open']) => void
  onMessage?: (event: WebSocketEventMap['message']) => void
  onError?: (event: WebSocketEventMap['error']) => void
  onClose?: (event: WebSocketEventMap['close']) => void
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const [status, setStatus] = useState<WebSocketStatus>('closed')
  const [lastMessage, setLastMessage] = useState<any | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const { onOpen, onMessage, onError, onClose } = options

  useEffect(() => {
    if (!url) return

    console.log(`[useWebSocket] Connecting to ${url}...`)
    setStatus('connecting')
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = (event) => {
      console.log(`[useWebSocket] Connection opened to ${url}`)
      setStatus('open')
      if (onOpen) onOpen(event)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        setLastMessage(message)
        if (onMessage) onMessage(event)
      } catch (error) {
        console.error('[useWebSocket] Error parsing message data:', error)
      }
    }

    ws.onerror = (event) => {
      console.error(`[useWebSocket] Connection error:`, event)
      setStatus('error')
      if (onError) onError(event)
    }

    ws.onclose = (event) => {
      console.log(`[useWebSocket] Connection closed. Code: ${event.code}, Reason: ${event.reason}`)
      setStatus('closed')
      wsRef.current = null
      if (onClose) onClose(event)
    }

    // Cleanup on unmount
    return () => {
      if (wsRef.current && wsRef.current.readyState < 2) {
        // CONNECTING or OPEN
        console.log('[useWebSocket] Closing WebSocket connection...')
        ws.close()
      }
    }
  }, [url])

  const sendMessage = useCallback((data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify(data)
        wsRef.current.send(message)
      } catch (error) {
        console.error('[useWebSocket] Error sending message:', error)
      }
    } else {
      console.warn('[useWebSocket] Cannot send message: WebSocket is not open.')
    }
  }, [])

  return {
    status,
    lastMessage,
    sendMessage
  }
}
