'use client'

import { useState, useRef, useEffect, useCallback } from "react"
import Sidebar from "@/components/chat/sidebar"
import Header from "@/components/chat/header"
import ChatBubble from "@/components/chat/chat-bubble"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Send,
  Square,
  Paperclip,
  ChevronDown,
  Sparkles,
  Code2,
  Bug,
  FileText,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const AIModels = [
  { model: "openai/gpt-5.2", provider: "OpenAI", name: "GPT 5.2" },
  { model: "anthropic/claude-opus-4-6", provider: "Anthropic", name: "Claude Opus 4.6" },
  { model: "anthropic/claude-sonnet-4-6", provider: "Anthropic", name: "Claude Sonnet 4.6" },
  { model: "anthropic/claude-haiku-4-5", provider: "Anthropic", name: "Claude Haiku 4.5" },
  { model: "google/gemini-3-flash-preview", provider: "Google", name: "Gemini 3 Flash" },
  { model: "google/gemini-2.5-flash", provider: "Google", name: "Gemini 2.5 Flash" },
  { model: "google/gemini-2.0-flash", provider: "Google", name: "Gemini 2.0 Flash" },
  { model: "qwen/qwen3.5-flash-02-23", provider: "Qwen", name: "Qwen 3.5 Flash" },
  { model: "x-ai/grok-4-1-fast-non-reasoning", provider: "xAI", name: "Grok 4.1 Fast NR" },
]

const SUGGESTED_PROMPTS = [
  {
    icon: Code2,
    label: "Explain Code",
    text: "Jelaskan konsep React Server Components dan kapan harus menggunakannya",
  },
  {
    icon: Bug,
    label: "Debug",
    text: "Bantu debug kode ini dan jelaskan kenapa error-nya bisa terjadi",
  },
  {
    icon: FileText,
    label: "Template",
    text: "Buatkan template README.md yang lengkap untuk GitHub project",
  },
  {
    icon: Zap,
    label: "Optimize",
    text: "Cara terbaik optimize performa Next.js app untuk production",
  },
]

export default function Home() {
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [activeModel, setActiveModel] = useState("google/gemini-2.5-flash")

  // Smart scroll state
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const currentModelData = AIModels.find((item) => item.model === activeModel)

  const messagesEndRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const textareaRef = useRef(null)
  const isCreatingSession = useRef(false)
  const abortControllerRef = useRef(null) // For stop generation

  // ─── SESSIONS ────────────────────────────────────────────────
  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/sessions")
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

  const loadMessagesForSession = async (id) => {
    try {
      const res = await fetch(`/api/chat?sessionId=${id}`)
      const data = await res.json()
      setMessages(data)
      if (data && data.length > 0) {
        const lastMessage = data[data.length - 1]
        if (lastMessage.model) {
          setActiveModel(lastMessage.model)
        }
      }
    } catch (error) {
      console.error("Gagal load chat:", error)
    }
  }

  // ─── SMART SCROLL ─────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const threshold = 120
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    setIsAtBottom(atBottom)
    setShowScrollBtn(!atBottom)
  }, [])

  useEffect(() => {
    if (isAtBottom) scrollToBottom()
  }, [messages, isAtBottom, scrollToBottom])

  // ─── TEXTAREA AUTO-RESIZE ─────────────────────────────────────
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = "auto"
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px"
  }, [input])

  // ─── STOP GENERATION ─────────────────────────────────────────
  const handleStop = () => {
    abortControllerRef.current?.abort()
    setIsLoading(false)
  }

  // ─── SEND MESSAGE ─────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!input.trim() || isLoading) return

    const userText = input
    setInput("")
    setIsLoading(true)
    setIsAtBottom(true) // force scroll to bottom on new message

    const currentMessages = [...messages, { role: "user", content: userText }]
    setMessages([...currentMessages, { role: "assistant", content: "" }])

    try {
      let currentSession = activeSessionId
      if (!currentSession) {
        isCreatingSession.current = true
        const sessionRes = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: userText.substring(0, 30) + "..." }),
        })
        const sessionData = await sessionRes.json()
        currentSession = sessionData.id
        setActiveSessionId(currentSession)
        fetchSessions()
      }

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController()

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          messages: currentMessages,
          model: activeModel,
          sessionId: currentSession,
        }),
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
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: accumulatedAiText,
                model: activeModel,
              }
            }
            return updated
          })
        }
      }
    } catch (error) {
      // Ignore abort errors (user stopped generation)
      if (error.name === "AbortError") {
        setMessages((prev) => {
          const updated = [...prev]
          if (updated.length > 0 && updated[updated.length - 1].content === "") {
            // Remove empty assistant bubble if stopped before any content
            return updated.slice(0, -1)
          }
          return updated
        })
      } else {
        console.error("Stream Error:", error)
        setMessages((prev) => {
          const updated = [...prev]
          if (updated.length > 0) {
            updated[updated.length - 1].content = "Waduh, koneksi AI-nya putus Bro."
          }
          return updated
        })
      }
    } finally {
      setIsLoading(false)
      isCreatingSession.current = false
      setTimeout(() => fetchSessions(), 2000)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // ─── SUGGESTED PROMPT CLICK ───────────────────────────────────
  const handleSuggestedPrompt = (text) => {
    setInput(text)
    textareaRef.current?.focus()
  }

  return (
    <div className="flex h-screen w-full flex-col bg-white md:flex-row overflow-hidden">
      {/* SIDEBAR */}
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

      {/* MAIN */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          isSidebarOpen={isSidebarOpen}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* MESSAGES AREA */}
        <main
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto p-4 md:p-6 bg-white text-gray-900"
        >
          <div className="mx-auto max-w-3xl">
            {messages.length === 0 ? (
              /* ── EMPTY STATE ── */
              <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-8">
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    Apa yang bisa dibantu?
                  </h1>
                  <p className="text-gray-400 text-sm">
                    Pilih salah satu atau ketik pesan sendiri
                  </p>
                </div>

                {/* Suggested Prompts Grid */}
                <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                  {SUGGESTED_PROMPTS.map((p, i) => {
                    const Icon = p.icon
                    return (
                      <button
                        key={i}
                        onClick={() => handleSuggestedPrompt(p.text)}
                        className="text-left p-3.5 rounded-xl border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all text-sm flex items-start gap-3 group cursor-pointer"
                      >
                        <Icon className="h-4 w-4 text-gray-400 group-hover:text-gray-700 mt-0.5 shrink-0 transition-colors" />
                        <div>
                          <div className="font-medium text-gray-700 text-xs mb-0.5">{p.label}</div>
                          <div className="text-gray-400 text-xs leading-relaxed line-clamp-2">{p.text}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              /* ── MESSAGES LIST ── */
              <div className="pb-4">
                {messages.map((msg, index) => {
                  // Detect thinking state: last message, assistant, empty content, still loading
                  const isThinking =
                    isLoading &&
                    index === messages.length - 1 &&
                    msg.role === "assistant" &&
                    msg.content === ""

                  return (
                    <ChatBubble
                      key={index}
                      role={msg.role}
                      content={msg.content}
                      model={msg.role === "assistant" ? msg.model || activeModel : null}
                      isThinking={isThinking}
                    />
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </main>

        {/* SCROLL TO BOTTOM BUTTON */}
        {showScrollBtn && (
          <div className="absolute bottom-28 right-6 z-10">
            <button
              onClick={scrollToBottom}
              className="p-2.5 bg-white border border-gray-200 rounded-full shadow-lg hover:shadow-xl hover:border-gray-300 transition-all text-gray-500 hover:text-gray-800 cursor-pointer"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* INPUT AREA */}
        <div className="pb-4 bg-transparent">
          <div className="mx-4 md:mx-auto max-w-3xl relative text-gray-900">
            <form
              onSubmit={handleSubmit}
              className="w-full overflow-hidden rounded-xl border border-border bg-background p-3 shadow-xs transition-all duration-200 focus-within:border-border hover:border-muted-foreground/50"
            >
              <div className="flex flex-row items-start gap-1 sm:gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ketik pesan di sini..."
                  rows={1}
                  className="flex min-h-20 border ring-offset-background focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm w-full rounded-none shadow-none outline-hidden field-sizing-fixed dark:bg-transparent grow resize-none border-none! bg-transparent p-2 text-base outline-none ring-0 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-scrollbar]:hidden text-gray-900"
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center justify-between p-0 h-8">
                <div className="flex items-center gap-1">
                  {/* Attachment (placeholder) */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-sm"
                    disabled={isLoading}
                  >
                    <Paperclip className="h-4 w-4 -rotate-45 text-gray-900" />
                  </Button>

                  {/* Model Selector */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 px-2 text-[11px] font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all rounded-md"
                        disabled={isLoading}
                      >
                        <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-gray-900">
                          {currentModelData ? currentModelData.name : "Unknown Model"}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuLabel className="text-xs">Model Intelligence</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {AIModels.map((item, idx) => (
                        <DropdownMenuItem
                          key={`ai-models-${idx}`}
                          className="text-xs cursor-pointer"
                          onClick={() => setActiveModel(item.model)}
                        >
                          {item.name}
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {item.provider}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Character counter + Send/Stop */}
                <div className="flex items-center gap-2">
                  {input.length > 0 && !isLoading && (
                    <span className="text-[10px] text-gray-500 tabular-nums">
                      {input.length}
                    </span>
                  )}

                  {/* STOP button saat loading, SEND saat idle */}
                  {isLoading ? (
                    <Button
                      type="button"
                      size="icon"
                      className="h-8 w-8 bg-gray-900 hover:bg-gray-700"
                      onClick={handleStop}
                      title="Stop generation"
                    >
                      <Square className="h-3 w-3 fill-white text-white" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="icon"
                      className="h-8 w-8"
                      disabled={!input.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}