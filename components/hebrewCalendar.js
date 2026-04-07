// Hebrew Calendar — uses English month NAMES from Intl (not numbers)
// Month numbers from Intl vary by environment/locale — names are reliable

// ── Gematria ────────────────────────────────────────────────────────
const ONES  = ['','א','ב','ג','ד','ה','ו','ז','ח','ט']
const TENS  = ['','י','כ','ל','מ','נ','ס','ע','פ','צ']
const HUNDS = ['','ק','ר','ש','ת','תק','תר','תש','תת','תתק']

function numToGematria(n) {
  if (n <= 0) return ''
  let result = ''
  const h = Math.floor(n / 100); result += HUNDS[h]; n -= h * 100
  if (n === 15) { result += 'ט״ו'; return result }
  if (n === 16) { result += 'ט״ז'; return result }
  const t = Math.floor(n / 10); result += TENS[t]; n -= t * 10
  result += ONES[n]
  return result
}

function addPunctuation(s) {
  if (!s) return ''
  if (s.length === 1) return s + '׳'
  return s.slice(0, -1) + '״' + s.slice(-1)
}

function toHebrewDay(n)  { return addPunctuation(numToGematria(n)) }
function toHebrewYear(y) { return addPunctuation(numToGematria(y % 1000)) }

// ── Intl formatters ─────────────────────────────────────────────────
// Use English locale for month name — reliable cross-platform
const FMT_EN = new Intl.DateTimeFormat('en-u-ca-hebrew', {
  day: 'numeric', month: 'long', year: 'numeric'
})
const FMT_MONTH_HE = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month: 'long' })
const FMT_DAY_HE   = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day:   'numeric' })
const FMT_YEAR_HE  = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { year:  'numeric' })

function getHebrewParts(gDate) {
  const parts = {}
  FMT_EN.formatToParts(gDate).forEach(p => { parts[p.type] = p.value })
  return {
    day:   parseInt(parts.day   ?? '0', 10),
    month: (parts.month ?? '').trim(),   // English name e.g. "Nisan", "Adar I"
    year:  parseInt(parts.year  ?? '0', 10),
  }
}

// ── Public API ───────────────────────────────────────────────────────
export function formatHebrewDate(gDate) {
  try {
    const { day, year } = getHebrewParts(gDate)
    const month  = FMT_MONTH_HE.format(gDate)
    const dayStr  = toHebrewDay(day)
    const yearStr = toHebrewYear(year)
    return { day: dayStr, month, year: yearStr, full: `${dayStr} ב${month} ${yearStr}` }
  } catch {
    return { day: '', month: '', year: '', full: '' }
  }
}

export function formatHebrewDayShort(gDate) {
  try {
    const { day } = getHebrewParts(gDate)
    return toHebrewDay(day)
  } catch { return '' }
}

// ── Holidays — keyed by English month name + day ─────────────────────
// Month names as returned by Intl with en-u-ca-hebrew:
// Non-leap: Tishri, Heshvan, Kislev, Tevet, Shevat, Adar, Nisan, Iyar, Sivan, Tamuz, Av, Elul
// Leap:     Tishri, Heshvan, Kislev, Tevet, Shevat, Adar I, Adar II, Nisan, Iyar, Sivan, Tamuz, Av, Elul

const HOLIDAYS = {
  // Tishri
  'Tishri-1':   { name: 'ראש השנה א׳', emoji: '🍎' },
  'Tishri-2':   { name: 'ראש השנה ב׳', emoji: '🍎' },
  'Tishri-3':   { name: 'צום גדליה',   emoji: '✡️'  },
  'Tishri-10':  { name: 'יום כיפור',   emoji: '✡️'  },
  'Tishri-15':  { name: 'סוכות',        emoji: '🌿' },
  'Tishri-16':  { name: 'חול המועד',   emoji: '🌿' },
  'Tishri-17':  { name: 'חול המועד',   emoji: '🌿' },
  'Tishri-18':  { name: 'חול המועד',   emoji: '🌿' },
  'Tishri-19':  { name: 'חול המועד',   emoji: '🌿' },
  'Tishri-20':  { name: 'חול המועד',   emoji: '🌿' },
  'Tishri-21':  { name: 'הושענא רבה',  emoji: '🌿' },
  'Tishri-22':  { name: 'שמיני עצרת',  emoji: '📜' },
  // Kislev — Hanukkah
  'Kislev-25':  { name: 'חנוכה',        emoji: '🕎' },
  'Kislev-26':  { name: 'חנוכה',        emoji: '🕎' },
  'Kislev-27':  { name: 'חנוכה',        emoji: '🕎' },
  'Kislev-28':  { name: 'חנוכה',        emoji: '🕎' },
  'Kislev-29':  { name: 'חנוכה',        emoji: '🕎' },
  // Tevet — rest of Hanukkah
  'Tevet-1':    { name: 'חנוכה',        emoji: '🕎' },
  'Tevet-2':    { name: 'חנוכה',        emoji: '🕎' },
  'Tevet-3':    { name: 'חנוכה',        emoji: '🕎' },
  'Tevet-10':   { name: 'עשרה בטבת',   emoji: '✡️'  },
  // Shevat
  'Shevat-15':  { name: 'ט״ו בשבט',    emoji: '🌳' },
  // Adar (non-leap)
  'Adar-13':    { name: 'תענית אסתר',  emoji: '✡️'  },
  'Adar-14':    { name: 'פורים',         emoji: '🎭' },
  'Adar-15':    { name: 'שושן פורים',  emoji: '🎭' },
  // Adar I (leap) — Purim Katan
  'Adar I-14':  { name: 'פורים קטן',   emoji: '🎭' },
  'Adar I-15':  { name: 'שושן פורים קטן', emoji: '🎭' },
  // Adar II (leap) — real Purim
  'Adar II-13': { name: 'תענית אסתר',  emoji: '✡️'  },
  'Adar II-14': { name: 'פורים',         emoji: '🎭' },
  'Adar II-15': { name: 'שושן פורים',  emoji: '🎭' },
  // Nisan — Pesach
  'Nisan-14':   { name: 'ערב פסח',      emoji: '🫓' },
  'Nisan-15':   { name: 'פסח א׳',       emoji: '🫓' },
  'Nisan-16':   { name: 'פסח ב׳',       emoji: '🫓' },
  'Nisan-17':   { name: 'חול המועד',   emoji: '🫓' },
  'Nisan-18':   { name: 'חול המועד',   emoji: '🫓' },
  'Nisan-19':   { name: 'חול המועד',   emoji: '🫓' },
  'Nisan-20':   { name: 'חול המועד',   emoji: '🫓' },
  'Nisan-21':   { name: 'שביעי של פסח', emoji: '🫓' },
  'Nisan-22':   { name: 'אחרון של פסח', emoji: '🫓' },
  'Nisan-27':   { name: 'יום השואה',   emoji: '🕯️' },
  // Iyar
  'Iyar-4':     { name: 'יום הזיכרון', emoji: '🕯️' },
  'Iyar-5':     { name: 'יום העצמאות', emoji: '🇮🇱' },
  'Iyar-18':    { name: 'ל״ג בעומר',   emoji: '🔥' },
  'Iyar-28':    { name: 'יום ירושלים', emoji: '🏙️' },
  // Sivan
  'Sivan-5':    { name: 'ערב שבועות',  emoji: '📜' },
  'Sivan-6':    { name: 'שבועות',       emoji: '📜' },
  'Sivan-7':    { name: 'שבועות ב׳',   emoji: '📜' },
  // Tamuz
  'Tamuz-17':   { name: 'י״ז בתמוז',   emoji: '✡️'  },
  // Av
  'Av-9':       { name: 'תשעה באב',    emoji: '✡️'  },
  'Av-15':      { name: 'ט״ו באב',     emoji: '❤️'  },
}

export function getHoliday(gDate) {
  try {
    const { day, month } = getHebrewParts(gDate)
    const key = `${month}-${day}`
    return HOLIDAYS[key] ?? null
  } catch { return null }
}
