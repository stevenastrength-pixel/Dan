'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  author?: string
}

// Module-level — survives component remounts for the lifetime of the browser session
let _messages: ChatMessage[] = []
let _streaming = false

type ChatContextType = {
  messages: ChatMessage[]
  setMessages: (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void
  streaming: boolean
  setStreaming: (updater: boolean | ((prev: boolean) => boolean)) => void
}

const ChatContext = createContext<ChatContextType | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessagesState] = useState<ChatMessage[]>(_messages)
  const [streaming, setStreamingState] = useState<boolean>(_streaming)

  const setMessages = useCallback(
    (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      setMessagesState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        _messages = next
        return next
      })
    },
    []
  )

  const setStreaming = useCallback(
    (updater: boolean | ((prev: boolean) => boolean)) => {
      setStreamingState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        _streaming = next
        return next
      })
    },
    []
  )

  return (
    <ChatContext.Provider value={{ messages, setMessages, streaming, setStreaming }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider')
  return ctx
}
