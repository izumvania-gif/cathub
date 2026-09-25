// Shared helpers for pb_hooks (CommonJS, loaded with require()).

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

function newInviteCode(app) {
  for (let i = 0; i < 10; i++) {
    const code = $security.randomStringWithAlphabet(8, ALPHABET);
    try {
      app.findFirstRecordByData('households', 'invite_code', code);
    } catch (_) {
      return code; // not taken
    }
  }
  throw new Error('could not generate a unique invite code');
}

function normalizeCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function isValidTimezone(tz) {
  return /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(tz) && tz.length <= 64;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const UNITS = ['hour', 'day', 'week', 'month', 'year'];

/** Returns an error message or '' if the schedule looks valid. */
function validateSchedule(raw) {
  let s;
  try {
    s = JSON.parse(String(raw || ''));
  } catch (_) {
    return 'не JSON';
  }
  if (!s || typeof s !== 'object') return 'пусто';
  switch (s.kind) {
    case 'daily_slots':
      if (!Array.isArray(s.times) || s.times.length === 0 || s.times.length > 12)
        return 'нужно 1–12 времён';
      if (!s.times.every((t) => TIME_RE.test(t))) return 'время в формате ЧЧ:ММ';
      if (s.weekdays && !(Array.isArray(s.weekdays) && s.weekdays.every((d) => d >= 1 && d <= 7)))
        return 'дни недели 1–7';
      return '';
    case 'interval':
      if (!(Number.isInteger(s.every) && s.every >= 1 && s.every <= 1000)) return 'интервал 1–1000';
      if (UNITS.indexOf(s.unit) === -1) return 'неизвестная единица';
      if (s.anchor !== 'completion' && s.anchor !== 'calendar') return 'неизвестная привязка';
      if (!s.startDate || isNaN(Date.parse(s.startDate))) return 'нет даты начала';
      if (s.graceDays !== undefined && !(s.graceDays >= 0 && s.graceDays <= 365))
        return 'допуск 0–365 дней';
      return '';
    case 'once':
      if (!s.at || isNaN(Date.parse(s.at))) return 'нет даты';
      return '';
    default:
      return 'неизвестный тип';
  }
}

module.exports = { newInviteCode, normalizeCode, isValidTimezone, validateSchedule };
