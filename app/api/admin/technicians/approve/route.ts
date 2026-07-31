import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/session'

export async function POST(req: Request) {
  try {
    await requireRole('admin')
    const body = await req.json()
    const userId = typeof body?.userId === 'string' ? body.userId : ''

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId requerido' }, { status: 400 })
    }

    await db.update(user).set({ isApproved: true, updatedAt: new Date() }).where(eq(user.id, userId))

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo aprobar al técnico'
    return NextResponse.json({ success: false, error: message }, { status: 403 })
  }
}
