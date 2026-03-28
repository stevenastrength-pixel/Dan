'use client'

import { useState, useEffect, useRef } from 'react'
import { useMobileMenu } from '@/components/AppShell'

type GlobalMessage = { id: number; role: string; author: string; content: string; imageUrl?: string | null; fileName?: string | null; createdAt: string }

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
  const { toggle: toggleNav } = useMobileMenu()
  const [username, setUsername] = useState<string | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [messages, setMessages] = useState<GlobalMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [readers, setReaders] = useState<{ username: string; lastReadMessageId: number }[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ msg: GlobalMessage; x: number; y: number } | null>(null)
  const [pendingFile, setPendingFile] = useState<{ file: File; preview: string | null; isImage: boolean } | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // @ mention
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)

  const lastIdRef = useRef<number>(0)
  const anchorIdRef = useRef<number | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!inputRef.current) return
    inputRef.current.style.height = 'auto'
    inputRef.current.style.height = input ? Math.min(inputRef.current.scrollHeight, 120) + 'px' : 'auto'
  }, [input])

  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    const timer = setTimeout(() => window.addEventListener('mousedown', close), 0)
    return () => { clearTimeout(timer); window.removeEventListener('mousedown', close) }
  }, [ctxMenu])

  const deleteMessage = async (id: number) => {
    const res = await fetch(`/api/global/messages/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setMessages(prev => prev.filter(m => m.id !== id))
    } else {
      const err = await res.json().catch(() => ({}))
      console.error('[deleteMessage] failed', res.status, err)
    }
  }

  const replyTo = (msg: GlobalMessage) => {
    const lines = msg.content.split('\n').map((l: string) => `> ${l}`).join('\n')
    setInput(`${lines}\n\n`)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

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

  // Auto-scroll — anchor to first old message after loading older; scroll to bottom otherwise
  useEffect(() => {
    if (anchorIdRef.current !== null) {
      const el = document.getElementById(`msg-${anchorIdRef.current}`)
      el?.scrollIntoView({ block: 'start' })
      anchorIdRef.current = null
      return
    }
    const el = scrollContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, thinking, pendingFile])

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
    try {
      const oldest = messages[0].id
      const res = await fetch(`/api/global/messages?beforeId=${oldest}`)
      if (!res.ok) { console.error('[loadOlder] HTTP error', res.status); return }
      const data = await res.json()
      const older: GlobalMessage[] = Array.isArray(data) ? data : []
      if (older.length > 0) {
        anchorIdRef.current = messages[0].id
        setMessages(prev => [...older.filter(m => !prev.some(p => p.id === m.id)), ...prev])
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
            if (newOnes.length === 0) return prev
            // Retire any optimistic temps now confirmed by a real message
            const withoutStaleTemps = prev.filter(m =>
              m.id >= 0 || !newOnes.some(r => r.author === m.author && r.content === m.content)
            )
            return [...withoutStaleTemps, ...newOnes]
          })
          lastIdRef.current = fresh[fresh.length - 1].id
          if (fresh.some(m => m.author === DANEEL)) setThinking(false)
        }
      } catch {}
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Heartbeat — mark this user as online and report last read message
  useEffect(() => {
    if (!username?.trim()) return
    const ping = () => {
      const lastId = messages[messages.length - 1]?.id
      fetch('/api/global/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, ...(lastId ? { lastReadMessageId: lastId } : {}) }),
      }).catch(() => {})
    }
    ping()
    const interval = setInterval(ping, 30000)
    return () => clearInterval(interval)
  }, [username, messages])

  // Poll presence
  useEffect(() => {
    const fetchPresence = () => {
      fetch('/api/global/presence')
        .then(r => r.json())
        .then(d => { setOnlineUsers(d.online ?? []); setReaders(d.readers ?? []) })
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionCandidates.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); selectMention(mentionCandidates[mentionIndex]); return }
      if (e.key === 'Escape') { setMentionQuery(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const attachFile = (file: File) => {
    const isImage = file.type.startsWith('image/')
    const preview = isImage ? URL.createObjectURL(file) : null
    setPendingFile({ file, preview, isImage })
    inputRef.current?.focus()
  }

  const send = async () => {
    const text = input.trim()
    if (!text && !pendingFile || sending || !username) return
    setInput('')
    setMentionQuery(null)
    setSending(true)
    if (inputRef.current) { inputRef.current.style.height = 'auto' }
    if (/@daneel\b/i.test(text)) setThinking(true)

    // Optimistic insert — appears instantly
    const capturedFile = pendingFile
    setPendingFile(null)
    const tempId = -Date.now()
    setMessages(prev => [...prev, {
      id: tempId, role: 'user', author: username,
      content: text,
      imageUrl: capturedFile?.preview ?? null,
      fileName: capturedFile?.file.name ?? null,
      createdAt: new Date().toISOString(),
    }])

    let imageUrl: string | null = null
    let fileName: string | null = null
    if (capturedFile) {
      const fd = new FormData()
      fd.append('file', capturedFile.file)
      try {
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const upData = await up.json()
        imageUrl = upData.url ?? null
        fileName = upData.name ?? capturedFile.file.name ?? null
      } catch {}
    }

    try {
      const res = await fetch('/api/global/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: username, content: text, imageUrl, fileName }),
      })
      const data = await res.json()
      setMessages(prev => {
        const withoutTemp = prev.filter(m => m.id !== tempId)
        const existingIds = new Set(withoutTemp.map(m => m.id))
        const toAdd = [data.message, data.aiMessage].filter(m => m && !existingIds.has(m.id))
        return toAdd.length > 0 ? [...withoutTemp, ...toAdd] : withoutTemp
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

  const searchResults = searchQuery.trim().length > 0
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : []

  const highlightSnippet = (content: string, query: string) => {
    const idx = content.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return <span>{content.slice(0, 120)}</span>
    const start = Math.max(0, idx - 40)
    const end = Math.min(content.length, idx + query.length + 80)
    return (
      <span>
        {start > 0 && '…'}{content.slice(start, idx)}
        <mark className="bg-yellow-200 dark:bg-yellow-500/40 text-inherit rounded px-0.5">{content.slice(idx, idx + query.length)}</mark>
        {content.slice(idx + query.length, end)}{end < content.length && '…'}
      </span>
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Search panel */}
      {searchOpen && (
        <div className="w-72 shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
          <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 text-sm">🔍</span>
            <input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search messages…"
              className="flex-1 text-sm bg-transparent text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none"
            />
            <button onClick={() => { setSearchOpen(false); setSearchQuery('') }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {searchQuery.trim() === '' && (
              <p className="text-xs text-slate-400 dark:text-slate-600 text-center mt-8 px-4">Type to search messages</p>
            )}
            {searchQuery.trim() !== '' && searchResults.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-600 text-center mt-8 px-4">No messages found</p>
            )}
            {searchResults.map(msg => {
              const raw = msg.createdAt.endsWith('Z') ? msg.createdAt : msg.createdAt + 'Z'
              const time = new Date(raw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              return (
                <button
                  key={msg.id}
                  onClick={() => {
                    const el = document.getElementById(`msg-${msg.id}`)
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    el?.classList.add('ring-2', 'ring-emerald-400', 'rounded-2xl')
                    setTimeout(() => el?.classList.remove('ring-2', 'ring-emerald-400', 'rounded-2xl'), 1500)
                  }}
                  className="w-full text-left px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{msg.author}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-600">{time}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                    {highlightSnippet(msg.content, searchQuery)}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      )}

    <div className="flex flex-col flex-1 overflow-hidden bg-slate-950">
      {/* Header */}
      <div className="px-4 h-16 border-b border-slate-800/60 shrink-0 flex items-center gap-3">
        <button onClick={toggleNav} className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0 text-base">☰</button>
        <h1 className="text-sm font-semibold text-slate-200 mr-1">Global Chat</h1>
        <Avatar name={DANEEL} />
        {onlineUsers.map(name => (
          <Avatar key={name} name={name} />
        ))}
        <span className="text-xs text-slate-600 hidden sm:inline">{onlineUsers.length} online</span>
        <button onClick={() => setSearchOpen(o => !o)} title="Search messages" className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${searchOpen ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>Search</button>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} data-no-squish className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-[#eae6df] dark:bg-[#17212b]">
        {hasMore && (
          <div className="flex justify-center pt-1 pb-3">
            <button onClick={loadOlder} disabled={loadingOlder}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-700 transition-colors disabled:opacity-40">
              {loadingOlder ? 'Loading…' : '↑ Load older messages'}
            </button>
          </div>
        )}

        {messages.length === 0 && !thinking && (
          <div className="text-center mt-10">
            <p className="text-3xl mb-2 text-emerald-500">⬡</p>
            <p className="text-sm text-slate-500">No messages yet. Say hi, or @Daneel to get started.</p>
          </div>
        )}

        {messages.map(msg => {
          const isMe = msg.author === username
          const isDaneel = msg.author === DANEEL
          const raw = msg.createdAt.endsWith('Z') ? msg.createdAt : msg.createdAt + 'Z'
          const time = new Date(raw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          const seenBy = readers.filter(r => r.lastReadMessageId === msg.id && r.username !== msg.author && r.username !== username)
          return (
            <div key={msg.id} id={`msg-${msg.id}`} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`flex gap-2 items-end ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isMe && <Avatar name={msg.author} />}
                <div
                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ msg, x: e.clientX, y: e.clientY }) }}
                  className={`max-w-[75%] px-3.5 py-2 text-sm shadow-sm cursor-default select-text ${
                    isMe
                      ? 'bg-[#effdde] dark:bg-[#2b5278] text-slate-800 dark:text-slate-100 rounded-2xl rounded-tr-sm'
                      : 'bg-white dark:bg-[#182533] text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-sm'
                  }`}>
                  {!isMe && (
                    <p className={`text-xs mb-0.5 font-semibold ${isDaneel ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {msg.author}
                    </p>
                  )}
                  {msg.imageUrl && (msg.fileName && !msg.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mb-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm text-slate-700 dark:text-slate-200 max-w-xs">
                      <span className="text-lg shrink-0">📄</span>
                      <span className="truncate font-medium">{msg.fileName}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 ml-auto">↓</span>
                    </a>
                  ) : (
                    <img src={msg.imageUrl} alt={msg.fileName ?? 'attachment'} className="rounded-xl max-w-full max-h-64 object-contain mb-1 cursor-pointer" onClick={() => window.open(msg.imageUrl!, '_blank')} />
                  ))}
                  <div className="flex items-end gap-3">
                    {msg.content && <p className="whitespace-pre-wrap leading-relaxed flex-1">{renderContent(msg.content)}</p>}
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 leading-none mb-0.5">{time}</span>
                  </div>
                </div>
                {isMe && <Avatar name={msg.author} />}
              </div>
              {seenBy.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 px-1">
                  {seenBy.map(r => (
                    <div key={r.username} title={`Seen by ${r.username}`} className="w-3.5 h-3.5 rounded-full bg-slate-400 dark:bg-slate-500 flex items-center justify-center">
                      <span className="text-[7px] font-bold text-white leading-none">{r.username[0].toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Context menu */}
        {ctxMenu && (() => {
          const menuW = 192, menuH = 140
          const x = ctxMenu.x + menuW > window.innerWidth ? ctxMenu.x - menuW : ctxMenu.x
          const y = ctxMenu.y + menuH > window.innerHeight ? ctxMenu.y - menuH : ctxMenu.y
          return (
            <div
              className="fixed z-50 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 py-1.5 w-48"
              style={{ left: x, top: y }}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            >
              {[
                { label: '↩ Reply', action: () => { replyTo(ctxMenu.msg); setCtxMenu(null) } },
                { label: '⎘ Copy Text', action: () => { navigator.clipboard.writeText(ctxMenu.msg.content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/\n{3,}/g, '\n\n').trim()); setCtxMenu(null) } },
                ...(ctxMenu.msg.author === username ? [{ label: '🗑 Delete', action: () => { deleteMessage(ctxMenu.msg.id); setCtxMenu(null) }, danger: true }] : []),
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors ${(item as { danger?: boolean }).danger ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>
                  {item.label}
                </button>
              ))}
            </div>
          )
        })()}

        {thinking && (
          <div className="flex gap-2 items-end justify-start">
            <Avatar name={DANEEL} />
            <div className="bg-white dark:bg-[#182533] rounded-2xl rounded-tl-sm shadow-sm px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100">
              <p className="text-emerald-600 dark:text-emerald-400 text-xs mb-0.5 font-semibold">Daneel</p>
              <span className="flex gap-1 items-center py-0.5">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950 shrink-0 relative">
        {mentionCandidates.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden z-20">
            {mentionCandidates.map((name, i) => (
              <button
                key={name}
                onMouseDown={e => { e.preventDefault(); selectMention(name) }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                  i === mentionIndex ? 'bg-slate-100 dark:bg-slate-700/60' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <Avatar name={name} />
                <span className={/^daneel$/i.test(name) ? 'text-emerald-600 dark:text-emerald-300 font-medium' : 'text-slate-800 dark:text-slate-200'}>{name}</span>
                {/^daneel$/i.test(name) && <span className="text-xs text-slate-400 ml-auto">AI</span>}
              </button>
            ))}
          </div>
        )}

        {pendingFile && (
          <div className="mb-2 flex items-start gap-2">
            <div className="relative">
              {pendingFile.isImage && pendingFile.preview
                ? <img src={pendingFile.preview} alt="preview" className="rounded-xl max-h-32 max-w-48 object-contain border border-slate-200 dark:border-slate-700" />
                : <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-sm text-slate-700 dark:text-slate-200 max-w-48"><span className="text-lg">📄</span><span className="truncate">{pendingFile.file.name}</span></div>
              }
              <button onClick={() => setPendingFile(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-700 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-500 transition-colors">✕</button>
            </div>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="*/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) attachFile(f); e.target.value = '' }} />
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || (authLoaded && !username)}
            title="Attach file"
            className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors shrink-0"
          >
            📎
          </button>
          <button
            onClick={() => {
              const prefix = '@Daneel '
              const newInput = input.startsWith(prefix) ? input : prefix + input
              setInput(newInput)
              setTimeout(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(newInput.length, newInput.length) }, 0)
            }}
            disabled={sending}
            title="Tag Daneel"
            className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-emerald-500 dark:text-emerald-400 rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-700 hover:border-emerald-500/40 disabled:opacity-40 transition-colors shrink-0"
          >
            ⬡
          </button>
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            onChange={e => {
              setInput(e.target.value)
              updateMentionQuery(e.target.value, e.target.selectionStart ?? e.target.value.length)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={handleKeyDown}
            onPaste={e => {
              const file = Array.from(e.clipboardData.files)[0]
              if (file) { e.preventDefault(); attachFile(file) }
            }}
            onClick={e => updateMentionQuery(input, (e.target as HTMLTextAreaElement).selectionStart ?? input.length)}
            placeholder={authLoaded && !username ? 'Log in to chat…' : 'Message…'}
            disabled={authLoaded && !username}
            className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-40 resize-none overflow-hidden leading-relaxed"
          />
          <button
            onClick={send}
            disabled={(!input.trim() && !pendingFile) || sending || !username}
            className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-40 transition-colors"
          >
            {sending ? '…' : '↑'}
          </button>
        </div>
      </div>
    </div>
    </div>
  )
}
