'use client'

import { useEffect } from 'react'

interface UseTechnicianLocationOptions {
  orderId?: string
  enabled?: boolean
  interval?: number
}

export function useTechnicianLocation({
  orderId,
  enabled = true,
  interval = 5000, // 5 segundos
}: UseTechnicianLocationOptions) {
  useEffect(() => {
    if (!enabled || !orderId || !('geolocation' in navigator)) {
      return
    }

    let watchId: number | null = null
    let isMounted = true

    const startTracking = async () => {
      try {
        // Intentar obtener ubicación de alta precisión
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            if (!isMounted || !orderId) return

            const { latitude, longitude } = position.coords
            
            // Enviar ubicación al servidor
            fetch(`/api/technician/location/${orderId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lat: latitude,
                lng: longitude,
              }),
            }).catch((err) => console.error('Error sending location:', err))
          },
          (error) => {
            console.error('Geolocation error:', error)
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000,
          }
        )
      } catch (error) {
        console.error('Error starting location tracking:', error)
      }
    }

    startTracking()

    return () => {
      isMounted = false
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [orderId, enabled, interval])
}
