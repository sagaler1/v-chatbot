import ChatBubble from "./chat-bubble"
import { Loader2 } from "lucide-react"

/**
 * Komponen untuk merender daftar pesan chat.
 * Menangani tampilan kosong dan indikator loading awal.
 */
export default function ChatList({ messages, isLoading, activeModel }) {
  // Tampilan jika belum ada pesan sama sekali
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center space-y-4 animate-in fade-in duration-500">
        <div className="p-4 bg-gray-50 rounded-full border border-gray-100">
           <img src="/vercel.svg" alt="Logo" className="w-12 h-12 opacity-20" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Apa yang bisa saya bantu?</h1>
          <p className="text-gray-500 max-w-sm text-sm mx-auto">
            Gunakan model <span className="font-semibold text-gray-700">{activeModel}</span> untuk memulai percakapan baru.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-32 space-y-2">
      {messages.map((msg, index) => (
        <ChatBubble key={index} role={msg.role} content={msg.content} />
      ))}
      
      {/* Indikator loading saat AI baru mulai memproses (teks masih kosong) */}
      {isLoading && messages[messages.length - 1]?.content === "" && (
        <div className="flex items-center gap-3 text-gray-400 p-4 animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium italic">Mempersiapkan jawaban...</span>
        </div>
      )}
    </div>
  );
}