import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET);

// Helper untuk verifikasi token dan ambil data user
async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload; // Mengembalikan { id, username, ... }
  } catch (err) {
    return null;
  }
}

// PUT: Ganti Nama Sesi
export async function PUT(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const sessions = await params
    const sessionId = sessions.id;
    const body = await request.json();
    const { title } = body;

    await pool.query(
      'UPDATE chat_sessions SET title = ? WHERE id = ? AND username = ?',
      [title, sessionId, user.username]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Rename Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE: Hapus Sesi dan Semua Pesannya
export async function DELETE(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const sessions = await params
    const sessionId = sessions.id;

    // Hapus pesan terkait dulu
    await pool.query('DELETE FROM messages WHERE session_id = ? AND username = ?', [sessionId, user.username]);
    
    // Hapus sesi-nya
    await pool.query('DELETE FROM chat_sessions WHERE id = ? AND username = ?', [sessionId, user.username]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}