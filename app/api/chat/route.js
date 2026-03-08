import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import OpenAI from 'openai'

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET)

const openai = new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: process.env.AI_API_ENDPOINT_OPENAI,
})

const FREE_MODEL = 'qwen/qwen3-235b-a22b-thinking-2507'
const CHEAP_MODEL = 'qwen/qwen-turbo'

// ─── ERROR CLASSIFIER ─────────────────────────────────────────────────────────
// Mengubah raw error dari OpenAI/provider jadi pesan yang ramah user
function classifyAIError(error) {
  const status = error?.status || error?.response?.status
  const code = error?.code || error?.error?.code || ''
  const message = (error?.message || '').toLowerCase()

  // Model tidak ditemukan / tidak tersedia
  if (
    status === 404 ||
    code === 'model_not_found' ||
    message.includes('model') && message.includes('not found')
  ) {
    return {
      code: 'MODEL_NOT_FOUND',
      userMessage: 'Model yang dipilih tidak tersedia atau sudah deprecated. Coba ganti model lain.',
      status: 404,
    }
  }

  // Quota / billing habis
  if (
    status === 402 ||
    code === 'insufficient_quota' ||
    message.includes('quota') ||
    message.includes('billing') ||
    message.includes('credit')
  ) {
    return {
      code: 'QUOTA_EXCEEDED',
      userMessage: 'Quota API habis atau ada masalah billing. Hubungi admin.',
      status: 402,
    }
  }

  // Rate limit dari provider
  if (status === 429 || code === 'rate_limit_exceeded' || message.includes('rate limit')) {
    return {
      code: 'PROVIDER_RATE_LIMIT',
      userMessage: 'AI provider lagi overload. Tunggu sebentar lalu coba lagi.',
      status: 429,
    }
  }

  // Context window terlalu panjang
  if (
    code === 'context_length_exceeded' ||
    message.includes('context length') ||
    message.includes('token') && message.includes('exceed')
  ) {
    return {
      code: 'CONTEXT_TOO_LONG',
      userMessage: 'Percakapan ini terlalu panjang untuk model yang dipilih. Mulai chat baru atau ganti ke model dengan context lebih besar.',
      status: 400,
    }
  }

  // Content policy / safety filter
  if (
    status === 400 && (
      code === 'content_filter' ||
      message.includes('content policy') ||
      message.includes('safety') ||
      message.includes('inappropriate')
    )
  ) {
    return {
      code: 'CONTENT_FILTERED',
      userMessage: 'Pesan ini diblokir oleh filter konten AI provider.',
      status: 400,
    }
  }

  // Auth error dari provider
  if (status === 401 || code === 'invalid_api_key' || message.includes('api key')) {
    return {
      code: 'INVALID_API_KEY',
      userMessage: 'API key tidak valid atau sudah expired. Hubungi admin.',
      status: 401,
    }
  }

  // Server error dari provider (5xx)
  if (status >= 500 && status < 600) {
    return {
      code: 'PROVIDER_SERVER_ERROR',
      userMessage: 'Server AI provider lagi bermasalah. Coba lagi dalam beberapa menit.',
      status: 502,
    }
  }

  // Timeout / network
  if (message.includes('timeout') || message.includes('network') || message.includes('econnreset')) {
    return {
      code: 'NETWORK_ERROR',
      userMessage: 'Koneksi ke AI provider timeout. Coba lagi.',
      status: 503,
    }
  }

  // Fallback
  return {
    code: 'UNKNOWN_AI_ERROR',
    userMessage: 'Terjadi error tak terduga saat menghubungi AI. Coba lagi.',
    status: 500,
  }
}

// ─── AUTH HELPER ──────────────────────────────────────────────────────────────
async function getAuthUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY)
    return payload
  } catch {
    return null
  }
}

// ─── BACKGROUND TASK (Auto rename + Summary) ──────────────────────────────────
async function backgroundTask(sessionId, messages) {
  try {
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM messages WHERE session_id = ?',
      [sessionId]
    )

    // Auto rename hanya di pasang pertama (2 pesan: user + assistant)
    if (total <= 2) {
      const firstUserMessage = messages.find(m => m.role === 'user')
      const titleResponse = await openai.chat.completions.create({
        model: CHEAP_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Buat judul singkat maksimal 6 kata tanpa tanda baca untuk percakapan ini berdasarkan pesan user.',
          },
          { role: 'user', content: firstUserMessage.content },
        ],
      })
      const newTitle = titleResponse.choices[0]?.message?.content?.replace(/["']/g, '')
      if (newTitle) {
        await pool.query('UPDATE chat_sessions SET title = ? WHERE id = ?', [newTitle, sessionId])
      }
    }

    // Summary tiap 4+ pesan
    if (total >= 4) {
      const summaryResponse = await openai.chat.completions.create({
        model: FREE_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'Ringkas percakapan ini dalam 1 paragraf agar konteks tetap terjaga. Fokus pada topik utama, informasi dan variabel penting yang sudah dibahas.',
          },
          { role: 'user', content: JSON.stringify(messages) },
        ],
      })
      const summaryText = summaryResponse.choices[0]?.message?.content
      if (summaryText) {
        await pool.query('UPDATE chat_sessions SET summary = ? WHERE id = ?', [summaryText, sessionId])
      }
    }
  } catch (err) {
    // Background task gagal tidak boleh crash main flow
    console.error('Background task error:', err?.message || err)
  }
}

// ─── GET: Load history pesan ──────────────────────────────────────────────────
export async function GET(request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    if (!sessionId) return NextResponse.json({ error: 'Session ID dibutuhkan' }, { status: 400 })

    const [rows] = await pool.query(
      'SELECT role, content, model FROM messages WHERE username = ? AND session_id = ? ORDER BY created_at ASC',
      [user.username, sessionId]
    )

    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET Chat Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// ─── POST: Send message + Streaming ──────────────────────────────────────────
export async function POST(request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { messages, model, sessionId } = body

    // Validasi input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages tidak valid' }, { status: 400 })
    }
    if (!model) {
      return NextResponse.json({ error: 'Model harus dipilih' }, { status: 400 })
    }
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID dibutuhkan' }, { status: 400 })
    }

    const latestMessage = messages[messages.length - 1]

    // Ambil summary dari DB untuk context injection
    const [sessionRows] = await pool.query(
      'SELECT summary FROM chat_sessions WHERE id = ?',
      [sessionId]
    )
    const currentSummary = sessionRows[0]?.summary || null

    // Simpan pesan user ke DB
    await pool.query(
      'INSERT INTO messages (username, role, content, model, session_id) VALUES (?, ?, ?, ?, ?)',
      [user.username, latestMessage.role, latestMessage.content, model, sessionId]
    )

    // Siapkan messages untuk AI dengan context injection
    let aiMessages = []
    if (currentSummary) {
      aiMessages.push({
        role: 'system',
        content: `Ini adalah ringkasan percakapan sebelumnya sebagai konteks: ${currentSummary}. Tetaplah nyambung dengan informasi tersebut.`,
      })
      aiMessages.push(...messages.slice(-4))
    } else {
      aiMessages = messages
    }

    // Request ke AI dengan streaming
    let aiStream
    try {
      aiStream = await openai.chat.completions.create({
        model,
        messages: aiMessages,
        stream: true,
      })
    } catch (aiError) {
      // Tangkap error saat inisialisasi stream (sebelum streaming dimulai)
      console.error('AI init error:', aiError?.message || aiError)
      const classified = classifyAIError(aiError)
      return NextResponse.json(
        {
          success: false,
          error: classified.code,
          message: classified.userMessage,
        },
        { status: classified.status }
      )
    }

    // Buat readable stream untuk dikirim ke client
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let fullAiText = ''
        let hasError = false

        try {
          for await (const chunk of aiStream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              fullAiText += content
              controller.enqueue(encoder.encode(content))
            }

            // Cek finish reason untuk deteksi content filter mid-stream
            const finishReason = chunk.choices[0]?.finish_reason
            if (finishReason === 'content_filter') {
              const notice = '\n\n⚠️ Respons dipotong oleh filter konten AI provider.'
              fullAiText += notice
              controller.enqueue(encoder.encode(notice))
              break
            }
          }
        } catch (streamError) {
          hasError = true
          console.error('Stream mid-error:', streamError?.message || streamError)
          const classified = classifyAIError(streamError)

          // Kalau sudah ada sebagian teks, append error notice
          // Kalau belum ada sama sekali, kirim error message sebagai konten
          const errorNotice = fullAiText
            ? `\n\n⚠️ Stream terputus: ${classified.userMessage}`
            : `⚠️ ${classified.userMessage}`

          controller.enqueue(encoder.encode(errorNotice))
          fullAiText += errorNotice
        } finally {
          // Simpan response AI ke DB (termasuk kalau partial karena error/stop)
          if (fullAiText) {
            try {
              await pool.query(
                'INSERT INTO messages (username, role, content, model, session_id) VALUES (?, ?, ?, ?, ?)',
                [user.username, 'assistant', fullAiText, model, sessionId]
              )

              // Background task hanya kalau tidak error
              if (!hasError) {
                backgroundTask(sessionId, [...messages, { role: 'assistant', content: fullAiText }])
              }
            } catch (dbError) {
              console.error('DB save error:', dbError?.message || dbError)
            }
          }
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (error) {
    console.error('Chat POST error:', error?.message || error)
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Internal server error. Coba lagi.',
      },
      { status: 500 }
    )
  }
}