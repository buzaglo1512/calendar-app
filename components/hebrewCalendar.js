// Hebrew Calendar using Intl.DateTimeFormat with Hebrew calendar
// Uses formatToParts to get clean numeric values — no algorithm bugs

const FMT_PARTS = new Intl.DateTimeFormat('en-u-ca-hebrew', {
  day: 'numeric', month: 'numeric', year: 'numeric'
})

const FMT_MONTH_HE = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month: 'long' })
const FMT_DAY_HE   = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day:   'numeric' })
const FMT_YEAR_HE  = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { year:  'numeric' })

// Get Hebrew date as plain numbers {day, month, year}
function getHebrewParts(gDate) {
  const parts = {}
  FMT_PARTS.formatToParts(gDate).forEach(p => { parts[p.type] = p.value })
  return {
    day:   parseInt(parts.day   ?? '0', 10),
    month: parseInt(parts.month ?? '0', 10),
    year:  parseInt(parts.year  ?? '0', 10),
  }
}

export function formatHebrewDate(gDate) {
  try {
    const day   = FMT_DAY_HE.format(gDate)
    const month = FMT_MONTH_HE.format(gDate)
    const year  = FMT_YEAR_HE.format(gDate)
    return { day, month, year, full: `${day} ${month} ${year}` }
  } catch {
    return { day: '', month: '', year: '', full: '' }
  }
}

export function formatHebrewDayShort(gDate) {
  try { return FMT_DAY_HE.format(gDate) } catch { return '' }
}

// ── Holidays keyed by Hebrew month number + day number ─────────────
// Month numbers in Hebrew calendar:
//  1=Tishrei 2=Cheshvan 3=Kislev 4=Tevet 5=Shvat
//  6=Adar(regular) or Adar-I(leap) 7=Adar-II(leap only)
//  8=Nissan 9=Iyar 10=Sivan 11=Tammuz 12=Av 13=Elul
// Note: In Intl, months are 1-based and leap year Adar-I=6, Adar-II=7, Nissan=8 etc.

const HOLIDAYS = {
  '1-1':  { name: 'ראש השנה א׳', emoji: '🍎' },
  '1-2':  { name: 'ראש השנה ב׳', emoji: '🍎' },
  '1-10': { name: 'יום כיפור',   emoji: '✡️' },
  '1-15': { name: 'סוכות',        emoji: '🌿' },
  '1-16': { name: 'חול המועד',   emoji: '🌿' },
  '1-17': { name: 'חול המועד',   emoji: '🌿' },
  '1-18': { name: 'חול המועד',   emoji: '🌿' },
  '1-19': { name: 'חול המועד',   emoji: '🌿' },
  '1-20': { name: 'חול המועד',   emoji: '🌿' },
  '1-21': { name: 'הושענא רבה',  emoji: '🌿' },
  '1-22': { name: 'שמיני עצרת',  emoji: '📜' },
  '3-25': { name: 'חנוכה',        emoji: '🕎' },
  '3-26': { name: 'חנוכה',        emoji: '🕎' },
  '3-27': { name: 'חנוכה',        emoji: '🕎' },
  '3-28': { name: 'חנוכה',        emoji: '🕎' },
  '3-29': { name: 'חנוכה',        emoji: '🕎' },
  '4-1':  { name: 'חנוכה',        emoji: '🕎' },
  '4-2':  { name: 'חנוכה',        emoji: '🕎' },
  '4-3':  { name: 'חנוכה',        emoji: '🕎' },
  '4-10': { name: 'עשרה בטבת',   emoji: '✡️' },
  '5-15': { name: 'ט״ו בשבט',    emoji: '🌳' },
  '6-14': { name: 'פורים',         emoji: '🎭' },
  '6-15': { name: 'שושן פורים',  emoji: '🎭' },
  '7-14': { name: 'פורים',         emoji: '🎭' },
  '7-15': { name: 'שושן פורים',  emoji: '🎭' },
  '8-15': { name: 'פסח א׳',       emoji: '🫓' },
  '8-16': { name: 'פסח ב׳',       emoji: '🫓' },
  '8-17': { name: 'חול המועד',   emoji: '🫓' },
  '8-18': { name: 'חול המועד',   emoji: '🫓' },
  '8-19': { name: 'חול המועד',   emoji: '🫓' },
  '8-20': { name: 'חול המועד',   emoji: '🫓' },
  '8-21': { name: 'שביעי של פסח', emoji: '🫓' },
  '8-22': { name: 'אחרון של פסח', emoji: '🫓' },
  '9-4':  { name: 'יום הזיכרון', emoji: '🕯️' },
  '9-5':  { name: 'יום העצמאות', emoji: '🇮🇱' },
  '9-18': { name: 'ל״ג בעומר',   emoji: '🔥' },
  '9-28': { name: 'יום ירושלים', emoji: '🏙️' },
  '10-6': { name: 'שבועות',       emoji: '📜' },
  '10-7': { name: 'שבועות ב׳',   emoji: '📜' },
  '12-9': { name: 'תשעה באב',    emoji: '✡️' },
  '12-15':{ name: 'ט״ו באב',     emoji: '❤️' },
}

export function getHoliday(gDate) {
  try {
    const { day, month } = getHebrewParts(gDate)
    return HOLIDAYS[`${month}-${day}`] ?? null
  } catch {
    return null
  }
}
