'use client'

import { useState, useEffect, useRef } from 'react'

type GlobalMessage = { id: number; role: string; author: string; content: string; createdAt: string }

const DANEEL = 'Daneel'

function renderContent(text: string) {
  const parts = text.split(/(@\w+)/g)
  return (
    <>
      {parts.map((part, i) =>
        /^@\w+$/.test(part) ? (
          <span key={i} className={/^@daneel$/i.test(part) ? 'text-emerald-400 font-semibold' : 'text-sky-400 font-semibold'}>
            {part}
          </span>
        ) : part
      )}
    </>
  )
}

function Avatar({ name }: { name: string }) {
  const isDaneel = /^daneel$/i.test(name)
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
      isDaneel ? 'bg-emerald-800/60 text-emerald-300' : 'bg-slate-700 text-slate-300'
    }`}>
      {isDaneel ? '⬡' : name.slice(0, 2).toUpperCase()}
    </div>
  )
}

export default function GlobalChatPage() {
  const [username, setUsername] = useState<string | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [messages, setMessages] = useState<GlobalMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)

  // @ mention
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)

  const lastIdRef = useRef<number>(0)
  const suppressScrollRef = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const mentionCandidates = mentionQuery !== null
    ? [DANEEL, ...onlineUsers.filter(u => u !== username && u !== DANEEL)]
        .filter(u => u.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : []

  // Auth
  useEffect(() => {
    setMounted(true)
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.username) {
        setUsername(d.username)
        localStorage.setItem('dan-username', d.username)
      }
      setAuthLoaded(true)
    })
  }, [])

  // Auto-scroll — skip when loading older messages
  useEffect(() => {
    if (suppressScrollRef.current) { suppressScrollRef.current = false; return }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  // Initial load
  useEffect(() => {
    fetch('/api/global/messages')
      .then(r => r.json())
      .then((msgs: GlobalMessage[]) => {
        setMessages(msgs)
        if (msgs.length > 0) lastIdRef.current = msgs[msgs.length - 1].id
        setHasMore(msgs.length >= 200)
      })
      .catch(() => {})
  }, [])

  const loadOlder = async () => {
    if (loadingOlder || messages.length === 0) return
    setLoadingOlder(true)
    const container = scrollContainerRef.current
    const prevScrollHeight = container?.scrollHeight ?? 0
    try {
      const oldest = messages[0].id
      const res = await fetch(`/api/global/messages?beforeId=${oldest}`)
      if (!res.ok) { console.error('[loadOlder] HTTP error', res.status); return }
      const data = await res.json()
      const older: GlobalMessage[] = Array.isArray(data) ? data : []
      console.log('[loadOlder] beforeId:', oldest, '→ got', older.length, 'messages')
      if (older.length > 0) {
        suppressScrollRef.current = true
        setMessages(prev => [...older.filter(m => !prev.some(p => p.id === m.id)), ...prev])
        requestAnimationFrame(() => {
          if (container) container.scrollTop = container.scrollHeight - prevScrollHeight
        })
      }
      setHasMore(older.length >= 50)
    } catch (e) { console.error('[loadOlder] error:', e) }
    finally { setLoadingOlder(false) }
  }

  // Poll for new messages
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/global/messages?afterId=${lastIdRef.current}`)
        const fresh: GlobalMessage[] = await res.json()
        if (fresh.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id))
            const newOnes = fresh.filter(m => !existingIds.has(m.id))
            return newOnes.length > 0 ? [...prev, ...newOnes] : prev
          })
          lastIdRef.current = fresh[fresh.length - 1].id
          if (fresh.some(m => m.author === DANEEL)) setThinking(false)
        }
      } catch {}
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  // Heartbeat — mark this user as online
  useEffect(() => {
    if (!username?.trim()) return
    const ping = () => {
      fetch('/api/global/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      }).catch(() => {})
    }
    ping()
    const interval = setInterval(ping, 30000)
    return () => clearInterval(interval)
  }, [username])

  // Poll presence
  useEffect(() => {
    const fetchPresence = () => {
      fetch('/api/global/presence')
        .then(r => r.json())
        .then(d => setOnlineUsers(d.online ?? []))
        .catch(() => {})
    }
    fetchPresence()
    const interval = setInterval(fetchPresence, 5000)
    return () => clearInterval(interval)
  }, [])

  const updateMentionQuery = (val: string, cursorPos: number) => {
    const before = val.slice(0, cursorPos)
    const match = before.match(/@(\w*)$/)
    if (match) { setMentionQuery(match[1]); setMentionIndex(0) }
    else setMentionQuery(null)
  }

  const selectMention = (name: string) => {
    const cursor = inputRef.current?.selectionStart ?? input.length
    const before = input.slice(0, cursor)
    const after = input.slice(cursor)
    const newBefore = before.replace(/@\w*$/, `@${name} `)
    setInput(newBefore + after)
    setMentionQuery(null)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(newBefore.length, newBefore.length)
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionCandidates.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); selectMention(mentionCandidates[mentionIndex]); return }
      if (e.key === 'Escape') { setMentionQuery(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) send()
  }

  const send = async () => {
    const text = input.trim()
    if (!text || sending || !username) return
    setInput('')
    setMentionQuery(null)
    setSending(true)
    if (/@daneel\b/i.test(text)) setThinking(true)

    try {
      const res = await fetch('/api/global/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: username, content: text }),
      })
      const data = await res.json()
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id))
        const toAdd = [data.message, data.aiMessage].filter(m => m && !existingIds.has(m.id))
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev
      })
      if (data.message) lastIdRef.current = Math.max(lastIdRef.current, data.aiMessage?.id ?? data.message.id)
    } catch {}
    finally {
      setSending(false)
      setThinking(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  if (!mounted) return null

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="px-6 py-3 border-b border-slate-800/60 shrink-0">
        <h1 className="text-sm font-semibold text-slate-200 mb-2">Global Chat</h1>
        <div className="flex items-center gap-2">
          {/* Daneel always shown */}
          <Avatar name={DANEEL} />
          {onlineUsers.map(name => (
            <Avatar key={name} name={name} />
          ))}
          <span className="text-xs text-slate-600 ml-1">{onlineUsers.length} online</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {hasMore && (
          <div className="flex justify-center pt-1 pb-2">
            <button onClick={loadOlder} disabled={loadingOlder}
              className="text-xs text-slate-500 hover:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors disabled:opacity-40">
              {loadingOlder ? 'Loading…' : '↑ Load older messages'}
            </button>
          </div>
        )}

        {messages.length === 0 && !thinking && (
          <div className="text-center mt-10">
            <p className="text-3xl mb-2 text-emerald-500">⬡</p>
            <p className="text-sm text-slate-600">No messages yet. Say hi, or @Daneel to get started.</p>
          </div>
        )}

        {messages.map(msg => {
          const isMe = msg.author === username
          const isDaneel = msg.author === DANEEL
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && <Avatar name={msg.author} />}
              <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm border ${
                isDaneel
                  ? 'bg-slate-900/90 border-slate-700/60 text-slate-200'
                  : isMe
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-50'
                  : 'bg-slate-800/60 border-slate-700/40 text-slate-200'
              }`}>
                <p className={`text-xs mb-1 font-medium ${
                  isDaneel ? 'text-emerald-400' : isMe ? 'text-emerald-400' : 'text-sky-400'
                }`}>
                  {msg.author}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">{renderContent(msg.content)}</p>
              </div>
              {isMe && <Avatar name={msg.author} />}
            </div>
          )
        })}

        {thinking && (
          <div className="flex gap-2 justify-start">
            <Avatar name={DANEEL} />
            <div className="bg-slate-900/90 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm">
              <p className="text-emerald-400 text-xs mb-1 font-medium">Daneel</p>
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-slate-800/60 shrink-0 relative">
        {mentionCandidates.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-20">
            {mentionCandidates.map((name, i) => (
              <button
                key={name}
                onMouseDown={e => { e.preventDefault(); selectMention(name) }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                  i === mentionIndex ? 'bg-slate-700/60' : 'hover:bg-slate-800/60'
                }`}
              >
                <Avatar name={name} />
                <span className={/^daneel$/i.test(name) ? 'text-emerald-300 font-medium' : 'text-slate-200'}>{name}</span>
                {/^daneel$/i.test(name) && <span className="text-xs text-slate-500 ml-auto">AI</span>}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => {
              const prefix = '@Daneel '
              const newInput = input.startsWith(prefix) ? input : prefix + input
              setInput(newInput)
              setTimeout(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(newInput.length, newInput.length) }, 0)
            }}
            disabled={sending}
            title="Tag Daneel"
            className="px-2 py-1.5 bg-slate-800 border border-slate-700 text-emerald-400 rounded-lg text-sm hover:bg-slate-700 hover:border-emerald-500/40 disabled:opacity-40 transition-colors shrink-0"
          >
            ⬡
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); updateMentionQuery(e.target.value, e.target.selectionStart ?? e.target.value.length) }}
            onKeyDown={handleKeyDown}
            onClick={e => updateMentionQuery(input, (e.target as HTMLInputElement).selectionStart ?? input.length)}
            placeholder={authLoaded && !username ? 'Log in to chat…' : 'Message… (@Daneel for AI, @name to tag)'}
            disabled={authLoaded && !username}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-40"
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending || !username}
            className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors"
          >
            {sending ? '…' : '↑'}
          </button>
        </div>
      </div>
    </div>
  )
}
