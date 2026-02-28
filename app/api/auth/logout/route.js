import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  
  // Hapus cookie auth_token
  cookieStore.delete('auth_token')

  return NextResponse.json({ success: true, message: 'Logged out successfully' })
}