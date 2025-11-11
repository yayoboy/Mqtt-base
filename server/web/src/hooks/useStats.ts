import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { api } from '@/services/api'

export function useStats(interval: number = 5000) {
  const setStats = useAppStore((state) => state.setStats)
  const isAuthenticated = useAppStore((state) => state.isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) return

    const fetchStats = async () => {
      try {
        const stats = await api.getStats()
        setStats(stats)
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }

    fetchStats()
    const intervalId = setInterval(fetchStats, interval)

    return () => clearInterval(intervalId)
  }, [isAuthenticated, interval, setStats])
}
