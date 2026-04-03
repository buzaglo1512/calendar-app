import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const CLIENT_ID     = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

const SCOPE = 'https://www.googleapis.com/auth/calendar openid email profile'

function getBaseUrl(request) {
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

function getRedirectUri(request) {
  return `${getBaseUrl(request)}/api/auth`
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const action  = searchParams.get('action')
  const account = searchParams.get('account') ?? '0'

  // ── LOGIN: redirect to Google OAuth ──────────────────────────
  if (action === 'login') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id',     CLIENT_ID)
    url.searchParams.set('redirect_uri',  getRedirectUri(request))
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope',         SCOPE)
    url.searchParams.set('access_type',   'offline')
    url.searchParams.set('prompt',        'consent select_account')
    url.searchParams.set('state',         account)
    return NextResponse.redirect(url.toString())
  }

  // ── CALLBACK: Google redirects here with ?code= ───────────────
  if (searchParams.get('code')) {
    const code  = searchParams.get('code')
    const state = searchParams.get('state') ?? '0'
    const base  = getBaseUrl(request)

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri:  getRedirectUri(request),
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
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo',
        { headers: { Authorization: `Bearer ${tokens.access_token}` } })
      const user = await userRes.json()
      email = user.email ?? ''
      name  = user.name  ?? ''
    } catch {}

    // Redirect back to app with access token in URL
    const redirectUrl = new URL(`${base}/`)
    redirectUrl.searchParams.set('auth_success', '1')
    redirectUrl.searchParams.set('account', state)
    redirectUrl.searchParams.set('email',   email)
    redirectUrl.searchParams.set('name',    name)
    redirectUrl.searchParams.set('token',   tokens.access_token)

    const response = NextResponse.redirect(redirectUrl.toString())

    // Save refresh token in secure HTTP-only cookie (1 year)
    if (tokens.refresh_token) {
      const cookieStore = await cookies()
      cookieStore.set(`gc_refresh_${state}`, tokens.refresh_token, {
        httpOnly: true,
        secure:   true,
        sameSite: 'lax',
        maxAge:   60 * 60 * 24 * 365,
        path:     '/',
      })
    }

    return response
  }

  // ── REFRESH: get new access token silently ────────────────────
  if (action === 'refresh') {
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
      // Refresh token expired/revoked — clear cookie
      const cookieStore2 = await cookies()
      cookieStore2.delete(`gc_refresh_${account}`)
      return NextResponse.json({ error: 'refresh_failed' }, { status: 401 })
    }

    return NextResponse.json({
      access_token: tokens.access_token,
      expires_in:   tokens.expires_in ?? 3600,
    })
  }

  // ── LOGOUT: clear refresh token cookie ───────────────────────
  if (action === 'logout') {
    const cookieStore = await cookies()
    cookieStore.delete(`gc_refresh_${account}`)
    return NextResponse.json({ ok: true })
  }

  // ── STATUS: check which accounts have refresh tokens ─────────
  if (action === 'status') {
    const cookieStore = await cookies()
    const status = [0, 1, 2].map(i => ({
      index:      i,
      connected:  !!cookieStore.get(`gc_refresh_${i}`)?.value,
    }))
    return NextResponse.json({ accounts: status })
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
}
