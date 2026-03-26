'use client'

import { useState, useEffect, useRef } from 'react'
import { useChatContext } from '@/lib/chat-context'

export default function PersistentChat({ username }: { username: string | null }) {
  const { messages, setMessages, streaming, setStreaming } = useChatContext()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || streaming || !username) return
    setInput('')

    const userMsg = { role: 'user' as const, content: text, author: username }
    const next = [...messages, userMsg]
    setMessages(next)
    setStreaming(true)

    const assistantMsg = { role: 'assistant' as const, content: '' }
    setMessages([...next, assistantMsg])

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: `Error: ${data.error}` }
          return updated
        })
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') break
          try {
            const parsed = JSON.parse(payload)
            if (parsed.text) {
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: updated[updated.length - 1].content + parsed.text,
                }
                return updated
              })
            }
            if (parsed.error) {
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: `Error: ${parsed.error}` }
                return updated
              })
            }
          } catch {}
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: 'Connection error.' }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 shrink-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Chat with Daneel</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 mt-12">
            <p className="text-2xl mb-2">⬡</p>
            <p className="text-sm">Daneel is standing by.</p>
            <p className="text-xs mt-1 text-slate-300">Ask anything about the project.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'
              }`}
            >
              {msg.role === 'user' && msg.author && (
                <p className="text-indigo-200 text-xs mb-1 font-medium">{msg.author}</p>
              )}
              {msg.role === 'assistant' && (
                <p className="text-slate-400 text-xs mb-1 font-medium">Daneel</p>
              )}
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.role === 'assistant' && streaming && i === messages.length - 1 && msg.content === '' && (
                <span className="inline-block w-2 h-4 bg-slate-400 animate-pulse rounded" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-slate-200">
        {!username ? (
          <p className="text-xs text-slate-400 text-center">Enter your name to start chatting</p>
        ) : (
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Message Daneel…"
              disabled={streaming}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={!input.trim() || streaming}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
            >
              {streaming ? '…' : '↑'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
