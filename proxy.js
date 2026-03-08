import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET)

// ─── IN-MEMORY RATE LIMIT STORE ───────────────────────────────────────────────
// Map struktur: username → { count: number, windowStart: timestamp }
const rateLimitStore = new Map()

const RATE_LIMIT_CONFIG = {
  // Endpoint chat lebih ketat karena mahal
  '/api/chat': { maxRequests: 30, windowMs: 60 * 1000 },        // 30 req/menit
  // Endpoint sessions lebih longgar
  '/api/sessions': { maxRequests: 60, windowMs: 60 * 1000 },    // 60 req/menit
  // Default untuk endpoint lain
  default: { maxRequests: 60, windowMs: 60 * 1000 },
}

function getRateLimitConfig(pathname) {
  // Match exact atau prefix
  for (const [path, config] of Object.entries(RATE_LIMIT_CONFIG)) {
    if (path !== 'default' && pathname.startsWith(path)) return config
  }
  return RATE_LIMIT_CONFIG.default
}

function checkRateLimit(identifier, pathname) {
  const config = getRateLimitConfig(pathname)
  const key = `${identifier}:${pathname.split('/').slice(0, 3).join('/')}` // group by base path
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now - record.windowStart > config.windowMs) {
    // Window baru atau expired → reset
    rateLimitStore.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: config.maxRequests - 1, limit: config.maxRequests }
  }

  if (record.count >= config.maxRequests) {
    const retryAfter = Math.ceil((config.windowMs - (now - record.windowStart)) / 1000)
    return { allowed: false, remaining: 0, limit: config.maxRequests, retryAfter }
  }

  record.count++
  return { allowed: true, remaining: config.maxRequests - record.count, limit: config.maxRequests }
}

// Cleanup store tiap 5 menit biar nggak bocor memori
// (hanya jalan di edge runtime kalau interval didukung — di Node runtime aman)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitStore.entries()) {
      // Hapus entry yang sudah lebih dari 2 menit tidak aktif
      if (now - record.windowStart > 2 * 60 * 1000) {
        rateLimitStore.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

// ─── MIDDLEWARE ────────────────────────────────────────────────────────────────
export async function proxy(request) {
  const token = request.cookies.get('auth_token')?.value
  const { pathname } = request.nextUrl

  // 1. Auth guard — redirect ke /login kalau belum login
  if (!token && pathname !== '/login' && !pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. Kalau sudah login tapi buka /login → redirect ke home
  if (token && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 3. Rate limiting — hanya untuk API routes yang butuh auth
  if (token && pathname.startsWith('/api/') && !pathname.startsWith('/api/auth')) {
    let username = 'anonymous'

    // Decode token untuk dapat username sebagai identifier
    try {
      const { payload } = await jwtVerify(token, SECRET_KEY)
      username = payload.username || payload.id || 'anonymous'
    } catch {
      // Token invalid → biarkan route handler yang handle 401
    }

    const result = checkRateLimit(username, pathname)

    if (!result.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Terlalu banyak request. Coba lagi dalam ${result.retryAfter} detik.`,
          retryAfter: result.retryAfter,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': '0',
            'Retry-After': String(result.retryAfter),
          },
        }
      )
    }

    // Inject rate limit headers ke response normal
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Limit', String(result.limit))
    response.headers.set('X-RateLimit-Remaining', String(result.remaining))
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}