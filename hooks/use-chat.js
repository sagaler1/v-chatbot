import { useState } from 'react'

/**
 * Hook kustom untuk menangani logika chat, streaming, dan state pesan.
 * @param {Object} options - Konfigurasi hook
 * @param {string|number} options.sessionId - ID sesi chat saat ini
 * @param {string} options.activeModel - Model AI yang dipilih
 */
export function useChat({ sessionId, activeModel }) {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  // Fungsi untuk mengirim pesan baru
  const append = async (content) => {
    if (isLoading || !content.trim()) return

    const userMessage = { role: 'user', content }
    // Tambahkan pesan user dan placeholder untuk AI
    const newMessages = [...messages, userMessage]
    setMessages([...newMessages, { role: 'assistant', content: '' }])
    setIsLoading(true)

    try {
      // Panggil API chat (streaming)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          model: activeModel,
          sessionId: sessionId
        })
      })

      if (!res.ok) throw new Error("Gagal mengambil respon dari AI")

      const reader = res.body.getReader()
      const decoder = new TextDecoder("utf-8")
      let done = false
      let accumulatedText = ""

      // Baca stream per chunk
      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) {
          const chunkValue = decoder.decode(value)
          accumulatedText += chunkValue

          // Update pesan AI (pesan terakhir di array) secara real-time
          setMessages((prev) => {
            const updated = [...prev]
            if (updated.length > 0) {
              updated[updated.length - 1].content = accumulatedText
            }
            return updated
          })
        }
      }
    } catch (error) {
      console.error("Chat Streaming Error:", error)
      setMessages((prev) => {
        const updated = [...prev]
        if (updated.length > 0) {
          updated[updated.length - 1].content = "Waduh Bro, ada masalah koneksi ke AI-nya."
        }
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }

  return {
    messages,
    setMessages,
    isLoading,
    append
  }
}