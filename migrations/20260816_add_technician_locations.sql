-- Crear tabla para rastreo de ubicación de técnicos
CREATE TABLE IF NOT EXISTS technician_locations (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  technician_id TEXT NOT NULL,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_technician_locations_order_id ON technician_locations(order_id);
CREATE INDEX IF NOT EXISTS idx_technician_locations_technician_id ON technician_locations(technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_locations_updated_at ON technician_locations(updated_at);
