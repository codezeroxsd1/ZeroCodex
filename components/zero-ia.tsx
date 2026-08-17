"use client"

import { useState, useRef, useEffect } from 'react'
import { useSession } from '@/lib/auth-client'

export function ZeroIA(_props: { orders?: any[]; compact?: boolean; onGoTab?: any; onSelectService?: any }) {
  const { data: session } = useSession()
  const sessionUser = session?.user as { role?: string } | undefined
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [imgOk, setImgOk] = useState(true)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [userRole, setUserRole] = useState<'cliente' | 'tecnico' | 'admin' | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Load messages from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('zero-ia-messages')
    if (saved) {
      try {
        setMessages(JSON.parse(saved))
      } catch (e) {
        console.error('Error loading messages:', e)
      }
    }
  }, [])

  // Load user role from session
  useEffect(() => {
    const nextRole = sessionUser?.role
    if (nextRole === 'cliente' || nextRole === 'tecnico' || nextRole === 'admin') {
      setUserRole(nextRole)
      return
    }

    setUserRole(null)
  }, [sessionUser?.role])

  // Save messages to localStorage
  useEffect(() => {
    localStorage.setItem('zero-ia-messages', JSON.stringify(messages))
  }, [messages])

  // Auto-scroll
  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open, isLoading])

  // Detectar urgencia
  function detectUrgency(text: string): string {
    const lower = text.toLowerCase()
    if (lower.includes('emergencia') || lower.includes('urgente') || lower.includes('ahora') || lower.includes('chispa') || lower.includes('humo') || lower.includes('quemado')) {
      return 'high'
    }
    if (lower.includes('problema') || lower.includes('error') || lower.includes('falla')) {
      return 'medium'
    }
    return 'low'
  }

  // Renderizar mensaje con Markdown básico
  function renderMessage(text: string) {
    const encoded = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    
    return (
      <>
        {encoded.split('\n').map((line, i) => {
          if (line.startsWith('*') && line.endsWith('*')) {
            return <strong key={i}>{line.replace(/\*/g, '')}</strong>
          }
          if (line.startsWith('**') && line.endsWith('**')) {
            return <strong key={i}>{line.replace(/\*\*/g, '')}</strong>
          }
          if (line.startsWith('*')) {
            return <div key={i} className="ml-3">• {line.replace(/^\*\s?/, '')}</div>
          }
          return <div key={i}>{line || <br />}</div>
        })}
      </>
    )
  }

  async function submit(text: string) {
    if (!text.trim() || busy) return

    // Detect urgency
    const urgency = detectUrgency(text)
    
    const userMessage = { 
      id: Math.random().toString(), 
      role: 'user', 
      content: text, 
      parts: [{ type: 'text', text }],
      urgency,
      userRole,
      timestamp: new Date().toISOString()
    }
    
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setBusy(true)
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: updatedMessages,
          userRole,
          urgency
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      let fullResponse = ''
      if (response.body) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          fullResponse += chunk
        }
      }
      
      if (fullResponse.trim()) {
        const assistantMessage = { 
          id: Math.random().toString(), 
          role: 'assistant', 
          content: fullResponse, 
          parts: [{ type: 'text', text: fullResponse }],
          timestamp: new Date().toISOString()
        }
        setMessages(prev => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error('Chat error:', error)
    } finally {
      setBusy(false)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start justify-start p-0 w-full min-h-screen gap-4 md:gap-8">
      <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6 pt-4 md:pt-6 w-full px-3 md:px-0">
        <div className="relative w-full md:w-auto">
          {/* Globo de texto tipo cómic - Dinámico */}
          <div className="bg-white border-4 border-black rounded-3xl p-4 md:p-6 w-full md:max-w-sm shadow-lg relative transition-all duration-300 hover:shadow-xl" onClick={() => !open && setOpen(true)}>
            {!open ? (
              <>
                <p className="text-lg md:text-xl font-bold text-black">¡Hola! Soy <span className="text-blue-600">ZERO</span></p>
                <p className="text-sm md:text-base text-black mt-2">Tu asistente IA para servicios eléctricos</p>
                <p className="text-sm md:text-base text-black mt-4">¿En qué puedo ayudarte hoy?</p>
                <p className="text-xs md:text-sm text-gray-600 mt-4 border-t-2 border-black pt-3 cursor-pointer hover:text-blue-600">Pregúntame algo o escribe tu problema...</p>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-lg md:text-xl font-bold text-black">¿En qué te ayudo?</p>
                  <button onClick={() => setOpen(false)} className="text-black font-bold text-xl hover:scale-125 transition">✕</button>
                </div>
                
                {/* Messages */}
                <div ref={scrollRef} className="max-h-64 md:max-h-80 overflow-y-auto space-y-3 p-3 mb-4 bg-gray-50 rounded-lg border-2 border-black">
                  {messages.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">Empieza a escribir tu pregunta...</p>
                  ) : (
                    messages.map((m: any, idx: number) => (
                      <div 
                        key={m.id} 
                        className={`p-3 rounded-lg text-xs md:text-sm transition-all duration-300 ${
                          m.role === 'user' 
                            ? 'bg-blue-500 text-white text-right ml-8 animate-slideInRight' 
                            : 'bg-white text-black border-2 border-black mr-8 animate-slideInLeft'
                        }`}
                        style={{
                          animation: `slideIn${m.role === 'user' ? 'Right' : 'Left'} 0.3s ease-out`
                        }}
                      >
                        {m.parts?.map((p: any, i: number) => (
                          p.type === 'text' ? (
                            <div key={i} className="whitespace-pre-wrap">
                              {renderMessage(p.text)}
                            </div>
                          ) : null
                        ))}
                        {/* Rating System */}
                        {m.role === 'assistant' && idx === messages.length - 1 && !isLoading && (
                          <div className="mt-3 pt-2 border-t border-gray-300 flex gap-2 justify-end">
                            <button 
                              onClick={() => setSelectedIndex(selectedIndex === idx ? null : idx)}
                              className="text-xs hover:scale-125 transition"
                              title="¿Te fue útil?"
                            >
                              {selectedIndex === idx ? '👍' : '👍'}
                            </button>
                            <button 
                              className="text-xs hover:scale-125 transition"
                              title="No fue útil"
                            >
                              👎
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  
                  {/* Loading Indicator */}
                  {isLoading && (
                    <div className="p-3 bg-gray-100 rounded-lg border-2 border-gray-300 text-xs md:text-sm text-gray-700 animate-pulse">
                      <span className="inline-block">Zero IA está escribiendo</span>
                      <span className="inline-block ml-1">
                        <span className="animate-bounce">.</span>
                        <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>.</span>
                        <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Input Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    submit(input)
                  }}
                  className="flex gap-2"
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Tu pregunta..."
                    disabled={busy}
                    className="flex-1 rounded-full border-2 border-black bg-white px-3 py-2 text-xs md:text-sm text-black outline-none disabled:opacity-50 transition"
                  />
                  <button 
                    disabled={busy || !input.trim()} 
                    type="submit" 
                    className="rounded-full bg-blue-600 px-3 py-2 text-white text-xs font-bold disabled:opacity-50 hover:bg-blue-700 transition transform hover:scale-105"
                  >
                    →
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Wolf Image */}
        <button
          aria-label="Zero IA"
          onClick={() => setOpen((v) => !v)}
          className="select-none rounded-full border-0 bg-transparent leading-none flex-shrink-0 transition transform hover:scale-105 w-20 md:w-96 mt-4 md:mt-0"
          style={{ lineHeight: 1 }}
        >
          {imgOk ? (
            <img
              src="/zero-wolf.png"
              alt="Zero"
              className="w-full h-auto rounded-full object-contain"
              onError={() => setImgOk(false)}
            />
          ) : (
            <span className="text-4xl md:text-8xl">🐺</span>
          )}
        </button>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-slideInRight {
          animation: slideInRight 0.3s ease-out;
        }

        .animate-slideInLeft {
          animation: slideInLeft 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

export default ZeroIA
