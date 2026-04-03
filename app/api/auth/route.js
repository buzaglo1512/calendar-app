import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const CLIENT_ID     = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const SCOPE = 'https://www.googleapis.com/auth/calendar openid email profile'

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   true,
  sameSite: 'lax',
  maxAge:   60 * 60 * 24 * 365, // 1 year
  path:     '/',
}

function baseUrl(request) {
  const u = new URL(request.url)
  return `${u.protocol}//${u.host}`
}

function redirectUri(request) {
  return `${baseUrl(request)}/api/auth`
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const action  = searchParams.get('action')
  const account = searchParams.get('account') ?? '0'

  // ── LOGIN ─────────────────────────────────────────────────────
  if (action === 'login') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id',     CLIENT_ID)
    url.searchParams.set('redirect_uri',  redirectUri(request))
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope',         SCOPE)
    url.searchParams.set('access_type',   'offline')
    url.searchParams.set('prompt',        'consent select_account')
    url.searchParams.set('state',         account)
    return NextResponse.redirect(url.toString())
  }

  // ── CALLBACK ──────────────────────────────────────────────────
  if (searchParams.get('code')) {
    const code  = searchParams.get('code')
    const state = searchParams.get('state') ?? '0'
    const base  = baseUrl(request)

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri:  redirectUri(request),
        grant_type:    'authorization_code',
      }),
    })
    const tokens = await tokenRes.json()

    if (!tokens.access_token) {
      return NextResponse.redirect(`${base}/?auth_error=1`)
    }

    // Get user info
    let email = '', name = ''
    try {
      const u = await fetch('https://www.googleapis.com/oauth2/v3/userinfo',
        { headers: { Authorization: `Bearer ${tokens.access_token}` } })
      const user = await u.json()
      email = user.email ?? ''
      name  = user.name  ?? ''
    } catch {}

    // Build redirect back to app
    const dest = new URL(`${base}/`)
    dest.searchParams.set('auth_success', '1')
    dest.searchParams.set('account', state)
    dest.searchParams.set('email',   email)
    dest.searchParams.set('name',    name)
    dest.searchParams.set('token',   tokens.access_token)

    // ✅ Set cookie on the RESPONSE (correct Next.js 15 way)
    const response = NextResponse.redirect(dest.toString())
    if (tokens.refresh_token) {
      response.cookies.set(`gc_refresh_${state}`, tokens.refresh_token, COOKIE_OPTS)
    }
    return response
  }

  // ── REFRESH ───────────────────────────────────────────────────
  if (action === 'refresh') {
    // ✅ Read cookie from request (correct Next.js 15 way)
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get(`gc_refresh_${account}`)?.value

    if (!refreshToken) {
      return NextResponse.json({ error: 'no_refresh_token' }, { status: 401 })
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }),
    })
    const tokens = await tokenRes.json()

    if (!tokens.access_token) {
      // Revoked — clear cookie
      const res = NextResponse.json({ error: 'refresh_failed' }, { status: 401 })
      res.cookies.delete(`gc_refresh_${account}`)
      return res
    }

    return NextResponse.json({ access_token: tokens.access_token })
  }

  // ── LOGOUT ────────────────────────────────────────────────────
  if (action === 'logout') {
    const res = NextResponse.json({ ok: true })
    res.cookies.delete(`gc_refresh_${account}`)
    return res
  }

  // ── STATUS ────────────────────────────────────────────────────
  if (action === 'status') {
    const cookieStore = await cookies()
    const accounts = [0, 1, 2].map(i => ({
      index:     i,
      connected: !!cookieStore.get(`gc_refresh_${i}`)?.value,
    }))
    return NextResponse.json({ accounts })
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
}
