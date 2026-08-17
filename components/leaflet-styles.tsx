'use client'

import { useEffect } from 'react'

export function LeafletStyles() {
  useEffect(() => {
    // Cargar CSS de Leaflet desde CDN
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(link)

    return () => {
      document.head.removeChild(link)
    }
  }, [])

  return null
}
