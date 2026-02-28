import { NextResponse } from 'next/server'
 
export function middleware(request) {
  const token = request.cookies.get('auth_token')?.value
  const { pathname } = request.nextUrl

  // 1. Kalau user belum login (gak ada token) dan mau akses halaman utama (bukan login/api)
  // Redirect ke /login
  if (!token && pathname !== '/login' && !pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. Kalau user SUDAH login tapi mau akses halaman /login
  // Redirect balik ke dashboard/chat (/)
  if (token && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}
 
// Tentukan path mana aja yang kena middleware ini
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}