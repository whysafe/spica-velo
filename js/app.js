import { BIKE_TYPES, WORK_GROUPS, WORKS, estimate, storagePrice } from './estimate.js';
import { validateBooking, normalizePhone, formatPhone, ticketNumber } from './booking.js';

const STORAGE_KEY = 'spica:order';
const rub = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
const $ = (id) => document.getElementById(id);

const state = loadState();

function loadState() {
  const fallback = { type: 'city', works: [], express: false };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !BIKE_TYPES[saved.type]) return fallback;
    return { type: saved.type, works: saved.works.filter((id) => WORKS[id]), express: Boolean(saved.express) };
  } catch {
    return fallback;
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // приватный режим: просто не запоминаем выбор
  }
}

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function renderControls() {
  const chips = Object.entries(BIKE_TYPES).map(([id, bike]) =>
    el('label', { className: 'chip' }, [
      el('input', { type: 'radio', name: 'type', value: id, checked: id === state.type }),
      el('span', { textContent: bike.label }),
    ]),
  );
  $('bike-types').replaceChildren(...chips);

  const groups = WORK_GROUPS.map((group) =>
    el('fieldset', { className: 'group' }, [
      el('legend', { textContent: group.title }),
      ...group.works.map((work) =>
        el('label', { className: 'work' }, [
          el('input', { type: 'checkbox', name: 'work', value: work.id, checked: state.works.includes(work.id) }),
          el('span', { className: 'work-title', textContent: work.title }),
          el('span', { className: 'work-price', textContent: `от ${rub.format(work.price)}` }),
        ]),
      ),
    ]),
  );
  $('work-groups').replaceChildren(...groups);
  $('express').checked = state.express;
}

function renderTicket() {
  const result = estimate(state);
  $('ticket-bike').textContent = result.bike;
  const lines = result.lines.map((line) =>
    el('li', {}, [el('span', { textContent: line.title }), el('b', { textContent: rub.format(line.price) })]),
  );
  if (result.surcharge) {
    lines.push(el('li', { className: 'extra' }, [el('span', { textContent: 'Срочность' }), el('b', { textContent: `+${rub.format(result.surcharge)}` })]));
  }
  if (lines.length === 0) lines.push(el('li', { className: 'empty', textContent: 'Отметьте работы слева' }));
  $('ticket-lines').replaceChildren(...lines);

  const saving = $('ticket-saving');
  saving.hidden = result.saving === 0;
  saving.textContent = `Объединили в комплексное ТО — выгоднее на ${rub.format(result.saving)}`;
  $('ticket-total').textContent = rub.format(result.total);
  $('ticket-term').textContent = result.term;

  $('b-works').textContent = state.works.length
    ? `${result.bike}: ${result.lines.map((l) => l.title.toLowerCase()).join(', ')} — ${rub.format(result.total)}`
    : 'Ничего не выбрано — отметьте работы в калькуляторе выше.';
}

function onCalcChange(event) {
  const input = event.target;
  if (input.name === 'type') state.type = input.value;
  if (input.name === 'work') {
    state.works = input.checked ? [...state.works, input.value] : state.works.filter((id) => id !== input.value);
  }
  if (input.id === 'express') state.express = input.checked;
  saveState();
  renderTicket();
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function renderStorage() {
  const months = Number($('months').value);
  const price = storagePrice(months, $('storage-ebike').checked);
  $('months-out').textContent = `${months} ${plural(months, 'месяц', 'месяца', 'месяцев')}`;
  $('storage-total').textContent = rub.format(price.total);
  $('storage-detail').textContent = price.discount
    ? `${rub.format(price.perMonth)} в месяц, скидка ${price.discount * 100}% (без неё ${rub.format(price.full)})`
    : `${rub.format(price.perMonth)} в месяц`;
  $('months').style.setProperty('--fill', `${((months - 1) / 7) * 100}%`);
}

function isoDate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function onBookingSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = { name: form.name.value, phone: form.phone.value, date: form.date.value, works: state.works };
  const { ok, errors } = validateBooking(data, isoDate(new Date()));

  for (const key of ['name', 'phone', 'date', 'works']) {
    $(`err-${key}`).textContent = errors[key] ?? '';
    const input = form.elements[key];
    if (input) input.setAttribute('aria-invalid', String(Boolean(errors[key])));
  }
  if (!ok) {
    form.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }

  const phone = normalizePhone(data.phone);
  const day = new Date(`${data.date}T12:00:00`);
  const date = `${day.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} (${day.toLocaleDateString('ru-RU', { weekday: 'long' })})`;
  const done = $('booking-done');
  done.replaceChildren(
    el('p', { className: 'done-number', textContent: `Квитанция ${ticketNumber(phone, data.date)}` }),
    el('h3', { textContent: `${data.name.trim()}, ждём вас ${date}` }),
    el('p', { textContent: `Перезвоним на ${formatPhone(phone)}, чтобы подтвердить время. Предварительно: ${$('ticket-total').textContent}.` }),
  );
  form.hidden = true;
  done.hidden = false;
  done.focus();
}

function initBikeSpin() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const wheels = document.querySelectorAll('.wheel');
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      wheels.forEach((wheel) => wheel.style.setProperty('--turn', `${scrollY * 0.6}deg`));
      ticking = false;
    });
  }, { passive: true });
}

function init() {
  renderControls();
  renderTicket();
  renderStorage();
  $('calc-form').addEventListener('change', onCalcChange);
  $('months').addEventListener('input', renderStorage);
  $('storage-ebike').addEventListener('change', renderStorage);
  $('booking-form').addEventListener('submit', onBookingSubmit);
  $('b-date').min = isoDate(new Date());
  initBikeSpin();
}

init();
