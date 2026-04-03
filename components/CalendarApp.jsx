'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { formatHebrewDate, formatHebrewDayShort, getHoliday } from './hebrewCalendar'

// =====================================================================
// Constants
// =====================================================================
const DAYS_SHORT  = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
const DAY_PREFIX  = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת']
const MONTHS      = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
// Tiberias fixed coordinates (lat, lng)
const TIBERIAS = { lat: 32.794, lng: 35.530 }

// 3 accounts: אלירן=green, לילך=pink/purple, טאבלט=blue
const ACCOUNTS_CONFIG = [
  { name: 'אלירן',  color: '#16a34a' },
  { name: 'לילך',   color: '#db2777' },
  { name: 'טאבלט', color: '#2563eb' },
]
const ACCT_COLORS = ACCOUNTS_CONFIG.map(a => a.color)
const WEEK_HEB    = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

const WMO = {
  0: { icon: '☀️', label: 'שמשי',        anim: 'spin-slow' },
  1: { icon: '🌤️',label: 'בהיר בעיקר',  anim: 'float'     },
  2: { icon: '⛅', label: 'מעורב',        anim: 'float'     },
  3: { icon: '☁️', label: 'מעונן',        anim: 'drift'     },
  6: { icon: '🌪️', label: 'אבק',          anim: 'pulse-fade'},
  7: { icon: '🌪️', label: 'אבק',          anim: 'pulse-fade'},
  8: { icon: '🌪️', label: 'סופת אבק',    anim: 'pulse-fade'},
  9: { icon: '🌪️', label: 'סופת אבק',    anim: 'pulse-fade'},
 45: { icon: '🌫️',label: 'אובך',         anim: 'pulse-fade'},
 48: { icon: '🌫️',label: 'אובך כבד',     anim: 'pulse-fade'},
 51: { icon: '🌦️',label: 'ממטר קל',      anim: 'rain-drip' },
 53: { icon: '🌧️',label: 'ממטר',         anim: 'rain-drip' },
 61: { icon: '🌧️',label: 'גשם קל',       anim: 'rain-drip' },
 63: { icon: '🌧️',label: 'גשם',          anim: 'rain-drip' },
 65: { icon: '🌧️',label: 'גשם כבד',      anim: 'rain-drip' },
 71: { icon: '❄️', label: 'שלג קל',       anim: 'snow-fall' },
 73: { icon: '❄️', label: 'שלג',          anim: 'snow-fall' },
 80: { icon: '🌦️',label: 'ממטר',         anim: 'rain-drip' },
 81: { icon: '🌧️',label: 'גשם',          anim: 'rain-drip' },
 95: { icon: '⛈️', label: 'סופת רעמים',  anim: 'flash'     },
 99: { icon: '⛈️', label: 'סופת ברד',    anim: 'flash'     },
}
const getWMO = (c) => {
  if (c == null) return { icon: '🌡️', label: '', anim: 'float' }
  if (WMO[c]) return WMO[c]
  const k = Object.keys(WMO).map(Number).sort((a,b)=>a-b)
    .reduce((p,v) => Math.abs(v-c) < Math.abs(p-c) ? v : p, 0)
  return WMO[k] ?? { icon: '🌡️', label: '', anim: 'float' }
}

// =====================================================================
// Helpers
// =====================================================================
// Birthday detection
const BIRTHDAY_WORDS = ['יום הולדת', 'יומולדת', 'יום-הולדת', 'birthday', 'bday', 'b-day']
const isBirthday = (title) => {
  const t = (title ?? '').toLowerCase()
  return BIRTHDAY_WORDS.some(w => t.includes(w.toLowerCase()))
}

const toKey   = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const toTime  = (iso) => { if (!iso?.includes('T')) return ''; const d=new Date(iso); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }
const isoDate = (iso) => iso?.split('T')[0] ?? iso ?? ''
const addDays = (d,n)  => { const r=new Date(d); r.setDate(r.getDate()+n); return r }

// =====================================================================
// Main component
// =====================================================================
export default function CalendarApp() {
  const [accounts, setAccounts]         = useState([null, null, null])
  const [events, setEvents]             = useState([])
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [now, setNow]                   = useState(() => new Date())
  const [weather, setWeather]           = useState(null)
  const [forecast, setForecast]         = useState([])
  const [coords, setCoords]             = useState(null)
  const [selectedShabbat, setSelectedShabbat] = useState(null)
  const [loadingIdx, setLoadingIdx]     = useState(null)
  const [notif, setNotif]               = useState(null)
  const [todos, setTodos]               = useState([])
  const [newTodo, setNewTodo]           = useState('')
  const [modal, setModal]               = useState(null)
  const [addForm, setAddForm]           = useState({ title:'', date:'', time:'09:00', endTime:'10:00', allDay:false, accountIndex:0 })
  const [viewEvent, setViewEvent]       = useState(null)
  const [showConfetti, setShowConfetti]  = useState(false)
  const refreshTimerRef                 = useRef(null)
  const fetchEventsRef                  = useRef(null)

  const today    = now
  const tomorrow = addDays(today, 1)

  // Clock tick
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t) }, [])

  // On mount: handle OAuth callback params + auto-refresh saved tokens
  useEffect(() => {
    const params     = new URLSearchParams(window.location.search)
    const isCallback = params.get('auth_success') === '1'
    const newIdx     = isCallback ? parseInt(params.get('account') ?? '0') : -1

    // Coming back from Google OAuth — set the new account
    if (isCallback) {
      const email = decodeURIComponent(params.get('email') ?? '')
      const name  = decodeURIComponent(params.get('name')  ?? '')
      const token = params.get('token') ?? ''
      if (token) {
        setAccounts(prev => {
          const updated = [...prev]
          updated[newIdx] = { token, email, name }
          localStorage.setItem('gc_accounts',
            JSON.stringify(updated.map(a => a ? { email: a.email, name: a.name } : null)))
          return updated
        })
        window.history.replaceState({}, '', '/')
      }
    }

    // Refresh ALL accounts from server cookies, collect tokens, then fetch events
    const initAll = async () => {
      const tokenMap = {}  // { index: accessToken }

      await Promise.all([0, 1, 2].map(async (i) => {
        try {
          const res = await fetch(`/api/auth?action=refresh&account=${i}`)
          if (!res.ok) return
          const data = await res.json()
          if (!data.access_token) return

          // Get email/name
          let email = '', name = ''
          try {
            const saved = JSON.parse(localStorage.getItem('gc_accounts') ?? '[]')
            email = saved[i]?.email ?? ''
            name  = saved[i]?.name  ?? ''
          } catch {}

          // If callback for this account, use URL params
          if (i === newIdx) {
            email = decodeURIComponent(params.get('email') ?? '') || email
            name  = decodeURIComponent(params.get('name')  ?? '') || name
            const urlToken = params.get('token')
            tokenMap[i] = urlToken || data.access_token
          } else {
            tokenMap[i] = data.access_token
          }

          // If still no email, ask Google
          if (!email) {
            try {
              const u = await fetch('https://www.googleapis.com/oauth2/v3/userinfo',
                { headers: { Authorization: `Bearer ${tokenMap[i]}` } })
              const user = await u.json()
              email = user.email ?? ''
              name  = user.name  ?? ''
            } catch {}
          }

          if (!email) return

          setAccounts(prev => {
            const updated = [...prev]
            updated[i] = { token: tokenMap[i], email, name }
            const forStorage = updated.map(a => a ? { email: a.email, name: a.name } : null)
            localStorage.setItem('gc_accounts', JSON.stringify(forStorage))
            return updated
          })
        } catch {}
      }))

      // After all accounts are set — fetch events for all
      await new Promise(r => setTimeout(r, 800))
      Object.entries(tokenMap).forEach(([i, token]) => {
        fetchEventsRef.current?.(token, parseInt(i))
      })
    }

    initAll()
  }, []) // eslint-disable-line

  // Persist — only load todos, NOT accounts (accounts restored via server cookies)
  useEffect(() => {
    try {
      const t = localStorage.getItem('gc_todos'); if (t) setTodos(JSON.parse(t))
    } catch {}
  }, [])



  // Weather + 4-day forecast + Shabbat times
  useEffect(() => {
    // Use Tiberias fixed coords — change TIBERIAS constant to move location
    ;(async () => {
      const { lat, lng } = TIBERIAS
      setCoords({ lat, lng })
      // Weather
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
          `&current=temperature_2m,weather_code,visibility` +
          `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
          `&timezone=auto&forecast_days=5`
        )
        const d = await r.json()
        // Smart visibility + dust detection
        const visibility = d.current.visibility ?? 99999
        const rawCode    = d.current.weather_code
        let finalCode    = rawCode
        if (visibility < 2000)                       finalCode = 48
        else if (visibility < 5000)                  finalCode = 45
        else if (visibility < 10000 && rawCode <= 3) finalCode = 7

        // Dust via Air Quality API
        try {
          const aqRes = await fetch(
            `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=dust&timezone=auto`
          )
          const aqData = await aqRes.json()
          const dust = aqData?.current?.dust ?? 0
          if (dust > 50)  finalCode = 7
          if (dust > 200) finalCode = 8
        } catch {}

        setWeather({ temp: Math.round(d.current.temperature_2m), max: Math.round(d.daily.temperature_2m_max[0]), min: Math.round(d.daily.temperature_2m_min[0]), code: finalCode })
        setForecast(Array.from({ length: 4 }, (_, i) => ({
          date: new Date(d.daily.time[i+1] + 'T12:00:00'),
          max:  Math.round(d.daily.temperature_2m_max[i+1]),
          min:  Math.round(d.daily.temperature_2m_min[i+1]),
          code: d.daily.weather_code[i+1],
        })))
      } catch {}

    })()
  }, [])

  const toast = (msg, type='ok') => { setNotif({ msg, type }); setTimeout(() => setNotif(null), 3000) }

  // Fetch Shabbat times for a specific Friday or Saturday
  // Uses gy/gm/gd params — the correct Hebcal way to request a specific week
  const fetchShabbatForDate = useCallback(async (date) => {
    const day = date.getDay() // 5=Fri, 6=Sat
    if (day !== 5 && day !== 6) { setSelectedShabbat(null); return }
    if (!coords) return
    // Always fetch by the Friday of that week
    const friday = new Date(date)
    if (day === 6) friday.setDate(friday.getDate() - 1)
    const gy = friday.getFullYear()
    const gm = friday.getMonth() + 1
    const gd = friday.getDate()
    try {
      const res = await fetch(
        `https://www.hebcal.com/shabbat?cfg=json` +
        `&latitude=${coords.lat}&longitude=${coords.lng}` +
        `&tzid=Asia/Jerusalem&m=50&b=18` +
        `&gy=${gy}&gm=${gm}&gd=${gd}`
      )
      const data = await res.json()
      const fmt = (iso) => {
        if (!iso) return null
        const d = new Date(iso)
        return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
      }
      const candle   = data.items?.find(i => i.category === 'candles')
      const havdalah = data.items?.find(i => i.category === 'havdalah')
      setSelectedShabbat({
        candle:   fmt(candle?.date),
        havdalah: fmt(havdalah?.date),
        isFriday: day === 5,
      })
    } catch { setSelectedShabbat(null) }
  }, [coords])

  // Re-fetch when selected date OR coords change (coords arrive async after geolocation)
  useEffect(() => {
    fetchShabbatForDate(selectedDate)
  }, [selectedDate, fetchShabbatForDate])

  // Check for birthday on selected date
  useEffect(() => {
    const key = toKey(selectedDate)
    const hasBirthday = events
      .filter(e => isoDate(e.start) === key)
      .some(e => isBirthday(e.title))
    if (hasBirthday) {
      setShowConfetti(false)
      // Small delay to restart animation if clicking same day again
      setTimeout(() => {
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 6000)
      }, 50)
    } else {
      setShowConfetti(false)
    }
  }, [selectedDate, events])

  // Google connect — redirect to server OAuth flow
  const connectAccount = useCallback((idx) => {
    window.location.href = `/api/auth?action=login&account=${idx}`
  }, [])

  const disconnectAccount = useCallback((idx) => {
    // Clear server-side refresh token cookie
    fetch(`/api/auth?action=logout&account=${idx}`).catch(() => {})
    const updated = [...accounts]; updated[idx] = null
    setAccounts(updated)
    setEvents(prev => prev.filter(e => e.accountIndex !== idx))
    localStorage.setItem('gc_accounts', JSON.stringify(updated.map(a => a ? { email: a.email, name: a.name } : null)))
    toast('החשבון נותק')
  }, [accounts])

  // Silent token refresh via server every 45 min
  useEffect(() => {
    const t = setInterval(async () => {
      for (let i = 0; i < 3; i++) {
        if (!accounts[i]) continue
        try {
          const res  = await fetch(`/api/auth?action=refresh&account=${i}`)
          if (!res.ok) continue
          const data = await res.json()
          if (!data.access_token) continue
          const acc = accounts[i]
          setAccounts(prev => {
            const updated = [...prev]
            updated[i] = { ...acc, token: data.access_token }
            return updated
          })
          fetchEventsRef.current?.(data.access_token, i)
        } catch {}
      }
    }, 45 * 60_000)
    return () => clearInterval(t)
  }, [accounts])

  const fetchEvents = useCallback(async (token, idx) => {
    setLoadingIdx(idx)
    try {
      const from = new Date(now.getFullYear(), now.getMonth()-2, 1).toISOString()
      const to   = new Date(now.getFullYear(), now.getMonth()+4, 0).toISOString()
      const calListRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50',
        { headers: { Authorization: `Bearer ${token}` } })
      if (calListRes.status === 401) { disconnectAccount(idx); toast('פג תוקף ההרשאה', 'error'); return }
      const calList = await calListRes.json()
      const allEvs = []
      for (const cal of calList.items ?? []) {
        if (cal.accessRole === 'freeBusyReader') continue
        // Skip holiday/other/birthday calendars — they duplicate across accounts
        if (cal.id?.includes('#holiday@') ||
            cal.id?.includes('#contacts@') ||
            cal.id?.includes('addressbook#') ||
            cal.summary?.includes('Birthdays') ||
            cal.summary?.includes('ימי הולדת') ||
            cal.summaryOverride?.includes('Holidays')) continue

        const evRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?` +
          `timeMin=${from}&timeMax=${to}&singleEvents=true&orderBy=startTime&maxResults=500`,
          { headers: { Authorization: `Bearer ${token}` } })
        if (!evRes.ok) continue
        const evData = await evRes.json()
        for (const item of evData.items ?? []) {
          allEvs.push({
            id: item.id, calendarId: cal.id,
            title: item.summary ?? '(ללא כותרת)',
            start: item.start?.dateTime ?? item.start?.date ?? '',
            end:   item.end?.dateTime   ?? item.end?.date   ?? '',
            allDay: !item.start?.dateTime,
            accountIndex: idx,
            color: cal.backgroundColor ?? ACCT_COLORS[idx],
            link:  item.htmlLink ?? '',
          })
        }
      }
      setEvents(prev => {
        // Merge: remove old events from this account, add new ones
        const others = prev.filter(e => e.accountIndex !== idx)
        const allNew = [...others, ...allEvs]
        // Only deduplicate all-day events (holidays/recurring) across accounts
        // Keep ALL timed events (they are personal appointments)
        const seen = new Set()
        return allNew.filter(e => {
          // Timed events — always keep, never deduplicate
          if (!e.allDay) return true
          // All-day events — deduplicate by title+date across accounts
          const key = `${e.title}__${e.start?.split('T')[0] ?? e.start}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      })
      toast(`✓ נטענו ${allEvs.length} אירועים`)
    } catch { toast('שגיאה בטעינת אירועים', 'error') }
    finally  { setLoadingIdx(null) }
  }, [disconnectAccount, now])

  // Keep ref updated so mount useEffect can call it
  useEffect(() => { fetchEventsRef.current = fetchEvents }, [fetchEvents])

  const refreshAll = useCallback(() => {
    accounts.forEach((a,i) => { if (a?.token) fetchEvents(a.token, i) })
  }, [accounts, fetchEvents])

  useEffect(() => {
    clearInterval(refreshTimerRef.current)
    if (accounts.some(a => a?.token)) refreshTimerRef.current = setInterval(refreshAll, 2*60_000)
    return () => clearInterval(refreshTimerRef.current)
  }, [accounts, refreshAll])

  const createEvent = useCallback(async () => {
    const { title, date, time, endTime, allDay, accountIndex } = addForm
    const acc = accounts[accountIndex]
    if (!acc?.token)   { toast('יש לחבר חשבון תחילה', 'error'); return }
    if (!title.trim()) { toast('נא להזין כותרת',       'error'); return }
    if (!date)         { toast('נא לבחור תאריך',        'error'); return }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    let startObj, endObj
    if (allDay) { startObj = { date }; endObj = { date } }
    else {
      const s = new Date(`${date}T${time}`); const e = new Date(`${date}T${endTime}`)
      if (e <= s) e.setHours(s.getHours()+1, s.getMinutes())
      startObj = { dateTime: s.toISOString(), timeZone: tz }
      endObj   = { dateTime: e.toISOString(), timeZone: tz }
    }
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${acc.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: title, start: startObj, end: endObj }),
    })
    if (res.ok) {
      setModal(null)
      setAddForm({ title:'', date:'', time:'09:00', endTime:'10:00', allDay:false, accountIndex })
      fetchEvents(acc.token, accountIndex)
      toast('האירוע נוצר בהצלחה!')
    } else toast('שגיאה ביצירת האירוע', 'error')
  }, [accounts, addForm, fetchEvents])

  const deleteEvent = useCallback(async (ev) => {
    const acc = accounts[ev.accountIndex]
    if (!acc?.token) return
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(ev.calendarId)}/events/${ev.id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${acc.token}` } })
    if (res.ok || res.status === 204) {
      setEvents(prev => prev.filter(e => e.id !== ev.id))
      if (modal === 'view') { setModal(null); setViewEvent(null) }
      toast('האירוע נמחק')
    } else toast('שגיאה במחיקת האירוע', 'error')
  }, [accounts, modal])

  // Todos
  const saveTodos  = (t) => { setTodos(t); localStorage.setItem('gc_todos', JSON.stringify(t)) }
  const addTodoFn  = ()  => { if (!newTodo.trim()) return; saveTodos([...todos, { id: Date.now(), text: newTodo, done: false }]); setNewTodo('') }
  const toggleTodo = (id) => saveTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t))
  const deleteTodo = (id) => saveTodos(todos.filter(t => t.id !== id))

  const openAdd = (date) => {
    const firstAcc = accounts.findIndex(a => a)
    setAddForm({ title:'', date: toKey(date), time:'09:00', endTime:'10:00', allDay:false, accountIndex: firstAcc >= 0 ? firstAcc : 0 })
    setModal('add')
  }

  const evsByDate = useCallback((d) =>
    events.filter(e => isoDate(e.start) === toKey(d)).sort((a,b) => a.start.localeCompare(b.start))
  , [events])

  const dotsMap = (() => {
    const m = {}
    events.forEach(e => { const k = isoDate(e.start); if (k) (m[k] ??= []).push(e.color) })
    return m
  })()



  const renderCells = () => {
    const y = currentMonth.getFullYear(), mo = currentMonth.getMonth()
    const dim = new Date(y, mo+1, 0).getDate()
    const fd  = new Date(y, mo, 1).getDay()
    const cells = []
    for (let i = 0; i < fd; i++) cells.push(<div key={`e${i}`} className="cal-cell empty" />)
    for (let d = 1; d <= dim; d++) {
      const date    = new Date(y, mo, d)
      const k       = toKey(date)
      const isT     = k === toKey(today)
      const isSel   = k === toKey(selectedDate)
      const dots    = dotsMap[k] ?? []
      const isSat   = date.getDay() === 6
      const holiday = getHoliday(date)
      const hebDay  = formatHebrewDayShort(date).split(' ')[0]
      cells.push(
        <div key={d} className={`cal-cell${isT?' today':''}${isSel?' selected':''}`}
          onClick={() => setSelectedDate(date)}>
          <span className={`cal-day-num${isSat?' shabbat':''}${holiday?' holiday':''}`}>{d}</span>
          <span className="cal-heb-day">{hebDay}</span>
          {holiday && <span className="cal-holiday-dot" title={holiday.name}>{holiday.emoji}</span>}
          {dots.length > 0 && (
            <div className="cal-dots">
              {dots.slice(0,3).map((c,i) => <span key={i} className="cal-dot" style={{ background: c }} />)}
            </div>
          )}
        </div>
      )
    }
    return cells
  }

  const sameDayStr    = (a,b) => toKey(a) === toKey(b)
  const selectedTitle = sameDayStr(selectedDate, today) ? 'היום' : sameDayStr(selectedDate, tomorrow) ? 'מחר' : `${selectedDate.getDate()} ב${MONTHS[selectedDate.getMonth()]}`
  const hebrewNow     = formatHebrewDate(now)
  const currentWMO    = weather ? getWMO(weather.code) : null
  const monthHeb      = formatHebrewDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 15))

  // =====================================================================
  // Render
  // =====================================================================
  return (
    <div className="app" dir="rtl">

      {/* CSS animations for weather */}
      <style>{`
        @keyframes spin-slow  { to{transform:rotate(360deg)} }
        @keyframes float      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes drift      { 0%,100%{transform:translateX(0)} 50%{transform:translateX(4px)} }
        @keyframes pulse-fade { 0%,100%{opacity:1} 50%{opacity:.45} }
        @keyframes rain-drip  { 0%,100%{transform:translateY(0) rotate(10deg)} 50%{transform:translateY(5px) rotate(10deg)} }
        @keyframes snow-fall  { 0%{transform:translateY(-4px) rotate(0deg)} 100%{transform:translateY(4px) rotate(25deg)} }
        @keyframes flash      { 0%,88%,100%{opacity:1} 94%{opacity:.1} }
        .anim-spin-slow  { animation:spin-slow  4s linear infinite; display:inline-block }
        .anim-float      { animation:float      3s ease-in-out infinite; display:inline-block }
        .anim-drift      { animation:drift      4s ease-in-out infinite; display:inline-block }
        .anim-pulse-fade { animation:pulse-fade 2s ease-in-out infinite; display:inline-block }
        .anim-rain-drip  { animation:rain-drip  1.2s ease-in-out infinite; display:inline-block }
        .anim-snow-fall  { animation:snow-fall  2s ease-in-out infinite alternate; display:inline-block }
        .anim-flash      { animation:flash      1.8s ease-in-out infinite; display:inline-block }
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes birthday-pulse {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.04); }
        }
        .confetti-piece {
          position: fixed; top: -20px; width: 10px; height: 14px; border-radius: 2px;
          animation: confetti-fall linear forwards; z-index: 999; pointer-events: none;
        }
        .birthday-banner {
          animation: birthday-pulse 0.6s ease-in-out infinite;
        }
      `}</style>

      {notif && <div className={`notif${notif.type==='error'?' error':''}`}>{notif.msg}</div>}

      {/* Confetti */}
      {showConfetti && Array.from({ length: 40 }, (_, i) => (
        <div key={i} className="confetti-piece" style={{
          left: `${Math.random() * 100}%`,
          background: ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff922b','#cc5de8'][i % 6],
          animationDuration: `${1.5 + Math.random() * 2}s`,
          animationDelay: `${Math.random() * 1.5}s`,
          width:  `${8 + Math.random() * 8}px`,
          height: `${10 + Math.random() * 8}px`,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        }} />
      ))}

      {/* ============================================================ */}
      {/* HEADER                                                         */}
      {/* ============================================================ */}
      <div className="header">

        {/* ── RIGHT: Clock + dates ─────────────────────────────────── */}
        <div className="header-right">
          <div className="clock">
            {String(now.getHours()).padStart(2,'0')}:{String(now.getMinutes()).padStart(2,'0')}
          </div>
          <div className="header-dates">
            <div className="header-date-greg">
              {DAY_PREFIX[now.getDay()]},&ensp;{now.getDate()} ב{MONTHS[now.getMonth()]} {now.getFullYear()}
            </div>
            <div className="header-date-heb">
              {hebrewNow.day} ב{hebrewNow.month} {hebrewNow.year}
            </div>

          </div>
        </div>

        {/* ── CENTER: Weather + forecast ───────────────────────────── */}
        <div className="header-weather">
          {currentWMO && weather ? (
            <>
              <div className="weather-now">
                <span className={`weather-now-icon anim-${currentWMO.anim}`}>{currentWMO.icon}</span>
                <div className="weather-now-text">
                  <div className="weather-temp-big">{weather.temp}°</div>
                  <div className="weather-desc">{currentWMO.label}</div>
                  <div className="weather-range">{weather.max}° / {weather.min}°</div>
                </div>
              </div>
              <div className="weather-divider" />
              <div className="weather-forecast">
                {forecast.map((f, i) => {
                  const w = getWMO(f.code)
                  return (
                    <div key={i} className="forecast-day">
                      <div className="forecast-name">{WEEK_HEB[f.date.getDay()]}</div>
                      <span className={`forecast-icon anim-${w.anim}`}>{w.icon}</span>
                      <div className="forecast-temp">
                        <span className="fmax">{f.max}°</span>
                        <span className="fmin">{f.min}°</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="weather-loading">⏳ טוען מזג אוויר…</div>
          )}
        </div>

        {/* ── LEFT: Accounts ──────────────────────────────────────── */}
        <div className="header-left">
          {accounts.map((acc, i) => (
            <div key={i} className="account-chip">
              {acc ? (
                <>
                  <span className="account-dot" style={{ background: ACCT_COLORS[i] }} />
                  <span className="account-name">{ACCOUNTS_CONFIG[i].name}</span>
                  <span className="account-email">{acc.email}</span>
                  {loadingIdx === i && <span className="spinner">↻</span>}
                  <button className="account-x" onClick={() => disconnectAccount(i)} title="נתק">✕</button>
                </>
              ) : (
                <button className="connect-btn" onClick={() => connectAccount(i)}>+ {ACCOUNTS_CONFIG[i].name}</button>
              )}
            </div>
          ))}
          {accounts.some(a => a) && (
            <button className={`refresh-btn${loadingIdx!==null?' spinning':''}`} onClick={refreshAll} title="רענן">↻</button>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* MAIN 3-COLUMN GRID                                             */}
      {/* ============================================================ */}
      <div className="main">

        {/* ── RIGHT — Today / Selected day ── */}
        <div className="panel panel-today">
          <div className="panel-header today-header">
            <h3>{selectedTitle}</h3>
            <button className="add-btn" onClick={() => openAdd(selectedDate)}>+</button>
          </div>
          {(() => { const h = getHoliday(selectedDate); return h ? <div className="panel-holiday">{h.emoji} {h.name}</div> : null })()}
          {evsByDate(selectedDate).some(e => isBirthday(e.title)) && (
            <div className="birthday-banner">
              🎂 יום הולדת שמח! 🎉🎈
            </div>
          )}
          {selectedShabbat && selectedShabbat.isFriday && selectedShabbat.candle && (
            <div className="panel-shabbat-entry">
              <span>🕯️</span>
              <span>כניסת שבת</span>
              <span className="shabbat-time">{selectedShabbat.candle}</span>
            </div>
          )}
          {selectedShabbat && !selectedShabbat.isFriday && selectedShabbat.havdalah && (
            <div className="panel-shabbat-exit">
              <span>✨</span>
              <span>צאת שבת</span>
              <span className="shabbat-time">{selectedShabbat.havdalah}</span>
            </div>
          )}
          <EventList events={evsByDate(selectedDate)} onDelete={deleteEvent} onView={(e) => { setViewEvent(e); setModal('view') }} />
        </div>

        {/* ── CENTER — Calendar + Week ── */}
        <div className="center">
          <div className="month-nav">
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()-1))}>‹</button>
            <div className="month-nav-title">
              <div>{MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}</div>
              <div className="month-nav-heb">{monthHeb.month} {monthHeb.year}</div>
            </div>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()+1))}>›</button>
          </div>

          <div className="cal-grid-wrap">
            <div className="cal-grid">
              {DAYS_SHORT.map(d => <div key={d} className="cal-header">{d}</div>)}
              {renderCells()}
            </div>
          </div>


        </div>

        {/* ── LEFT — Tomorrow ── */}
        <div className="panel panel-tomorrow">
          <div className="panel-header">
            <h3>מחר · {tomorrow.getDate()} ב{MONTHS[tomorrow.getMonth()]}</h3>
            <button className="add-btn" onClick={() => openAdd(tomorrow)}>+</button>
          </div>
          {(() => { const h = getHoliday(tomorrow); return h ? <div className="panel-holiday">{h.emoji} {h.name}</div> : null })()}
          <EventList events={evsByDate(tomorrow)} onDelete={deleteEvent} onView={(e) => { setViewEvent(e); setModal('view') }} />
        </div>
      </div>

      {/* ── Bottom — Todos ── */}
      <div className="bottom">
        <div className="todos-section">
          <h3>הערות</h3>
          <div className="todos-list">
            {todos.map(t => (
              <div key={t.id} className={`todo-item${t.done?' done':''}`}>
                <input type="checkbox" checked={t.done} onChange={() => toggleTodo(t.id)} />
                <span>{t.text}</span>
                <button className="todo-delete" onClick={() => deleteTodo(t.id)}>✕</button>
              </div>
            ))}
            {todos.length === 0 && <div style={{fontSize:'0.72rem',color:'var(--text-muted)'}}>אין הערות</div>}
          </div>
          <div className="todo-add">
            <input value={newTodo} onChange={e => setNewTodo(e.target.value)}
              onKeyDown={e => e.key==='Enter' && addTodoFn()} placeholder="הוסף הערה…" />
            <button onClick={addTodoFn}>+</button>
          </div>
        </div>
      </div>

      {/* ── Modal: Add ── */}
      {modal === 'add' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>הוספת אירוע</h2>
            <label>כותרת</label>
            <input type="text" value={addForm.title} autoFocus
              onChange={e => setAddForm(p=>({...p,title:e.target.value}))}
              onKeyDown={e => e.key==='Enter' && createEvent()} placeholder="שם האירוע" />
            <label>תאריך</label>
            <input type="date" value={addForm.date} onChange={e => setAddForm(p=>({...p,date:e.target.value}))} />
            <div className="form-row">
              <label className="checkbox-label">
                <input type="checkbox" checked={addForm.allDay} onChange={e => setAddForm(p=>({...p,allDay:e.target.checked}))} />
                כל היום
              </label>
            </div>
            {!addForm.allDay && (
              <div className="form-row">
                <div><label>שעת התחלה</label>
                  <input type="time" value={addForm.time} onChange={e => setAddForm(p=>({...p,time:e.target.value}))} /></div>
                <div><label>שעת סיום</label>
                  <input type="time" value={addForm.endTime} onChange={e => setAddForm(p=>({...p,endTime:e.target.value}))} /></div>
              </div>
            )}
            {accounts.filter(Boolean).length > 1 && (
              <>
                <label>חשבון</label>
                <select value={addForm.accountIndex} onChange={e => setAddForm(p=>({...p,accountIndex:+e.target.value}))}>
                  {accounts.map((a,i) => a && <option key={i} value={i}>{a.email}</option>)}
                </select>
              </>
            )}
            <div className="modal-actions">
              <button className="btn-primary" onClick={createEvent}>שמור</button>
              <button className="btn-secondary" onClick={() => setModal(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: View ── */}
      {modal === 'view' && viewEvent && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{viewEvent.title}</h2>
            {!viewEvent.allDay && <p style={{fontSize:'0.82rem',color:'var(--text-muted)'}}>{toTime(viewEvent.start)}{viewEvent.end&&` – ${toTime(viewEvent.end)}`}</p>}
            <p style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>{isoDate(viewEvent.start)}</p>
            {viewEvent.link && <a href={viewEvent.link} target="_blank" rel="noopener noreferrer" style={{fontSize:'0.75rem',color:'var(--accent-green)'}}>פתח ב-Google Calendar ↗</a>}
            <div className="modal-actions">
              <button className="btn-primary" style={{background:'var(--red)'}} onClick={() => deleteEvent(viewEvent)}>מחק</button>
              <button className="btn-secondary" onClick={() => setModal(null)}>סגור</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EventList({ events, onDelete, onView }) {
  if (!events.length) return <div className="no-events">אין אירועים</div>
  return (
    <div className="event-list">
      {events.map(ev => (
        <div key={ev.id} className="event-item" style={{ borderRightColor: ev.color }} onClick={() => onView(ev)}>
          <div className="event-content">
            {toTime(ev.start) && <div className="event-time">{toTime(ev.start)}</div>}
            <div className="event-title">{ev.title}</div>
          </div>
          <button className="event-delete" onClick={e => { e.stopPropagation(); onDelete(ev) }} title="מחק">✕</button>
        </div>
      ))}
    </div>
  )
}
