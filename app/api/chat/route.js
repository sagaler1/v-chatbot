/* app/api/chat/route.js [versi HTTP router]*/

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

// Model konfigurasi
const PRIMARY_MODEL = 'gpt-4o'                    // Model utama yang mahal/pinter
const CHEAP_MODEL = 'qwen/qwen-turbo'    // Model murah buat ringkas & judul

// Helper untuk verifikasi token
async function getAuthUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, SECRET_KEY)
    return payload
  } catch (err) {
    return null
  }
}

// --- HELPER: AUTO RENAME & SUMMARY ---
async function backgroundTask(sessionId, messages, username) {
  try {
    // Cek jumlah pesan di DB untuk session ini (lebih reliable dari messages array)
    // karena messages dari frontend selalu full history, bisa misleading
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM messages WHERE session_id = ?',
      [sessionId]
    )

    // 1. AUTO RENAME (Hanya jika ini pasang pertama = 2 pesan: user + assistant)
    if (total <= 2) {
      const firstUserMessage = messages.find(m => m.role === 'user')
      const titleResponse = await openai.chat.completions.create({
        model: CHEAP_MODEL,
        messages: [
          { role: 'system', content: 'Buat judul singkat (maksimal 4 kata) tanpa tanda baca untuk percakapan ini berdasarkan pesan user.' },
          { role: 'user', content: firstUserMessage.content }
        ]
      })
      const newTitle = titleResponse.choices[0]?.message?.content?.replace(/["']/g, "")
      await pool.query('UPDATE chat_sessions SET title = ? WHERE id = ?', [newTitle, sessionId])
    }

    // 2. SUMMARY (Jika total pesan di DB >= 4)
    if (total >= 4) {
      const summaryResponse = await openai.chat.completions.create({
        model: 'upstage/solar-pro-3:free',
        messages: [
          { role: 'system', content: 'Ringkas percakapan ini dalam 1 paragraf agar konteks tetap terjaga. Fokus pada topik utama, informasi dan variabel penting yang sudah dibahas.' },
          { role: 'user', content: JSON.stringify(messages) }
        ]
      })
      const summaryText = summaryResponse.choices[0]?.message?.content
      await pool.query('UPDATE chat_sessions SET summary = ? WHERE id = ?', [summaryText, sessionId])
    }
  } catch (err) {
    console.error("Background task error:", err)
  }
}

// GET: Tarik history pesan berdasarkan Session ID
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
    console.error("GET Chat Error:", error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { messages, model, sessionId } = body
    const latestMessage = messages[messages.length - 1]

    // Ambil summary lama (jika ada) dari database
    const [sessionRows] = await pool.query('SELECT summary FROM chat_sessions WHERE id = ?', [sessionId])
    const currentSummary = sessionRows[0]?.summary || null

    // 1. Simpan pesan USER ke MySQL menggunakan username asli dari JWT
    await pool.query(
      'INSERT INTO messages (username, role, content, model, session_id) VALUES (?, ?, ?, ?, ?)',
      [user.username, latestMessage.role, latestMessage.content, model, sessionId]
    )

    // 2. Siapkan Messages untuk AI (Context Injection)
    let aiMessages = []
    if (currentSummary) {
      aiMessages.push({ 
        role: 'system', 
        content: `Ini adalah ringkasan percakapan sebelumnya sebagai konteks: ${currentSummary}. Tetaplah nyambung dengan informasi tersebut.` 
      })
      // Hanya kirim 4 pesan terakhir supaya context window irit
      aiMessages.push(...messages.slice(-4))
    } else {
      aiMessages = messages
    }

    // Custom HTTP Request ke AI Provider
    // const aiProviderUrl = process.env.AI_API_ENDPOINT
    // const apiKey = process.env.AI_API_KEY

    // 3. Request ke AI Utama (Streaming)
    const response = await openai.chat.completions.create({
      model: model,
      messages: aiMessages,
      stream: true,
    })

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let fullAiText = ''

        try {
          for await (const chunk of response) {
            const content =  chunk.choices[0]?.delta?.content || ""
            if (content) {
              fullAiText += content
              controller.enqueue(encoder.encode(content))
            }
          }
        } finally {
          // 4. Setelah stream selesai, simpan respon AI ke MySQL
          if (fullAiText) {
            await pool.query(
              'INSERT INTO messages (username, role, content, model, session_id) VALUES (?, ?, ?, ?, ?)',
              [user.username, 'assistant', fullAiText, model, sessionId]
            )
            // 5. Jalankan Background Task (Rename & Summary) tanpa menghambat response
            // Kita kirim full history ke helper
            backgroundTask(sessionId, [...messages, { role: 'assistant', content: fullAiText}], user.username)
          }
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    })

  } catch (error) {
    console.error('Chat POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}