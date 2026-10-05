import { useState, useEffect, useRef } from 'react'

interface Message {
  role: 'user' | 'model' | 'system'
  text: string
}

export default function RightPanel() {
  const [chatHistory, setChatHistory] = useState<Message[]>([])
  const [activeModelText, setActiveModelText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadHistory = async () => {
      if ((window as any).iris?.getHistory) {
        try {
          const pastMemories = await (window as any).iris.getHistory()
          console.log({ pastMemories })
          const recentMemories: Message[] = pastMemories.slice(-30).map((m: any) => ({
            role: m.role.toLowerCase() as 'user' | 'model' | 'system',
            text: m.text
          }))
          setChatHistory(recentMemories)
        } catch (err) {
          console.error('Failed to load history', err)
        }
      }
    }
    loadHistory()

    if ((window as any).iris) {
      ;(window as any).iris.onTranscript(
        (data: { role: string; text: string; isFinal: boolean }) => {
          if (data.role === 'user') {
            const newMessage: Message = { role: 'user', text: data.text }
            setChatHistory((prev) => [...prev, newMessage].slice(-30))
          } else if (data.role === 'model') {
            setActiveModelText((prev) => prev + data.text)
          }
        }
      )
      ;(window as any).iris.onTranscriptComplete(() => {
        setActiveModelText((prev) => {
          if (prev.trim().length > 0) {
            const newMessage: Message = { role: 'model', text: prev.trim() }
            setChatHistory((history) => [...history, newMessage].slice(-30))
          }
          return ''
        })
      })
    }
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatHistory, activeModelText])

  return (
    <div className="h-full min-h-0 flex flex-col bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center shrink-0">
        <h2 className="text-sm font-semibold text-white/80 tracking-wide">Conversation</h2>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          <span className="text-xs font-medium text-green-400/90">Live</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 p-4 overflow-y-auto flex flex-col gap-4 scroll-smooth
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-white/10
          [&::-webkit-scrollbar-thumb]:rounded-full
          hover:[&::-webkit-scrollbar-thumb]:bg-green-500/40"
      >
        {chatHistory.length === 0 && activeModelText === '' && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-60">
            <svg
              className="w-12 h-12 text-white/10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-sm text-white/30 font-medium">Waiting for conversation to start…</p>
          </div>
        )}

        {chatHistory.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-lg ${
                msg.role === 'user'
                  ? 'bg-green-600/20 text-green-100 border border-green-500/20 rounded-br-md'
                  : 'bg-white/5 text-gray-200 border border-white/5 rounded-bl-md'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {activeModelText && (
          <div className="flex justify-start">
            <div className="max-w-[80%] p-3.5 rounded-2xl bg-white/5 text-gray-200 border border-white/5 rounded-bl-md text-sm leading-relaxed shadow-lg">
              {activeModelText}
              <span className="inline-block w-1.5 h-4 ml-1 bg-green-400 rounded-full animate-pulse align-middle"></span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}