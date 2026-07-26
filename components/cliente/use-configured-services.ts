'use client'

import { useEffect, useState } from 'react'
import { buildServicesFromConfig, type Service } from '@/lib/data'

export function useConfiguredServices() {
  const [services, setServices] = useState<Service[]>(() => buildServicesFromConfig())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isActive = true

    const loadServices = async () => {
      try {
        const res = await fetch('/api/admin/settings', { cache: 'no-store' })
        const json = await res.json()
        const configuredServices = Array.isArray(json?.settings?.services) ? json.settings.services : null

        if (isActive) {
          setServices(buildServicesFromConfig(configuredServices ?? undefined))
        }
      } catch {
        if (isActive) {
          setServices(buildServicesFromConfig())
        }
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    loadServices()

    return () => {
      isActive = false
    }
  }, [])

  return { services, loading }
}
