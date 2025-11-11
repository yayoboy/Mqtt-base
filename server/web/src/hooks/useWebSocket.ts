import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const addMessage = useAppStore((state) => state.addMessage)
  const setStoreIsConnected = useAppStore((state) => state.setIsConnected)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`

    const connect = () => {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        setStoreIsConnected(true)

        // Subscribe to all topics
        ws.send(JSON.stringify({ type: 'subscribe', topics: ['#'] }))
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'message' || data.topic) {
            addMessage({
              topic: data.topic,
              payload: data.payload,
              timestamp: data.timestamp,
            })
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
        setStoreIsConnected(false)

        // Reconnect after 5 seconds
        setTimeout(() => {
          connect()
        }, 5000)
      }
    }

    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [addMessage, setStoreIsConnected])

  return { isConnected, ws: wsRef.current }
}
