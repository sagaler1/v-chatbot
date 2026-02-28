'use client'

import { useState, useRef, useEffect } from "react"
import Sidebar from "@/components/chat/sidebar"
import Header from "@/components/chat/header"
import ChatBubble from "@/components/chat/chat-bubble"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { 
  Send, 
  Loader2, 
  Paperclip, 
  ChevronDown, 
  Sparkles 
} from "lucide-react"
import { cn } from "@/lib/utils"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"

const AIModels = [
  {model: 'openai/gpt-5.2', provider: 'OpenAI', name: 'GPT 5.2'},
  {model: 'anthropic/claude-opus-4-6', provider: 'Anthropic', name: 'Claude Opus 4.6'},
  {model: 'anthropic/claude-sonnet-4-6', provider: 'Anthropic', name: 'Claude Sonnet 4.6'},
  {model: 'anthropic/claude-haiku-4-5', provider: 'Anthropic', name: 'Claude Haiku 4.5'},
  {model: 'google/gemini-3-flash-preview', provider: 'Google', name: 'Gemini 3 Flash'},
  {model: 'google/gemini-2.5-flash', provider: 'Google', name: 'Gemini 2.5 Flash'},
  {model: 'google/gemini-2.0-flash', provider: 'Google', name: 'Gemini 2.0 Flash'},
  {model: 'qwen/qwen3.5-flash-02-23', provider: 'Qwen', name: 'Qwen 3.5 Flash'},
  {model: 'x-ai/grok-4-1-fast-non-reasoning', provider: 'xAI', name: 'Grok 4.1 Fast NR'},
]

export default function Home() {
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [activeModel, setActiveModel] = useState("google/gemini-2.5-flash")
  
  // Mencari data model yang sedang aktif untuk ditampilkan di UI
  const currentModelData = AIModels.find((item) => item.model === activeModel)
  
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const isCreatingSession = useRef(false)

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions')
      const data = await res.json()
      setSessions(data)
    } catch (error) {
      console.error("Gagal load history:", error)
    }
  }

  useEffect(() => {
    if (activeSessionId && !isCreatingSession.current) {
      loadMessagesForSession(activeSessionId)
    } else if (!activeSessionId) {
      setMessages([])
    }
    isCreatingSession.current = false
  }, [activeSessionId])

  // --- BAGIAN YANG DIUPDATE ---
  const loadMessagesForSession = async (id) => {
    try {
      const res = await fetch(`/api/chat?sessionId=${id}`)
      const data = await res.json() // Data ini berisi array pesan
      setMessages(data)

      // LOGIKA: Ambil model dari pesan terakhir jika ada
      if (data && data.length > 0) {
        // Kita ambil pesan paling terakhir
        const lastMessage = data[data.length - 1]
        
        // Cek apakah kolom 'model' ada nilainya di database
        if (lastMessage.model) {
          console.log("Switching model to:", lastMessage.model)
          setActiveModel(lastMessage.model)
        }
      }
    } catch (error) {
      console.error("Gagal load chat:", error)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }
  
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
  }, [input])

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!input.trim() || isLoading) return

    const userText = input
    setInput("")
    setIsLoading(true)
    
    const currentMessages = [...messages, { role: "user", content: userText }]
    setMessages([...currentMessages, { role: "assistant", content: "" }])
    
    try {
      let currentSession = activeSessionId
      if (!currentSession) {
        isCreatingSession.current = true
        const sessionRes = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: userText.substring(0, 30) + '...' }) 
        })
        const sessionData = await sessionRes.json()
        currentSession = sessionData.id
        setActiveSessionId(currentSession)
        fetchSessions()
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMessages,
          model: activeModel, // Menggunakan model yang sedang aktif di state
          sessionId: currentSession
        })
      })

      if (!res.ok) throw new Error("Gagal mengambil response")

      const reader = res.body.getReader()
      const decoder = new TextDecoder("utf-8")
      let done = false
      let accumulatedAiText = ""

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) {
          const chunkValue = decoder.decode(value)
          accumulatedAiText += chunkValue
          setMessages((prev) => {
            const updated = [...prev]
            if (updated.length > 0) {
              updated[updated.length - 1].content = accumulatedAiText
            }
            return updated
          })
        }
      }
      
    } catch (error) {
      console.error("Stream Error:", error)
      setMessages((prev) => {
        const updated = [...prev]
        if (updated.length > 0) {
          updated[updated.length - 1].content = "Waduh, koneksi AI-nya putus Bro."
        }
        return updated
      })
    } finally {
      setIsLoading(false)
      isCreatingSession.current = false
      setTimeout(() => fetchSessions(), 2000)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex h-screen w-full flex-col bg-white md:flex-row overflow-hidden">
      <div 
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden border-r bg-gray-50/40 hidden md:block",
          isSidebarOpen ? "w-64" : "w-0 border-none"
        )}
      >
        <Sidebar 
          sessions={sessions} 
          activeSessionId={activeSessionId}
          onSelectSession={(id) => {
            isCreatingSession.current = false
            setActiveSessionId(id)
          }}
          onNewChat={() => setActiveSessionId(null)}
          onRefresh={fetchSessions}
          onDeleteActive={(id) => {
            if (activeSessionId === id) setActiveSessionId(null)
          }}
          className="w-64 border-none" 
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header 
          isSidebarOpen={isSidebarOpen}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <main className="flex-1 overflow-auto p-4 md:p-6 bg-white text-gray-900">
          <div className="mx-auto max-w-3xl">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 text-gray-900">
                <h1 className="text-2xl font-bold tracking-tight">AI Chat Assistant</h1>
                <p className="text-gray-500">Mulai chat baru atau pilih history di samping.</p>
              </div>
            ) : (
              <div className="pb-4">
                {messages.map((msg, index) => (
                  <ChatBubble key={index} role={msg.role} content={msg.content} />
                ))}
                {isLoading && (
                  <div className="flex items-center gap-2 text-gray-400 p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">AI lagi mikir...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </main>

        <div className="pb-4 bg-transparent">
          <div className="mx-4 md:mx-auto max-w-3xl relative text-gray-900">
            <form onSubmit={handleSubmit} className="w-full overflow-hidden rounded-xl border border-border bg-background p-3 shadow-xs transition-all duration-200 focus-within:border-border hover:border-muted-foreground/50">
              <div className="flex flex-row items-start gap-1 sm:gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ketik pesan di sini... "
                  rows={1}
                  className="flex min-h-20 border ring-offset-background focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm w-full rounded-none shadow-none outline-hidden field-sizing-fixed dark:bg-transparent grow resize-none border-none! bg-transparent p-2 text-base outline-none ring-0 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-scrollbar]:hidden text-gray-900"
                  disabled={isLoading}
                />
              </div>
              
              <div className="flex items-center justify-between p-0 h-8">
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-sm" disabled={isLoading}>
                    <Paperclip className="h-4 w-4 -rotate-45 text-gray-900" />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 gap-1.5 px-2 text-[11px] font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all rounded-md"
                        disabled={isLoading}
                      >
                        <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-gray-900">{currentModelData ? currentModelData.name : "Unknown Model"}</span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuLabel className="text-xs">Model Intelligence</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {AIModels.map((item, idx) => (
                        <DropdownMenuItem key={`ai-models-${idx}`} className="text-xs cursor-pointer" onClick={() => setActiveModel(item.model)}>
                          {item.name} <span className="ml-auto text-[10px] text-muted-foreground">{item.provider}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <Button type="submit" size="icon" className="h-8 w-8" disabled={!input.trim() || isLoading}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}