// Прайс и расчёты мастерской. Модуль без DOM: его используют и страница, и тесты.

export const BIKE_TYPES = {
  city: { label: 'Городской', factor: 1 },
  mtb: { label: 'Горный (MTB)', factor: 1.15 },
  road: { label: 'Шоссе / гревел', factor: 1.2 },
  kids: { label: 'Детский', factor: 0.8 },
  ebike: { label: 'Электровелосипед', factor: 1.35 },
};

// minutes — нормо-время мастера, по нему считаем срок.
export const WORK_GROUPS = [
  {
    title: 'Колёса',
    works: [
      { id: 'tube', title: 'Заменить камеру или заклеить прокол', price: 450, minutes: 20 },
      { id: 'true', title: 'Правка «восьмёрки»', price: 700, minutes: 40 },
      { id: 'spoke', title: 'Замена спицы с правкой', price: 900, minutes: 50 },
      { id: 'tubeless', title: 'Перевод на бескамерку (пара колёс)', price: 1600, minutes: 60 },
    ],
  },
  {
    title: 'Тормоза',
    works: [
      { id: 'brake-adjust', title: 'Регулировка тормозов', price: 400, minutes: 20 },
      { id: 'pads', title: 'Замена колодок', price: 350, minutes: 15 },
      { id: 'bleed', title: 'Прокачка гидравлики (оба тормоза)', price: 1400, minutes: 60 },
    ],
  },
  {
    title: 'Трансмиссия',
    works: [
      { id: 'gears', title: 'Настройка переключателей', price: 600, minutes: 30 },
      { id: 'chain', title: 'Замена цепи', price: 400, minutes: 15 },
      { id: 'cassette', title: 'Замена кассеты или трещотки', price: 500, minutes: 20 },
      { id: 'cables', title: 'Замена тросов и рубашек', price: 900, minutes: 45 },
    ],
  },
  {
    title: 'Подшипники и вилка',
    works: [
      { id: 'headset', title: 'Обслуживание рулевой колонки', price: 900, minutes: 40 },
      { id: 'bb', title: 'Обслуживание каретки', price: 800, minutes: 40 },
      { id: 'hubs', title: 'Переборка втулок (пара)', price: 1400, minutes: 70 },
      { id: 'fork', title: 'Малое ТО амортизационной вилки', price: 2200, minutes: 90 },
    ],
  },
];

export const WORKS = Object.fromEntries(
  WORK_GROUPS.flatMap((group) => group.works).map((work) => [work.id, work]),
);

// Комплексное ТО выгоднее, чем те же работы по отдельности.
export const SERVICE_BUNDLE = {
  title: 'Комплексное ТО',
  price: 4200,
  minutes: 180,
  covers: ['true', 'brake-adjust', 'gears', 'headset', 'bb', 'hubs'],
};

export const EXPRESS_SURCHARGE = 0.3;
const WORKDAY_MINUTES = 240; // время одного мастера на один велосипед в день

export function roundPrice(value) {
  return Math.round(value / 50) * 50;
}

function pickBundle(ids) {
  const covered = ids.filter((id) => SERVICE_BUNDLE.covers.includes(id));
  const separately = covered.reduce((sum, id) => sum + WORKS[id].price, 0);
  if (separately <= SERVICE_BUNDLE.price) return null;
  return { covered, separately };
}

export function termFor(minutes, express) {
  if (minutes === 0) return '—';
  if (minutes <= 60) return 'при вас, около часа';
  if (minutes <= WORKDAY_MINUTES || express) return express ? 'сегодня до закрытия' : 'на следующий день';
  const days = Math.ceil(minutes / WORKDAY_MINUTES);
  return `${days}–${days + 1} дня`;
}

/**
 * Считает предварительную стоимость ремонта.
 * Работы, входящие в комплексное ТО, заменяются им, если так дешевле.
 */
export function estimate({ type = 'city', works = [], express = false } = {}) {
  const bike = BIKE_TYPES[type];
  if (!bike) throw new Error(`Неизвестный тип велосипеда: ${type}`);
  const ids = [...new Set(works)].filter((id) => {
    if (!WORKS[id]) throw new Error(`Неизвестная работа: ${id}`);
    return true;
  });

  const bundle = pickBundle(ids);
  const single = bundle ? ids.filter((id) => !bundle.covered.includes(id)) : ids;

  const lines = single.map((id) => ({ id, title: WORKS[id].title, base: WORKS[id].price }));
  if (bundle) lines.unshift({ id: 'bundle', title: SERVICE_BUNDLE.title, base: SERVICE_BUNDLE.price });
  for (const line of lines) line.price = roundPrice(line.base * bike.factor);

  const subtotal = lines.reduce((sum, line) => sum + line.price, 0);
  const surcharge = express ? roundPrice(subtotal * EXPRESS_SURCHARGE) : 0;
  const minutes = single.reduce((sum, id) => sum + WORKS[id].minutes, 0) + (bundle ? SERVICE_BUNDLE.minutes : 0);
  const saving = bundle ? roundPrice((bundle.separately - SERVICE_BUNDLE.price) * bike.factor) : 0;

  return {
    bike: bike.label,
    lines,
    subtotal,
    surcharge,
    total: subtotal + surcharge,
    saving,
    minutes,
    term: termFor(minutes, express),
  };
}

// Сезонное хранение: мойка и консервация включены, скидка за длинный срок.
export const STORAGE_MONTHLY = { regular: 1300, ebike: 1800 };

export function storagePrice(months, ebike = false) {
  if (!Number.isInteger(months) || months < 1 || months > 8) {
    throw new RangeError('Срок хранения: от 1 до 8 месяцев');
  }
  const monthly = ebike ? STORAGE_MONTHLY.ebike : STORAGE_MONTHLY.regular;
  const discount = months >= 6 ? 0.2 : months >= 4 ? 0.1 : 0;
  const full = monthly * months;
  const total = roundPrice(full * (1 - discount));
  return { full, discount, total, perMonth: Math.round(total / months) };
}
