-- Migration: create or update the `orden` table to match code expectations
-- Run with psql or your DB client against the project's database

CREATE TABLE IF NOT EXISTS orden (
  id serial primary key,
  clienteid text not null,
  clientenombre text not null,
  clientetelefono text,
  categoria text not null,
  descripcion text not null,
  direccion text not null,
  urgencia text not null default 'normal',
  estado text not null default 'pendiente',
  tecnicoid text,
  tecniconombre text,
  precio integer,
  "pdfUrl" text,
  date timestamp,
  "localDate" text,
  "localTime" text,
  "notasTecnico" text,
  "technicalEvidence" text,
  historial text,
  "departureAt" timestamp,
  "arrivalAt" timestamp,
  "workStartAt" timestamp,
  "workEndAt" timestamp,
  "createdAt" timestamp not null default now(),
  "updatedAt" timestamp not null default now()
);

ALTER TABLE orden ADD COLUMN IF NOT EXISTS "technicalEvidence" text;
ALTER TABLE orden ADD COLUMN IF NOT EXISTS "localDate" text;
ALTER TABLE orden ADD COLUMN IF NOT EXISTS "localTime" text;
ALTER TABLE orden ADD COLUMN IF NOT EXISTS "pdfUrl" text;
ALTER TABLE orden ADD COLUMN IF NOT EXISTS precio integer;
ALTER TABLE orden ADD COLUMN IF NOT EXISTS "departureAt" timestamp;
ALTER TABLE orden ADD COLUMN IF NOT EXISTS "arrivalAt" timestamp;
ALTER TABLE orden ADD COLUMN IF NOT EXISTS "workStartAt" timestamp;
ALTER TABLE orden ADD COLUMN IF NOT EXISTS "workEndAt" timestamp;
ALTER TABLE orden ADD COLUMN IF NOT EXISTS historial text;
ALTER TABLE orden ADD COLUMN IF NOT EXISTS "notasTecnico" text;

CREATE INDEX IF NOT EXISTS idx_orden_clienteid ON orden (clienteid);
