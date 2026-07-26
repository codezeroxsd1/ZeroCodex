"use client"

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'

export function ZeroIA(_props: { orders?: any[]; compact?: boolean; onGoTab?: any; onSelectService?: any }) {
  const { messages, sendMessage, status } = useChat({ transport: new DefaultChatTransport({ api: '/api/chat' }) })
  const [input, setInput] = useState('')
  const [imgOk, setImgOk] = useState(true)
  const [open, setOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const busy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  function submit(text: string) {
    if (!text.trim() || busy) return
    sendMessage({ text })
    setInput('')
  }

  return (
    <div className="flex flex-col items-center justify-start p-6">
      <button
        aria-label="Zero IA"
        onClick={() => setOpen((v) => !v)}
        className="select-none rounded-full border-0 bg-transparent leading-none"
        style={{ lineHeight: 1 }}
      >
        {imgOk ? (
          <img
            src="/zero-wolf.png"
            alt="Zero"
            className="w-20 h-20 rounded-full object-contain"
            onError={() => setImgOk(false)}
          />
        ) : (
          <span className="text-8xl">🐺</span>
        )}
      </button>

      {open && (
        <div className="mt-4 w-full max-w-md rounded-xl border border-border bg-card p-3 shadow-lg">
          <div ref={scrollRef} className="max-h-64 overflow-y-auto space-y-3 p-2">
            {messages.length === 0 ? (
              <div className="text-sm text-muted-foreground">Hola — pregúntame algo o escribe tu problema.</div>
            ) : (
              messages.map((m: any) => (
                <div key={m.id} className={`p-2 rounded ${m.role === 'user' ? 'bg-primary text-primary-foreground self-end' : 'bg-secondary text-foreground'}`}>
                  {m.parts?.map((p: any, i: number) => (p.type === 'text' ? <div key={i}>{p.text}</div> : null))}
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit(input)
            }}
            className="mt-2 flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu consulta..."
              className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none"
            />
            <button disabled={busy || !input.trim()} type="submit" className="rounded-full bg-primary px-4 py-2 text-white disabled:opacity-50">
              Enviar
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default ZeroIA
