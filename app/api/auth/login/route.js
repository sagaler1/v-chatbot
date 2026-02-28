import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { cookies } from 'next/headers'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs' // Import bcrypt

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET)

export async function POST(request) {
  try {
    const { username, password } = await request.json()

    // 1. Cari user berdasarkan username saja dulu
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Username atau password salah' }, 
        { status: 401 }
      )
    }

    const user = rows[0]

    // 2. Bandingkan password input dengan hash di DB
    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      return NextResponse.json(
        { success: false, message: 'Username atau password salah' }, 
        { status: 401 }
      )
    }

    // 3. Jika cocok, buat JWT
    const token = await new SignJWT({ 
        id: user.id, 
        username: user.username 
      })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1d')
      .sign(SECRET_KEY)

    const cookieStore = await cookies()
    
    cookieStore.set('auth_token', token, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24
    })

    return NextResponse.json({ 
      success: true, 
      user: { username: user.username } 
    })

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal Server Error' }, 
      { status: 500 }
    )
  }
}