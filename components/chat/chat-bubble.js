import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { User, Bot, Copy, Check, ThumbsUp, ThumbsDown } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// --- KOMPONEN INTERNAL UNTUK CODE BLOCK ---
const CodeBlock = ({ language, value, children }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-gray-700 bg-gray-900 shadow-md">
      {/* HEADER SNIPPET */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          {/* BAGIAN: MAC-STYLE DOTS */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
          </div>
          
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 font-mono ml-1">
            {language || 'code'}
          </span>
        </div>

        {/* BAGIAN: COPY TO CLIPBOARD */}
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

      {/* ISI KODE - DI SINI KITA PAKAI m-0 UNTUK HAPUS MARGIN */}
      <pre className="m-0 p-4 overflow-x-auto text-sm font-mono text-gray-100 leading-relaxed scrollbar-thin scrollbar-thumb-gray-700">
        {children}
      </pre>
    </div>
  )
}

export default function ChatBubble({ role, content }) {
  const isUser = role === 'user'
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn(
      "flex w-full gap-4 p-4 rounded-lg my-2",
      isUser ? "flex-row-reverse" : "bg-white"
    )}>
      <Avatar className={cn(
        "h-8 w-8 flex items-center justify-center shrink-0",
        isUser ? "bg-blue-600 text-white" : "bg-black text-white"
      )}>
        {isUser ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </Avatar>

      <div className={cn(
        "flex flex-col flex-1 overflow-hidden",
        isUser ? "items-end" : "items-start"
      )}>
        {isUser ? (
          /* --- LAYOUT PESAN USER --- */
          <div className="flex flex-row-reverse items-start gap-2 group">
            {/* Bubble Chat */}
            <div className="px-4 py-2.5 rounded-2xl rounded-tr-none text-sm bg-gray-100 text-gray-700 leading-relaxed whitespace-pre-wrap max-w-xl">
              {content}
            </div>
            
            {/* TOMBOL COPY (Samping Kiri Bubble) */}
            <button
              onClick={handleCopy}
              className="mt-2 opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
              title="Copy message"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        ) : (
          /* Gunakan prose-pre:m-0 untuk memastikan Tailwind Typography 
             tidak memaksa margin pada tag pre di dalam markdown.
          */
         <>
          <div className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none w-full prose-p:leading-relaxed prose-pre:m-0">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                ol: ({ children }) => <ol className="list-decimal list-outside mb-3 -ml-2 space-y-1">{children}</ol>,
                ul: ({ children }) => <ul className="list-disc list-outside mb-3 -ml-2 space-y-1">{children}</ul>,
                table: ({ children }) => (
                  <div className="my-2 text-sm overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-left">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-gray-100">
                    {children}
                  </thead>
                ),
                th: ({ children }) => <th className="p-2 align-middle">{children}</th>,
                td: ({ children }) => (
                  <td className="p-2 border-b">
                    {children}
                  </td>
                ),
                
                // --- CUSTOM CODE BLOCK HANDLER ---
                pre: ({ children }) => <>{children}</>, 
                code: ({ node, inline, className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '')
                  const language = match ? match[1] : ''
                  
                  if (!inline && (match || String(children).includes('\n'))) {
                    return (
                      <CodeBlock 
                        language={language} 
                        value={String(children).replace(/\n$/, '')}
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
          <div className="mt-4 flex items-center">
            <button
              onClick={handleCopy}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
              title="Copy response"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
            <button 
              className="p-2 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
              title="Upvote"
            >
              <ThumbsUp className="h-4 w-4"/>
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-all cursor-pointer" title="Downvote">
              <ThumbsDown className="h-4 w-4"/>
            </button>
          </div>
        </>
          
        )}
      </div>
    </div>
  )
}