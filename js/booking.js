// Проверка заявки на ремонт. Даты передаются строками YYYY-MM-DD, «сегодня» — параметром,
// чтобы результат не зависел от часов компьютера.

export const MAX_DAYS_AHEAD = 30;
const CLOSED_WEEKDAY = 1; // понедельник — выходной мастерской

export function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('9')) return `+7${digits}`;
  if (digits.length === 11 && /^[78]9/.test(digits)) return `+7${digits.slice(1)}`;
  return null;
}

export function formatPhone(normalized) {
  const d = normalized.slice(2);
  return `+7 ${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  return date.getUTCDate() === +match[3] ? date : null;
}

export function daysBetween(from, to) {
  return Math.round((parseDate(to) - parseDate(from)) / 86_400_000);
}

export function validateBooking({ name, phone, date, works = [] }, today) {
  const errors = {};
  const cleanName = String(name ?? '').trim();
  if (cleanName.length < 2) errors.name = 'Как к вам обращаться?';
  else if (!/^[\p{L}\s'-]+$/u.test(cleanName)) errors.name = 'Только буквы, пробел и дефис';

  if (!normalizePhone(phone)) errors.phone = 'Мобильный номер: +7 9XX XXX-XX-XX';

  const day = parseDate(date);
  if (!day) {
    errors.date = 'Выберите дату';
  } else {
    const ahead = daysBetween(today, date);
    if (ahead < 0) errors.date = 'Эта дата уже прошла';
    else if (ahead > MAX_DAYS_AHEAD) errors.date = `Записываем не дальше чем на ${MAX_DAYS_AHEAD} дней`;
    else if (day.getUTCDay() === CLOSED_WEEKDAY) errors.date = 'По понедельникам мастерская закрыта';
  }

  if (works.length === 0) errors.works = 'Отметьте хотя бы одну работу в калькуляторе';
  return { ok: Object.keys(errors).length === 0, errors };
}

// Короткий номер квитанции, по которому клиент найдёт заявку в чате.
export function ticketNumber(phone, date) {
  let hash = 0;
  for (const ch of `${phone}|${date}`) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `С-${String(hash % 100000).padStart(5, '0')}`;
}
