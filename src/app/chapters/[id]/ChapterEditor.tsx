'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Comment = {
  id: string
  text: string
  author: string
  resolved: boolean
  createdAt: string
}

type Chapter = {
  id: string
  title: string
  content: string
  comments: Comment[]
}

type Version = {
  id: string
  savedBy: string
  createdAt: string
}

type AIChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export default function ChapterEditor({ chapter }: { chapter: Chapter }) {
  const router = useRouter()
  const [title, setTitle] = useState(chapter.title)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [showVersions, setShowVersions] = useState(false)
  const [versions, setVersions] = useState<Version[]>([])
  const [comments, setComments] = useState<Comment[]>(chapter.comments)
  const [newComment, setNewComment] = useState('')
  const [username, setUsername] = useState('')
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<NodeJS.Timeout | null>(null)

  // AI Chat state
  const [rightPanel, setRightPanel] = useState<'comments' | 'ai'>('comments')
  const [aiMessages, setAiMessages] = useState<AIChatMessage[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const aiBottomRef = useRef<HTMLDivElement>(null)

  // Refs so the Tiptap onUpdate closure always has fresh values
  const titleRef = useRef(chapter.title)
  const usernameRef = useRef('')

  useEffect(() => {
    titleRef.current = title
  }, [title])

  useEffect(() => {
    const stored = localStorage.getItem('dan-username')
    if (stored) {
      setUsername(stored)
      usernameRef.current = stored
    } else {
      setShowUsernamePrompt(true)
    }
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing your chapter…' }),
      CharacterCount,
    ],
    content: chapter.content,
    onUpdate: ({ editor }) => {
      setSaveStatus('unsaved')
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        setSaveStatus('saving')
        await fetch(`/api/chapters/${chapter.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: titleRef.current,
            content: editor.getHTML(),
            savedBy: usernameRef.current || 'Unknown',
          }),
        })
        setSaveStatus('saved')
      }, 2000)
    },
  })

  const saveNow = async () => {
    if (!editor) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    await fetch(`/api/chapters/${chapter.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: titleRef.current,
        content: editor.getHTML(),
        savedBy: usernameRef.current || 'Unknown',
      }),
    })
    setSaveStatus('saved')
  }

  const confirmUsername = () => {
    const val = nameInputRef.current?.value.trim()
    if (!val) return
    localStorage.setItem('dan-username', val)
    setUsername(val)
    usernameRef.current = val
    setShowUsernamePrompt(false)
  }

  const loadVersions = async () => {
    const res = await fetch(`/api/chapters/${chapter.id}/versions`)
    setVersions(await res.json())
    setShowVersions(true)
  }

  const restoreVersion = async (versionId: string) => {
    const res = await fetch(`/api/chapters/${chapter.id}/versions?versionId=${versionId}`)
    const data = await res.json()
    if (editor && data?.content) {
      editor.commands.setContent(data.content)
      setSaveStatus('unsaved')
    }
    setShowVersions(false)
  }

  const deleteChapter = async () => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    await fetch(`/api/chapters/${chapter.id}`, { method: 'DELETE' })
    router.back()
  }

  const addComment = async () => {
    if (!newComment.trim()) return
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapterId: chapter.id,
        text: newComment.trim(),
        author: username || 'Unknown',
      }),
    })
    const comment = await res.json()
    setComments((prev) => [...prev, comment])
    setNewComment('')
  }

  const resolveComment = async (commentId: string) => {
    await fetch(`/api/comments/${commentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: true }),
    })
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, resolved: true } : c))
    )
  }

  const sendAiMessage = async () => {
    if (!aiInput.trim() || aiLoading) return
    const userMsg: AIChatMessage = { role: 'user', content: aiInput.trim() }
    const newHistory = [...aiMessages, userMsg]
    setAiMessages(newHistory)
    setAiInput('')
    setAiLoading(true)

    setAiMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory,
          chapterId: chapter.id,
        }),
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        setAiMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: `Error: ${err.error}` },
        ])
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            if (parsed.error) {
              setAiMessages((prev) => [
                ...prev.slice(0, -1),
                { role: 'assistant', content: `Error: ${parsed.error}` },
              ])
            } else if (parsed.text) {
              setAiMessages((prev) => {
                const last = prev[prev.length - 1]
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + parsed.text },
                ]
              })
              aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
            }
          } catch {}
        }
      }
    } finally {
      setAiLoading(false)
    }
  }

  const wordCount = editor?.storage?.characterCount?.words() ?? 0
  const activeComments = comments.filter((c) => !c.resolved)
  const resolvedCount = comments.filter((c) => c.resolved).length

  return (
    <div className="flex h-full overflow-hidden bg-slate-950">
      {/* Username prompt modal */}
      {showUsernamePrompt && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl w-80">
            <h2 className="text-base font-semibold text-slate-100 mb-1">What's your name?</h2>
            <p className="text-sm text-slate-500 mb-4">
              Used to credit your edits and comments.
            </p>
            <input
              ref={nameInputRef}
              type="text"
              placeholder="Your name…"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') confirmUsername() }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <button
              onClick={confirmUsername}
              className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Version history modal */}
      {showVersions && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl w-96 max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-200">Version History</h2>
              <button
                onClick={() => setShowVersions(false)}
                className="text-slate-500 hover:text-slate-300 text-lg leading-none transition-colors"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              A snapshot is saved each time the content changes and is autosaved. Restoring replaces
              the current editor content (you can still save or undo).
            </p>
            <div className="overflow-auto flex-1">
              {versions.length === 0 ? (
                <p className="text-sm text-slate-600 text-center py-4">No saved versions yet.</p>
              ) : (
                <ul className="space-y-2">
                  {versions.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between p-3 border border-slate-800/60 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-300">{v.savedBy}</p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {new Date(v.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => restoreVersion(v.id)}
                        className="text-xs px-3 py-1.5 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30 border border-emerald-500/30 font-medium transition-colors"
                      >
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Editor column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="bg-slate-950 border-b border-slate-800/60 px-5 py-2.5 flex items-center gap-2 shrink-0">
          <button onClick={() => router.back()} className="text-xs text-slate-500 hover:text-slate-300 mr-1 transition-colors">
            ← Chapters
          </button>
          <div className="w-px h-4 bg-slate-800" />

          {/* Formatting buttons */}
          {(['bold', 'italic', 'strike'] as const).map((mark) => (
            <button
              key={mark}
              onClick={() => {
                if (mark === 'bold') editor?.chain().focus().toggleBold().run()
                if (mark === 'italic') editor?.chain().focus().toggleItalic().run()
                if (mark === 'strike') editor?.chain().focus().toggleStrike().run()
              }}
              className={`px-2 py-1 text-xs rounded font-mono transition-colors ${
                editor?.isActive(mark)
                  ? 'bg-emerald-600/20 text-emerald-400'
                  : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'
              }`}
            >
              {mark === 'bold' ? 'B' : mark === 'italic' ? 'I' : 'S̶'}
            </button>
          ))}

          <div className="w-px h-4 bg-slate-800" />

          {([1, 2, 3] as const).map((level) => (
            <button
              key={level}
              onClick={() => editor?.chain().focus().toggleHeading({ level }).run()}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                editor?.isActive('heading', { level })
                  ? 'bg-emerald-600/20 text-emerald-400'
                  : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'
              }`}
            >
              H{level}
            </button>
          ))}

          <button
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              editor?.isActive('blockquote')
                ? 'bg-emerald-600/20 text-emerald-400'
                : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'
            }`}
          >
            ❝
          </button>

          <button
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              editor?.isActive('bulletList')
                ? 'bg-emerald-600/20 text-emerald-400'
                : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'
            }`}
          >
            ≡
          </button>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-slate-600">{wordCount.toLocaleString()} words</span>
            <button
              onClick={loadVersions}
              className="text-xs px-3 py-1.5 border border-slate-700 rounded-lg text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors"
            >
              History
            </button>
            <button
              onClick={saveNow}
              className="text-xs px-3 py-1.5 border border-slate-700 rounded-lg text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors"
            >
              Save now
            </button>
            <span
              className={`text-xs font-medium ${
                saveStatus === 'saved'
                  ? 'text-emerald-500'
                  : saveStatus === 'saving'
                  ? 'text-amber-400'
                  : 'text-slate-600'
              }`}
            >
              {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? 'Saving…' : '● Unsaved'}
            </span>
            <button
              onClick={deleteChapter}
              className="text-xs px-2 py-1.5 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Writing area */}
        <div className="flex-1 overflow-auto bg-slate-950">
          <div className="max-w-2xl mx-auto px-8 py-10">
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                titleRef.current = e.target.value
                setSaveStatus('unsaved')
              }}
              onBlur={saveNow}
              placeholder="Chapter Title"
              className="w-full text-3xl font-bold text-slate-100 border-none outline-none bg-transparent mb-8 placeholder:text-slate-700"
            />
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Right panel — toggle between Comments and AI */}
      <div className="w-80 bg-slate-900/50 border-l border-slate-800/60 flex flex-col shrink-0">
        {/* Panel tab switcher */}
        <div className="flex border-b border-slate-800/60 shrink-0">
          <button
            onClick={() => setRightPanel('comments')}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
              rightPanel === 'comments'
                ? 'text-emerald-400 border-b-2 border-emerald-500'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Comments {activeComments.length > 0 && `(${activeComments.length})`}
          </button>
          <button
            onClick={() => setRightPanel('ai')}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
              rightPanel === 'ai'
                ? 'text-emerald-400 border-b-2 border-emerald-500'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            AI Assistant
          </button>
        </div>

        {/* Comments panel */}
        {rightPanel === 'comments' && (
          <>
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {activeComments.length === 0 && (
                <p className="text-xs text-slate-600 text-center pt-4">No open comments.</p>
              )}
              {activeComments.map((comment) => (
                <div key={comment.id} className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-300">{comment.author}</span>
                    <button
                      onClick={() => resolveComment(comment.id)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                    >
                      Resolve
                    </button>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{comment.text}</p>
                  <p className="text-xs text-slate-600 mt-1.5">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
              {resolvedCount > 0 && (
                <p className="text-xs text-slate-600 text-center pt-1">{resolvedCount} resolved</p>
              )}
            </div>
            <div className="p-3 border-t border-slate-800/60 shrink-0">
              {username && (
                <p className="text-xs text-slate-600 mb-2">
                  As <span className="font-medium text-slate-400">{username}</span>
                </p>
              )}
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addComment()
                }}
                placeholder="Add a comment… (Ctrl+Enter)"
                rows={3}
                className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 mb-2 resize-none text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <button
                onClick={addComment}
                className="w-full py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-500 transition-colors"
              >
                Post Comment
              </button>
            </div>
          </>
        )}

        {/* AI Chat panel */}
        {rightPanel === 'ai' && (
          <>
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {aiMessages.length === 0 && (
                <div className="text-center pt-6 px-2">
                  <p className="text-xs font-semibold text-slate-500 mb-2">AI Writing Assistant</p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    The AI knows your characters, world, and this chapter. Ask it to write, brainstorm, or edit.
                  </p>
                  <div className="mt-4 space-y-1.5">
                    {[
                      'Continue the scene from where it left off',
                      'Suggest what happens next',
                      'Rewrite the last paragraph with more tension',
                      'Does this chapter feel consistent with the characters?',
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setAiInput(suggestion)}
                        className="w-full text-left text-xs px-3 py-2 bg-slate-800/40 hover:bg-emerald-600/10 hover:text-emerald-300 rounded-lg text-slate-500 transition-colors border border-slate-700/60"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {aiMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`text-sm rounded-lg px-3 py-2.5 border ${
                    msg.role === 'user'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-50 ml-4'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300 mr-4'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {msg.content || (aiLoading && i === aiMessages.length - 1 ? '…' : '')}
                  </p>
                </div>
              ))}
              <div ref={aiBottomRef} />
            </div>
            <div className="p-3 border-t border-slate-800/60 shrink-0">
              <textarea
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendAiMessage()
                }}
                placeholder="Ask the AI… (Ctrl+Enter to send)"
                rows={3}
                disabled={aiLoading}
                className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 mb-2 resize-none text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50"
              />
              <div className="flex gap-2">
                <button
                  onClick={sendAiMessage}
                  disabled={aiLoading || !aiInput.trim()}
                  className="flex-1 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {aiLoading ? 'Thinking…' : 'Send'}
                </button>
                {aiMessages.length > 0 && (
                  <button
                    onClick={() => setAiMessages([])}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-800/60 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
