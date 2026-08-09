/**
 * MelroseOS Enterprise Core
 * File: CORE-10_DateTime.gs
 * Release: MOS5-CORE-10
 * Version: 1.0.0
 * Purpose: Canonical Central-time date/time utilities and business-window helpers.
 */

function MGR_getTimezone() {
  return typeof MGR_getConfig === 'function'
    ? MGR_getConfig('TIMEZONE', 'America/Chicago')
    : 'America/Chicago';
}

function MGR_now() {
  return new Date();
}

function MGR_timestamp() {
  return MGR_now().toISOString();
}

function MGR_formatDateTime(value, pattern) {
  const date = value instanceof Date ? value : new Date(value || new Date());
  if (isNaN(date.getTime())) throw new Error('Invalid date/time value.');
  return Utilities.formatDate(date, MGR_getTimezone(), pattern || 'yyyy-MM-dd HH:mm:ss');
}

function MGR_localDateKey(value) {
  return MGR_formatDateTime(value, 'yyyy-MM-dd');
}

function MGR_localTimeKey(value) {
  return MGR_formatDateTime(value, 'HH:mm:ss');
}

function MGR_startOfLocalDay(value) {
  const key = MGR_localDateKey(value);
  return MGR_parseLocalDateTime(key, '00:00:00');
}

function MGR_parseLocalDateTime(dateKey, timeKey) {
  MGR_require(dateKey, 'Date');
  const time = timeKey || '00:00:00';
  const text = String(dateKey) + ' ' + String(time);
  const parts = text.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!parts) throw new Error('Expected yyyy-MM-dd HH:mm[:ss].');

  // Apps Script Date objects are absolute instants. Parse by calculating the
  // timezone offset for the intended local wall-clock value.
  const utcGuess = new Date(Date.UTC(
    Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]),
    Number(parts[4]), Number(parts[5]), Number(parts[6] || 0)
  ));

  const tz = MGR_getTimezone();
  const offset = Utilities.formatDate(utcGuess, tz, 'Z');
  const sign = offset.charAt(0) === '-' ? -1 : 1;
  const offsetMinutes =
    sign * (Number(offset.substr(1, 2)) * 60 + Number(offset.substr(3, 2)));

  return new Date(utcGuess.getTime() - offsetMinutes * 60000);
}

function MGR_addMinutes(value, minutes) {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) throw new Error('Invalid date/time value.');
  return new Date(date.getTime() + Number(minutes || 0) * 60000);
}

function MGR_addHours(value, hours) {
  return MGR_addMinutes(value, Number(hours || 0) * 60);
}

function MGR_addDays(value, days) {
  return MGR_addHours(value, Number(days || 0) * 24);
}

function MGR_minutesBetween(start, end) {
  const a = start instanceof Date ? start : new Date(start);
  const b = end instanceof Date ? end : new Date(end);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) throw new Error('Invalid date/time value.');
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

function MGR_isWeekend(value) {
  const day = Number(MGR_formatDateTime(value, 'u')); // 1=Mon ... 7=Sun
  return day === 6 || day === 7;
}

function MGR_isWithinLocalWindow(value, startHour, endHour) {
  const hour = Number(MGR_formatDateTime(value || new Date(), 'H'));
  return hour >= Number(startHour) && hour < Number(endHour);
}

function MGR_dateTimeDiagnostics() {
  const now = MGR_now();
  return {
    success: !!MGR_getTimezone() && !isNaN(now.getTime()),
    timezone: MGR_getTimezone(),
    iso: now.toISOString(),
    local: MGR_formatDateTime(now),
    dateKey: MGR_localDateKey(now),
    timeKey: MGR_localTimeKey(now)
  };
}
