import { useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { User, Bot, Copy, Check, ThumbsUp, ThumbsDown } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// --- THINKING DOTS ANIMATION ---
const ThinkingDots = () => (
  <div className="flex items-center gap-1.5 py-1 px-1">
    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
  </div>
)

// --- CODE BLOCK COMPONENT ---
const CodeBlock = ({ language, value, children }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-gray-700 bg-gray-900 shadow-md">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 font-mono ml-1">
            {language || "code"}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-white transition-colors cursor-pointer group"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="m-0 p-4 overflow-x-auto text-sm font-mono text-gray-100 leading-relaxed">
        {children}
      </pre>
    </div>
  )
}

// --- MODEL NAME FORMATTER ---
// Ambil nama pendek dari model string, e.g. "google/gemini-2.5-flash" → "Gemini 2.5 Flash"
const formatModelName = (modelString) => {
  if (!modelString) return null
  const parts = modelString.split("/")
  const name = parts[parts.length - 1]
  return name
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

// --- MAIN CHAT BUBBLE ---
export default function ChatBubble({ role, content, model, isThinking = false }) {
  const isUser = role === "user"
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState(null) // 'up' | 'down' | null

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content || "")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn(
        "flex w-full gap-4 p-4 rounded-lg my-2",
        isUser ? "flex-row-reverse" : "bg-white"
      )}
    >
      {/* AVATAR */}
      <Avatar
        className={cn(
          "h-8 w-8 flex items-center justify-center shrink-0",
          isUser ? "bg-blue-600 text-white" : "bg-black text-white"
        )}
      >
        <AvatarFallback className={isUser ? "bg-blue-600" : "bg-black"}>
          {isUser ? (
            <User className="h-5 w-5 text-white" />
          ) : (
            <Bot className="h-5 w-5 text-white" />
          )}
        </AvatarFallback>
      </Avatar>

      {/* CONTENT */}
      <div
        className={cn(
          "flex flex-col flex-1 overflow-hidden",
          isUser ? "items-end" : "items-start"
        )}
      >
        {isUser ? (
          /* --- USER BUBBLE --- */
          <div className="flex flex-row-reverse items-start gap-2 group">
            <div className="px-4 py-2.5 rounded-2xl rounded-tr-none text-sm bg-gray-100 text-gray-700 leading-relaxed whitespace-pre-wrap max-w-xl">
              {content}
            </div>
            <button
              onClick={handleCopy}
              className="mt-2 opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
              title="Copy message"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        ) : (
          /* --- AI BUBBLE --- */
          <>
            {/* Thinking state */}
            {isThinking ? (
              <ThinkingDots />
            ) : (
              <div className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none w-full prose-p:leading-relaxed prose-pre:m-0">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    strong: ({ children }) => (
                      <strong className="font-semibold text-gray-900">{children}</strong>
                    ),
                    p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                    ol: ({ children }) => (
                      <ol className="list-decimal list-outside mb-3 -ml-2 space-y-1">{children}</ol>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-outside mb-3 -ml-2 space-y-1">{children}</ul>
                    ),
                    table: ({ children }) => (
                      <div className="my-2 text-sm overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-left">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-gray-100">{children}</thead>
                    ),
                    th: ({ children }) => <th className="p-2 align-middle">{children}</th>,
                    td: ({ children }) => <td className="p-2 border-b">{children}</td>,
                    pre: ({ children }) => <>{children}</>,
                    code: ({ node, inline, className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || "")
                      const language = match ? match[1] : ""

                      if (!inline && (match || String(children).includes("\n"))) {
                        return (
                          <CodeBlock
                            language={language}
                            value={String(children).replace(/\n$/, "")}
                          >
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </CodeBlock>
                        )
                      }

                      return (
                        <code
                          className="bg-gray-100 text-blue-600 px-1.5 py-0.5 rounded-md text-xs font-mono before:content-none after:content-none border border-gray-200"
                          {...props}
                        >
                          {children}
                        </code>
                      )
                    },
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            )}

            {/* ACTION BAR (copy, feedback, model badge) */}
            {!isThinking && (
              <div className="mt-3 flex items-center gap-1">
                {/* Copy */}
                <button
                  onClick={handleCopy}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-all cursor-pointer text-gray-400 hover:text-gray-600"
                  title="Copy response"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>

                {/* Thumbs Up */}
                <button
                  onClick={() => setFeedback(feedback === "up" ? null : "up")}
                  className={cn(
                    "p-1.5 rounded-lg transition-all cursor-pointer",
                    feedback === "up"
                      ? "text-green-600 bg-green-50"
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  )}
                  title="Good response"
                >
                  <ThumbsUp className="h-4 w-4" />
                </button>

                {/* Thumbs Down */}
                <button
                  onClick={() => setFeedback(feedback === "down" ? null : "down")}
                  className={cn(
                    "p-1.5 rounded-lg transition-all cursor-pointer",
                    feedback === "down"
                      ? "text-red-500 bg-red-50"
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  )}
                  title="Bad response"
                >
                  <ThumbsDown className="h-4 w-4" />
                </button>

                {/* Model Badge */}
                {model && (
                  <span className="ml-1 text-[10px] text-gray-300 font-mono border border-gray-100 rounded px-1.5 py-0.5 select-none">
                    {formatModelName(model)}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}