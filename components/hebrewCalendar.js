// =====================================================================
// Hebrew Calendar Converter
// Based on the Meeus/Jones/Butcher algorithm + Hebrew calendar arithmetic
// =====================================================================

const HEB_MONTHS = [
  '', 'תשרי', 'חשוון', 'כסלו', 'טבת', 'שבט', 'אדר', 'אדר א׳', 'אדר ב׳',
  'ניסן', 'אייר', 'סיוון', 'תמוז', 'אב', 'אלול'
]

const HEB_NUMBERS = [
  '', 'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳', 'י׳',
  'י״א', 'י״ב', 'י״ג', 'י״ד', 'ט״ו', 'ט״ז', 'י״ז', 'י״ח', 'י״ט', 'כ׳',
  'כ״א', 'כ״ב', 'כ״ג', 'כ״ד', 'כ״ה', 'כ״ו', 'כ״ז', 'כ״ח', 'כ״ט', 'ל׳'
]

const HEB_YEARS_SHORT = {
  5784: 'תשפ״ד', 5785: 'תשפ״ה', 5786: 'תשפ״ו',
  5787: 'תשפ״ז', 5788: 'תשפ״ח', 5789: 'תשפ״ט', 5790: 'תש״צ'
}

// Core conversion: Gregorian → Julian Day Number
function gregorianToJD(year, month, day) {
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3
  return day + Math.floor((153 * m + 2) / 5) + 365 * y +
    Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045
}

// Julian Day Number → Hebrew date
function jdToHebrew(jd) {
  const l = jd - 1948440 + 10632
  const n = Math.floor((l - 1) / 1461)
  const r = l - 1461 * n
  const i = Math.floor((r - 1) / 365) - Math.floor(r / 1461)
  const j = r - 365 * i + 30
  let k = Math.floor((3 * Math.floor((j + 359) / 414) + 2) / 3)
  const day = j - Math.floor(29 * k / 12) - 29 * Math.floor((k - 1) / 12) + Math.floor((8 * k + 29) / 29) + 30 * Math.floor(k / 12) - 1
  const month = k > 12 ? k - 12 : k
  const year = 19 * n + i + 5001 + Math.floor((8 * 19 * n + 8 * i + 13) / 228)
  return { day, month, year }
}

export function gregorianToHebrew(gDate) {
  const jd = gregorianToJD(gDate.getFullYear(), gDate.getMonth() + 1, gDate.getDate())
  return jdToHebrew(jd)
}

export function formatHebrewDate(gDate) {
  const { day, month, year } = gregorianToHebrew(gDate)
  const dayStr   = HEB_NUMBERS[day]  ?? String(day)
  const monthStr = HEB_MONTHS[month] ?? ''
  const yearStr  = HEB_YEARS_SHORT[year] ?? String(year)
  return { day: dayStr, month: monthStr, year: yearStr, full: `${dayStr} ב${monthStr} ${yearStr}` }
}

export function formatHebrewDayShort(gDate) {
  const { day, month } = gregorianToHebrew(gDate)
  return `${HEB_NUMBERS[day] ?? day} ${HEB_MONTHS[month] ?? ''}`
}

// =====================================================================
// Israeli Holidays — keyed by Hebrew month+day: "M-D"
// =====================================================================
const HOLIDAYS = {
  // Tishrei (1)
  '1-1':  { name: 'ראש השנה א׳', emoji: '🍎' },
  '1-2':  { name: 'ראש השנה ב׳', emoji: '🍎' },
  '1-3':  { name: 'צום גדליה',    emoji: '✡️' },
  '1-10': { name: 'יום כיפור',    emoji: '✡️' },
  '1-15': { name: 'סוכות',        emoji: '🌿' },
  '1-16': { name: 'חול המועד',    emoji: '🌿' },
  '1-17': { name: 'חול המועד',    emoji: '🌿' },
  '1-18': { name: 'חול המועד',    emoji: '🌿' },
  '1-19': { name: 'חול המועד',    emoji: '🌿' },
  '1-20': { name: 'חול המועד',    emoji: '🌿' },
  '1-21': { name: 'הושענא רבה',   emoji: '🌿' },
  '1-22': { name: 'שמיני עצרת / שמחת תורה', emoji: '📜' },
  // Kislev (3)
  '3-25': { name: 'חנוכה א׳',     emoji: '🕎' },
  '3-26': { name: 'חנוכה ב׳',     emoji: '🕎' },
  '3-27': { name: 'חנוכה ג׳',     emoji: '🕎' },
  '3-28': { name: 'חנוכה ד׳',     emoji: '🕎' },
  '3-29': { name: 'חנוכה ה׳',     emoji: '🕎' },
  // Tevet (4)
  '4-1':  { name: 'חנוכה ו׳',     emoji: '🕎' },
  '4-2':  { name: 'חנוכה ז׳',     emoji: '🕎' },
  '4-3':  { name: 'חנוכה ח׳',     emoji: '🕎' },
  '4-10': { name: 'עשרה בטבת',    emoji: '✡️' },
  // Shvat (5)
  '5-15': { name: 'ט״ו בשבט',     emoji: '🌳' },
  // Adar (6) / Adar II (8)
  '6-13': { name: 'תענית אסתר',   emoji: '✡️' },
  '6-14': { name: 'פורים',         emoji: '🎭' },
  '6-15': { name: 'שושן פורים',   emoji: '🎭' },
  '8-13': { name: 'תענית אסתר',   emoji: '✡️' },
  '8-14': { name: 'פורים',         emoji: '🎭' },
  '8-15': { name: 'שושן פורים',   emoji: '🎭' },
  // Nissan (9)
  '9-15': { name: 'פסח א׳',        emoji: '🫓' },
  '9-16': { name: 'פסח ב׳',        emoji: '🫓' },
  '9-17': { name: 'חול המועד',     emoji: '🫓' },
  '9-18': { name: 'חול המועד',     emoji: '🫓' },
  '9-19': { name: 'חול המועד',     emoji: '🫓' },
  '9-20': { name: 'חול המועד',     emoji: '🫓' },
  '9-21': { name: 'שביעי של פסח',  emoji: '🫓' },
  '9-22': { name: 'אחרון של פסח',  emoji: '🫓' },
  // Iyar (10)
  '10-4': { name: 'יום הזיכרון',   emoji: '🕯️' },
  '10-5': { name: 'יום העצמאות',   emoji: '🇮🇱' },
  '10-18':{ name: 'ל״ג בעומר',     emoji: '🔥' },
  '10-28':{ name: 'יום ירושלים',   emoji: '🏙️' },
  // Sivan (11)
  '11-6': { name: 'שבועות',         emoji: '📜' },
  '11-7': { name: 'שבועות ב׳',      emoji: '📜' },
  // Tammuz (12)
  '12-17':{ name: 'שבעה עשר בתמוז', emoji: '✡️' },
  // Av (13)
  '13-9': { name: 'תשעה באב',       emoji: '✡️' },
  '13-15':{ name: 'ט״ו באב',        emoji: '❤️' },
  // Elul (14)
}

export function getHoliday(gDate) {
  const { day, month } = gregorianToHebrew(gDate)
  return HOLIDAYS[`${month}-${day}`] ?? null
}
