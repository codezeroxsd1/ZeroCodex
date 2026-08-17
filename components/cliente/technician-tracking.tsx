'use client'

import { useEffect, useState } from 'react'
import { MapPin, Navigation, Phone, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TechnicianLocation {
  lat: number
  lng: number
  timestamp: number
}

interface ClientLocation {
  lat: number
  lng: number
}

interface TechnicianTrackingProps {
  orderId: string
  technicianPhone?: string
  technicianName?: string
  status?: string
}

export function TechnicianTracking({
  orderId,
  technicianPhone,
  technicianName = 'Técnico',
  status = 'en camino'
}: TechnicianTrackingProps) {
  const [techLocation, setTechLocation] = useState<TechnicianLocation | null>(null)
  const [clientLocation, setClientLocation] = useState<ClientLocation | null>(null)
  const [distance, setDistance] = useState<string>('Calculando...')
  const [eta, setEta] = useState<string>('--')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Obtener ubicación del cliente (una sola vez)
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }
          setClientLocation(loc)
          setLoading(false)
        },
        (error) => {
          console.error('Error getting client location:', error)
          // Fallback a Santiago, Chile
          setClientLocation({ lat: -33.8688, lng: -51.5093 })
          setLoading(false)
        }
      )
    }
  }, [])

  // Obtener ubicación del técnico (polling)
  useEffect(() => {
    let isMounted = true
    let intervalId: NodeJS.Timeout | null = null

    const fetchTechnicianLocation = async () => {
      try {
        const response = await fetch(`/api/technician/location/${orderId}`)
        if (!response.ok) return

        const data = await response.json()
        if (isMounted && data.location) {
          setTechLocation({
            lat: data.location.lat,
            lng: data.location.lng,
            timestamp: data.location.timestamp || Date.now(),
          })
          setError(null)
        }
      } catch (err) {
        console.error('Error fetching technician location:', err)
        if (isMounted) {
          setError('No se puede conectar con el técnico')
        }
      }
    }

    // Fetch inicial
    fetchTechnicianLocation()

    // Polling cada 5 segundos cuando autoRefresh está activo
    if (autoRefresh) {
      intervalId = setInterval(fetchTechnicianLocation, 5000)
    }

    return () => {
      isMounted = false
      if (intervalId) clearInterval(intervalId)
    }
  }, [orderId, autoRefresh])

  // Calcular distancia entre dos puntos (Haversine formula)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371 // Radio de la Tierra en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Calcular distancia y ETA
  useEffect(() => {
    if (techLocation && clientLocation) {
      const dist = calculateDistance(
        techLocation.lat,
        techLocation.lng,
        clientLocation.lat,
        clientLocation.lng
      )

      if (dist < 0.1) {
        setDistance('< 100 m')
        setEta('Ya llega')
      } else if (dist < 1) {
        setDistance(`${Math.round(dist * 1000)} m`)
        setEta(`${Math.round(dist * 12)} min`)
      } else {
        setDistance(`${dist.toFixed(1)} km`)
        setEta(`${Math.round(dist * 6)} min`)
      }
    }
  }, [techLocation, clientLocation])

  // Generar URL de OpenStreetMap
  const getMapUrl = () => {
    if (!clientLocation || !techLocation) return ''
    
    // Centro del mapa entre técnico y cliente
    const centerLat = (clientLocation.lat + techLocation.lat) / 2
    const centerLng = (clientLocation.lng + techLocation.lng) / 2
    const zoom = 15
    
    // Crear marcadores en OpenStreetMap
    return `https://www.openstreetmap.org/export/embed.html?bbox=${centerLng - 0.02},${centerLat - 0.02},${centerLng + 0.02},${centerLat + 0.02}&layer=mapnik&marker=${clientLocation.lat},${clientLocation.lng}&marker=${techLocation.lat},${techLocation.lng}`
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-card">
      {/* Mapa */}
      <div className={cn('relative h-56 w-full bg-gray-100', loading && 'flex items-center justify-center')}>
        {loading ? (
          <div className="text-center">
            <Loader2 className="mb-2 inline-block h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Cargando ubicación...</p>
          </div>
        ) : clientLocation ? (
          <iframe
            width="100%"
            height="100%"
            frameBorder="0"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${clientLocation.lng - 0.05},${clientLocation.lat - 0.05},${clientLocation.lng + 0.05},${clientLocation.lat + 0.05}&layer=mapnik`}
            style={{ border: 'none' }}
            className="rounded-t-3xl"
            title="Mapa de ubicación"
          />
        ) : null}
      </div>

      {/* Info bajo el mapa */}
      <div className="space-y-3 p-4">
        {error && (
          <div className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {/* Distancia */}
          <div className="flex flex-col items-center rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Distancia</p>
            </div>
            <p className="mt-1 text-base font-bold text-primary">{distance}</p>
          </div>

          {/* ETA */}
          <div className="flex flex-col items-center rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-1">
              <Navigation className="h-4 w-4 text-orange-500" />
              <p className="text-xs text-muted-foreground">ETA</p>
            </div>
            <p className="mt-1 text-base font-bold text-orange-500">{eta}</p>
          </div>

          {/* Estado */}
          <div className="flex flex-col items-center rounded-lg border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">Estado</p>
            <p className="mt-1 text-sm font-semibold capitalize text-green-600">{status}</p>
          </div>
        </div>

        {/* Información del técnico */}
        <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3">
          <div>
            <p className="text-sm font-semibold text-blue-900">{technicianName}</p>
            {technicianPhone && <p className="text-xs text-blue-700">{technicianPhone}</p>}
          </div>
          {technicianPhone && (
            <a
              href={`tel:${technicianPhone}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition"
              title="Llamar técnico"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
        </div>

        {/* Control de actualización */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition',
              autoRefresh
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-background hover:bg-accent'
            )}
          >
            {autoRefresh ? '⏸ Pausar' : '▶ Reanudar'}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent transition"
          >
            🔄 Recargar
          </button>
        </div>

        {/* Nota sobre la ubicación */}
        <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
          <p>💡 <strong>La ubicación se actualiza cada 5 segundos</strong></p>
          <p className="mt-1">El técnico debe permitir acceso a su ubicación GPS para que se muestre en tiempo real.</p>
        </div>
      </div>
    </section>
  )
}
