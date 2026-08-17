import {
  streamText,
  type LanguageModel,
} from 'ai'
import { google } from '@ai-sdk/google'
import { promises as fs } from 'fs'
import path from 'path'

export const maxDuration = 30

const BASE_SYSTEM_PROMPT = `Eres Zero IA — la mascota y asistente virtual de Zero Industries (un lobo blanco tecnológico).

ROL Y PERSONALIDAD:
- Identifícate siempre en primera persona: "Hola, soy Zero IA" o "Déjame revisar eso por ti".
- Personalidad: líder de la manada, protector, directo, leal y experto técnico; usa sutiles metáforas de 'manada' cuando aporte calidez, pero mantén la seriedad técnica.

OBJETIVO:
- Guiar al usuario, resolver dudas frecuentes y facilitar la navegación (Cliente, Técnico o Administrador).

ANÁLISIS DE URGENCIA:
- Si detectas palabras clave de EMERGENCIA (chispas, humo, quemado, cables expuestos, olor extraño): Nivel ALTO - Instruir cortar energía inmediatamente y contactar emergencias 911.
- Si detectas PROBLEMA (falla, error, no funciona): Nivel MEDIO - Proporcionar diagnóstico y pasos.
- Si es CONSULTA (información, tarifas, horarios): Nivel BAJO - Información general.

FLUJO Y REGLAS DE RESPUESTA:
1) BREVEDAD (prioritaria): Respuestas cortas, organizadas en viñetas o listas; evita párrafos largos (optimizado para móvil).
2) ROL: Si la consulta es general, primero pregunta o sugiere seleccionar rol (Cliente/Técnico/Administrador). Ofrece botones o alternativas claras.
3) ACCIONES PRÁCTICAS: Siempre sugiere un siguiente paso concreto (p. ej. "Ir a Estado", "Solicitar diagnóstico", "Asignar técnico").
4) SEGURIDAD: Si hay riesgo (olor a quemado, chispas, cables expuestos), instruir: cortar energía y contactar emergencias; no dar instrucciones peligrosas.
5) ESCALADO HUMANO: Si el usuario solicita hablar con una persona, hay un error de pago, o un incidente crítico, responde: "Voy a alertar a nuestra manada humana de soporte para que revisen tu caso directamente" y solicita nombre, correo y teléfono.
6) RECOMENDACIONES: Si el usuario describe un problema, sugiere servicios relevantes con aproximación de costo si es Cliente.

RECOMENDACIONES DE SERVICIOS POR PROBLEMA:
{{DYNAMIC_SERVICES_PRICING}}

FORMATO DE RESPUESTA:
- Si es una FAQ o pregunta común, responde en formato claro.
- Si es asistencia operativa, devolver viñetas numeradas con pasos claros.
- Si es recomendación de servicio, incluir: "💡 **Servicio Recomendado**: Nombre ($precio)" en negrita.
- Incluir Emoji 🔨 para trabajos, 💡 para información, ⚠️ para emergencias, ✅ para confirmaciones.

TONO:
- Español de Chile, profesional, cercano y entusiasta. Habla en primera persona.
- Usa "manada" cuando sea apropiado para crear conexión emocional.

LÍMITE:
- Mantén las respuestas dentro de 4-6 líneas en pantalla móvil siempre que sea posible.
- Máximo 15 líneas para respuestas técnicas.
`

// Load settings and build service pricing dynamically
async function buildServicesPricing(): Promise<string> {
  try {
    const settingsPath = path.join(process.cwd(), 'app', 'data', 'admin-settings.json')
    const raw = await fs.readFile(settingsPath, 'utf8')
    const settings = JSON.parse(raw)
    
    if (!Array.isArray(settings?.services) || settings.services.length === 0) {
      return '- Consulta nuestros servicios en la plataforma'
    }

    // Calculate final price: base * (1 + markup/100) * (1 + iva/100)
    const servicePrices = settings.services
      .filter((s: any) => s.name && s.from !== undefined)
      .map((s: any) => {
        const base = Number(s.from) || 0
        const markup = Number(s.markupPercent) || 0
        const iva = Number(s.ivaPercent) || 19
        
        // Calculate: base * (1 + markup%) * (1 + iva%)
        const withMarkup = base * (1 + markup / 100)
        const finalPrice = withMarkup * (1 + iva / 100)
        
        return {
          name: s.name,
          short: s.short || s.name,
          price: Math.round(finalPrice),
        }
      })

    // Build formatted pricing list
    const priceLines = servicePrices
      .slice(0, 10) // Limit to 10 services to keep prompt manageable
      .map((s: any) => {
        const formatted = new Intl.NumberFormat('es-CL', {
          style: 'currency',
          currency: 'CLP',
          minimumFractionDigits: 0,
        }).format(s.price)
        
        return `- "${s.short}": → ${s.name} (${formatted})`
      })
      .join('\n')

    return priceLines || '- Consulta nuestros servicios en la plataforma'
  } catch (error) {
    console.error('Error loading service pricing:', error)
    return '- Consulta nuestros servicios en la plataforma'
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    let { messages, userRole, urgency } = body as any
    
    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: 'Invalid message format' },
        { status: 400 },
      )
    }

    // Build complete system prompt with dynamic pricing
    const servicesPricing = await buildServicesPricing()
    const SYSTEM_PROMPT = BASE_SYSTEM_PROMPT.replace(
      '{{DYNAMIC_SERVICES_PRICING}}',
      servicesPricing
    )

    // Convert messages to the format expected by streamText
    const modelMessages = messages.map((m: any) => {
      const content = m.parts ? m.parts : (m.content || [])
      const textContent = Array.isArray(content) 
        ? content.find((c: any) => c.type === 'text' || typeof c === 'string')
        : content
      
      return {
        role: m.role,
        content: typeof textContent === 'string' 
          ? textContent 
          : (textContent?.text || JSON.stringify(textContent)),
      }
    })

    // Build context for the model
    let contextStr = ''
    if (userRole) {
      contextStr += `\n[User Role: ${userRole}]`
    }
    if (urgency) {
      contextStr += `\n[Urgency Level: ${urgency}]`
    }

    const systemWithContext = SYSTEM_PROMPT + contextStr
    
    const { textStream } = streamText({
      model: google('gemini-3.5-flash') as LanguageModel,
      system: systemWithContext,
      messages: modelMessages,
    })

    return new Response(textStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return Response.json(
      {
        error: 'Chat unavailable',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
