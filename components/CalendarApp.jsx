'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { formatHebrewDate, formatHebrewDayShort, getHoliday } from './hebrewCalendar'

// =====================================================================
// Constants
// =====================================================================
const DAYS_SHORT  = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
const DAY_PREFIX  = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת']
const MONTHS      = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
const ACCT_COLORS = ['#5a7a3a', '#2563eb']
const WEEK_HEB    = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

const WMO = {
  0: { icon: '☀️', label: 'שמשי',        anim: 'spin-slow' },
  1: { icon: '🌤️',label: 'בהיר בעיקר',  anim: 'float'     },
  2: { icon: '⛅', label: 'מעורב',        anim: 'float'     },
  3: { icon: '☁️', label: 'מעונן',        anim: 'drift'     },
 45: { icon: '🌫️',label: 'ערפל',         anim: 'pulse-fade'},
 48: { icon: '🌫️',label: 'ערפל',         anim: 'pulse-fade'},
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
const toKey   = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const toTime  = (iso) => { if (!iso?.includes('T')) return ''; const d=new Date(iso); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }
const isoDate = (iso) => iso?.split('T')[0] ?? iso ?? ''
const addDays = (d,n)  => { const r=new Date(d); r.setDate(r.getDate()+n); return r }

// =====================================================================
// Main component
// =====================================================================
export default function CalendarApp() {
  const [accounts, setAccounts]         = useState([null, null])
  const [events, setEvents]             = useState([])
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [now, setNow]                   = useState(() => new Date())
  const [weather, setWeather]           = useState(null)
  const [forecast, setForecast]         = useState([])
  const [apisLoaded, setApisLoaded]     = useState(false)
  const [loadingIdx, setLoadingIdx]     = useState(null)
  const [notif, setNotif]               = useState(null)
  const [todos, setTodos]               = useState([])
  const [newTodo, setNewTodo]           = useState('')
  const [modal, setModal]               = useState(null)
  const [addForm, setAddForm]           = useState({ title:'', date:'', time:'09:00', endTime:'10:00', allDay:false, accountIndex:0 })
  const [viewEvent, setViewEvent]       = useState(null)
  const refreshTimerRef                 = useRef(null)

  const today    = now
  const tomorrow = addDays(today, 1)

  // Clock tick
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t) }, [])

  // Persist
  useEffect(() => {
    try {
      const a = localStorage.getItem('gc_accounts'); if (a) setAccounts(JSON.parse(a))
      const t = localStorage.getItem('gc_todos');    if (t) setTodos(JSON.parse(t))
    } catch {}
  }, [])

  // Google GSI
  useEffect(() => {
    if (document.querySelector('script[src*="accounts.google.com/gsi"]')) { setApisLoaded(true); return }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => setApisLoaded(true)
    document.head.appendChild(s)
  }, [])

  // Weather + 4-day forecast (Open-Meteo, free)
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(async ({ coords: { latitude: lat, longitude: lng } }) => {
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
          `&current=temperature_2m,weather_code` +
          `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
          `&timezone=auto&forecast_days=5`
        )
        const d = await r.json()
        setWeather({ temp: Math.round(d.current.temperature_2m), max: Math.round(d.daily.temperature_2m_max[0]), min: Math.round(d.daily.temperature_2m_min[0]), code: d.current.weather_code })
        setForecast(Array.from({ length: 4 }, (_, i) => ({
          date: new Date(d.daily.time[i+1] + 'T12:00:00'),
          max:  Math.round(d.daily.temperature_2m_max[i+1]),
          min:  Math.round(d.daily.temperature_2m_min[i+1]),
          code: d.daily.weather_code[i+1],
        })))
      } catch {}
    })
  }, [])

  const toast = (msg, type='ok') => { setNotif({ msg, type }); setTimeout(() => setNotif(null), 3000) }

  // Google connect
  const connectAccount = useCallback((idx) => {
    if (!apisLoaded || !window.google?.accounts?.oauth2) { toast('Google APIs עדיין נטענות…', 'error'); return }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/calendar openid email profile',
      callback: async (res) => {
        if (!res.access_token) { toast('ההתחברות בוטלה', 'error'); return }
        try {
          const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo',
            { headers: { Authorization: `Bearer ${res.access_token}` } }).then(r => r.json())
          const updated = [...accounts]
          updated[idx] = { token: res.access_token, email: info.email, name: info.name }
          setAccounts(updated)
          localStorage.setItem('gc_accounts', JSON.stringify(updated.map(a => a ? { email: a.email, name: a.name } : null)))
          fetchEvents(res.access_token, idx)
        } catch { toast('שגיאה בחיבור החשבון', 'error') }
      },
      prompt: 'select_account',
    })
    client.requestAccessToken()
  }, [accounts, apisLoaded]) // eslint-disable-line

  const disconnectAccount = useCallback((idx) => {
    const updated = [...accounts]; updated[idx] = null
    setAccounts(updated)
    setEvents(prev => prev.filter(e => e.accountIndex !== idx))
    localStorage.setItem('gc_accounts', JSON.stringify(updated.map(a => a ? { email: a.email, name: a.name } : null)))
    toast('החשבון נותק')
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
      setEvents(prev => [...prev.filter(e => e.accountIndex !== idx), ...allEvs])
      toast(`✓ נטענו ${allEvs.length} אירועים`)
    } catch { toast('שגיאה בטעינת אירועים', 'error') }
    finally  { setLoadingIdx(null) }
  }, [disconnectAccount, now])

  const refreshAll = useCallback(() => {
    accounts.forEach((a,i) => { if (a?.token) fetchEvents(a.token, i) })
  }, [accounts, fetchEvents])

  useEffect(() => {
    clearInterval(refreshTimerRef.current)
    if (accounts.some(a => a?.token)) refreshTimerRef.current = setInterval(refreshAll, 10*60_000)
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

  const weekDays = (() => {
    const s = new Date(today); s.setDate(today.getDate() - today.getDay())
    return Array.from({ length: 7 }, (_, i) => addDays(s, i))
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
      `}</style>

      {notif && <div className={`notif${notif.type==='error'?' error':''}`}>{notif.msg}</div>}

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
                  <span className="account-email">{acc.email}</span>
                  {loadingIdx === i && <span className="spinner">↻</span>}
                  <button className="account-x" onClick={() => disconnectAccount(i)} title="נתק">✕</button>
                </>
              ) : (
                <button className="connect-btn" onClick={() => connectAccount(i)}>+ חשבון {i+1}</button>
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

          <div className="week-strip">
            <div className="week-strip-title">· השבוע ·</div>
            <div className="week-days">
              {weekDays.map((d, i) => {
                const evs   = evsByDate(d)
                const isT   = sameDayStr(d, today)
                const isSel = sameDayStr(d, selectedDate)
                const hday  = getHoliday(d)
                return (
                  <div key={i} className={`week-day${isT?' today':''}${isSel?' selected':''}`}
                    onClick={() => setSelectedDate(d)}>
                    <div className="week-day-name">{DAYS_SHORT[d.getDay()]}</div>
                    <div className="week-day-num">{d.getDate()}</div>
                    <div className="week-day-heb">{formatHebrewDayShort(d).split(' ')[0]}</div>
                    {hday && <div className="week-holiday" title={hday.name}>{hday.emoji}</div>}
                    {evs.slice(0,2).map((e,j) => (
                      <div key={j} className="week-event" style={{ borderRightColor: e.color }}>
                        {toTime(e.start) && <span>{toTime(e.start)}&thinsp;</span>}
                        <span>{e.title}</span>
                      </div>
                    ))}
                    {evs.length > 2 && <div className="week-more">+{evs.length-2}</div>}
                  </div>
                )
              })}
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
