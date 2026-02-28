import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET)

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

// GET: Ambil semua list history chat buat Sidebar
export async function GET(request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [rows] = await pool.query(
      'SELECT * FROM chat_sessions WHERE username = ? ORDER BY created_at DESC',
      [user.username]
    )

    return NextResponse.json(rows)
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST: Bikin session baru pas user pertama kali ngechat di room baru
export async function POST(request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const title = body.title || 'New Chat'

    const [result] = await pool.query(
      'INSERT INTO chat_sessions (username, title) VALUES (?, ?)',
      [user.username, title]
    );

    return NextResponse.json({ id: result.insertId, title })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}