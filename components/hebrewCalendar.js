// Hebrew Calendar — Intl for month name + gematria for day & year

// ── Gematria converter ──────────────────────────────────────────────
const ONES  = ['','א','ב','ג','ד','ה','ו','ז','ח','ט']
const TENS  = ['','י','כ','ל','מ','נ','ס','ע','פ','צ']
const HUNDS = ['','ק','ר','ש','ת','תק','תר','תש','תת','תתק']

function numToGematria(n) {
  if (n <= 0) return ''
  let result = ''
  const h = Math.floor(n / 100); result += HUNDS[h]; n -= h * 100
  // avoid יה (15) and יו (16)
  if (n === 15) { result += 'ט״ו'; return result }
  if (n === 16) { result += 'ט״ז'; return result }
  const t = Math.floor(n / 10); result += TENS[t];  n -= t * 10
  result += ONES[n]
  return result
}

function addPunctuation(s) {
  if (!s) return ''
  if (s.length === 1) return s + '׳'
  return s.slice(0, -1) + '״' + s.slice(-1)
}

export function toHebrewDay(n) {
  return addPunctuation(numToGematria(n))
}

export function toHebrewYear(y) {
  // Drop millennia (e.g. 5786 → 786)
  const short = y % 1000
  return addPunctuation(numToGematria(short))
}

// ── Intl formatters ─────────────────────────────────────────────────
const FMT_PARTS    = new Intl.DateTimeFormat('en-u-ca-hebrew', { day:'numeric', month:'numeric', year:'numeric' })
const FMT_MONTH_HE = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month:'long' })

function getHebrewParts(gDate) {
  const p = {}
  FMT_PARTS.formatToParts(gDate).forEach(x => { p[x.type] = x.value })
  return { day: parseInt(p.day||'0',10), month: parseInt(p.month||'0',10), year: parseInt(p.year||'0',10) }
}

// ── Public API ───────────────────────────────────────────────────────
export function formatHebrewDate(gDate) {
  try {
    const { day, year } = getHebrewParts(gDate)
    const month = FMT_MONTH_HE.format(gDate)
    const dayStr  = toHebrewDay(day)
    const yearStr = toHebrewYear(year)
    return { day: dayStr, month, year: yearStr, full: `${dayStr} ב${month} ${yearStr}` }
  } catch {
    return { day:'', month:'', year:'', full:'' }
  }
}

export function formatHebrewDayShort(gDate) {
  try {
    const { day } = getHebrewParts(gDate)
    return toHebrewDay(day)
  } catch { return '' }
}

// ── Israeli Holidays (by Hebrew month number + day) ──────────────────
// Month numbers from Intl Hebrew calendar (en-u-ca-hebrew):
// 1=Tishrei 2=Cheshvan 3=Kislev 4=Tevet 5=Shvat
// 6=Adar(normal) or Adar-I(leap) 7=Adar-II(leap) [then Nissan=8]
// In non-leap: 6=Adar, 7=Nissan, 8=Iyar, 9=Sivan, 10=Tammuz, 11=Av, 12=Elul
// In leap:     6=Adar-I, 7=Adar-II, 8=Nissan, 9=Iyar, 10=Sivan, 11=Tammuz, 12=Av, 13=Elul

// We store two sets: non-leap (nissan=7) and leap (nissan=8)
// getHoliday tries both and returns whichever matches

const HOLIDAYS_BASE = {
  // Tishrei (always 1)
  '1-1':  { name:'ראש השנה א׳', emoji:'🍎' },
  '1-2':  { name:'ראש השנה ב׳', emoji:'🍎' },
  '1-10': { name:'יום כיפור',   emoji:'✡️' },
  '1-15': { name:'סוכות',        emoji:'🌿' },
  '1-16': { name:'חול המועד',   emoji:'🌿' },
  '1-17': { name:'חול המועד',   emoji:'🌿' },
  '1-18': { name:'חול המועד',   emoji:'🌿' },
  '1-19': { name:'חול המועד',   emoji:'🌿' },
  '1-20': { name:'חול המועד',   emoji:'🌿' },
  '1-21': { name:'הושענא רבה',  emoji:'🌿' },
  '1-22': { name:'שמיני עצרת',  emoji:'📜' },
  // Kislev (3)
  '3-25': { name:'חנוכה', emoji:'🕎' },
  '3-26': { name:'חנוכה', emoji:'🕎' },
  '3-27': { name:'חנוכה', emoji:'🕎' },
  '3-28': { name:'חנוכה', emoji:'🕎' },
  '3-29': { name:'חנוכה', emoji:'🕎' },
  // Tevet (4)
  '4-1':  { name:'חנוכה',      emoji:'🕎' },
  '4-2':  { name:'חנוכה',      emoji:'🕎' },
  '4-3':  { name:'חנוכה',      emoji:'🕎' },
  '4-10': { name:'עשרה בטבת',  emoji:'✡️' },
  // Shvat (5)
  '5-15': { name:'ט״ו בשבט', emoji:'🌳' },
  // Adar non-leap (6) — Purim
  '6-13': { name:'תענית אסתר', emoji:'✡️' },
  '6-14': { name:'פורים',       emoji:'🎭' },
  '6-15': { name:'שושן פורים', emoji:'🎭' },
  // Adar-II leap (7) — Purim
  '7-13': { name:'תענית אסתר', emoji:'✡️' },
  '7-14': { name:'פורים',       emoji:'🎭' },
  '7-15': { name:'שושן פורים', emoji:'🎭' },
  // Nissan non-leap (7), leap (8) — both covered below
  '7-15': { name:'פסח א׳',          emoji:'🫓' },
  '7-16': { name:'פסח ב׳',          emoji:'🫓' },
  '7-17': { name:'חול המועד פסח',  emoji:'🫓' },
  '7-18': { name:'חול המועד פסח',  emoji:'🫓' },
  '7-19': { name:'חול המועד פסח',  emoji:'🫓' },
  '7-20': { name:'חול המועד פסח',  emoji:'🫓' },
  '7-21': { name:'שביעי של פסח',   emoji:'🫓' },
  '7-22': { name:'אחרון של פסח',   emoji:'🫓' },
  '8-15': { name:'פסח א׳',          emoji:'🫓' },
  '8-16': { name:'פסח ב׳',          emoji:'🫓' },
  '8-17': { name:'חול המועד פסח',  emoji:'🫓' },
  '8-18': { name:'חול המועד פסח',  emoji:'🫓' },
  '8-19': { name:'חול המועד פסח',  emoji:'🫓' },
  '8-20': { name:'חול המועד פסח',  emoji:'🫓' },
  '8-21': { name:'שביעי של פסח',   emoji:'🫓' },
  '8-22': { name:'אחרון של פסח',   emoji:'🫓' },
  // Iyar non-leap (8), leap (9)
  '8-4':  { name:'יום הזיכרון', emoji:'🕯️' },
  '8-5':  { name:'יום העצמאות', emoji:'🇮🇱' },
  '8-18': { name:'ל״ג בעומר',   emoji:'🔥' },
  '8-28': { name:'יום ירושלים', emoji:'🏙️' },
  '9-4':  { name:'יום הזיכרון', emoji:'🕯️' },
  '9-5':  { name:'יום העצמאות', emoji:'🇮🇱' },
  '9-18': { name:'ל״ג בעומר',   emoji:'🔥' },
  '9-28': { name:'יום ירושלים', emoji:'🏙️' },
  // Sivan non-leap (9), leap (10)
  '9-6':  { name:'שבועות',   emoji:'📜' },
  '9-7':  { name:'שבועות ב׳', emoji:'📜' },
  '10-6': { name:'שבועות',   emoji:'📜' },
  '10-7': { name:'שבועות ב׳', emoji:'📜' },
  // Av non-leap (11), leap (12)
  '11-9':  { name:'תשעה באב', emoji:'✡️' },
  '11-15': { name:'ט״ו באב',  emoji:'❤️' },
  '12-9':  { name:'תשעה באב', emoji:'✡️' },
  '12-15': { name:'ט״ו באב',  emoji:'❤️' },
}

export function getHoliday(gDate) {
  try {
    const { day, month } = getHebrewParts(gDate)
    return HOLIDAYS_BASE[`${month}-${day}`] ?? null
  } catch { return null }
}
