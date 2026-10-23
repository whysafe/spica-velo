import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimate, storagePrice, termFor, roundPrice, WORKS, SERVICE_BUNDLE } from '../js/estimate.js';
import { normalizePhone, formatPhone, validateBooking, ticketNumber, daysBetween } from '../js/booking.js';

test('пустой заказ стоит ноль', () => {
  const result = estimate({});
  assert.equal(result.total, 0);
  assert.equal(result.term, '—');
});

test('городской велосипед: цены прайса без наценки', () => {
  const result = estimate({ type: 'city', works: ['tube', 'chain'] });
  assert.equal(result.total, 850);
  assert.equal(result.minutes, 35);
  assert.equal(result.term, 'при вас, около часа');
});

test('коэффициент типа велосипеда округляется до 50 ₽', () => {
  const result = estimate({ type: 'ebike', works: ['tube'] });
  assert.equal(result.lines[0].price, roundPrice(450 * 1.35));
  assert.equal(result.lines[0].price % 50, 0);
});

test('комплексное ТО подставляется, когда оно дешевле', () => {
  const ids = ['true', 'gears', 'headset', 'bb', 'hubs', 'brake-adjust', 'chain'];
  const result = estimate({ works: ids });
  assert.equal(result.lines[0].id, 'bundle');
  assert.deepEqual(result.lines.map((l) => l.id), ['bundle', 'chain']);
  const separately = 700 + 600 + 900 + 800 + 1400 + 400;
  assert.equal(result.saving, separately - SERVICE_BUNDLE.price);
  assert.equal(result.total, SERVICE_BUNDLE.price + WORKS.chain.price);
});

test('комплексное ТО не навязывается, если работ мало', () => {
  const result = estimate({ works: ['gears', 'brake-adjust'] });
  assert.ok(result.lines.every((l) => l.id !== 'bundle'));
  assert.equal(result.saving, 0);
});

test('срочность добавляет 30% и меняет срок', () => {
  const normal = estimate({ works: ['fork', 'bleed'] });
  const express = estimate({ works: ['fork', 'bleed'], express: true });
  assert.equal(express.surcharge, roundPrice(normal.subtotal * 0.3));
  assert.equal(normal.term, 'на следующий день');
  assert.equal(express.term, 'сегодня до закрытия');
});

test('дубликаты работ не считаются дважды', () => {
  assert.equal(estimate({ works: ['tube', 'tube'] }).total, 450);
});

test('неизвестные значения отклоняются', () => {
  assert.throws(() => estimate({ type: 'unicycle' }), /тип/);
  assert.throws(() => estimate({ works: ['paint'] }), /работа/);
});

test('срок для больших объёмов — в днях', () => {
  assert.equal(termFor(500, false), '3–4 дня');
});

test('хранение: скидки 10% с 4 месяцев и 20% с 6', () => {
  assert.equal(storagePrice(3).total, 3900);
  assert.equal(storagePrice(4).total, roundPrice(1300 * 4 * 0.9));
  assert.equal(storagePrice(6, true).total, roundPrice(1800 * 6 * 0.8));
  assert.throws(() => storagePrice(0), RangeError);
  assert.throws(() => storagePrice(2.5), RangeError);
});

test('телефон: разные записи приводятся к +7', () => {
  assert.equal(normalizePhone('8 (912) 345-67-89'), '+79123456789');
  assert.equal(normalizePhone('+7 912 345 67 89'), '+79123456789');
  assert.equal(normalizePhone('9123456789'), '+79123456789');
  assert.equal(normalizePhone('+7 495 123-45-67'), null);
  assert.equal(normalizePhone('12345'), null);
  assert.equal(formatPhone('+79123456789'), '+7 912 345-67-89');
});

test('заявка: правильная проходит проверку', () => {
  const result = validateBooking(
    { name: 'Анна-Мария', phone: '89123456789', date: '2026-10-28', works: ['tube'] },
    '2026-10-23',
  );
  assert.deepEqual(result, { ok: true, errors: {} });
});

test('заявка: прошлое, понедельник и далёкие даты отклоняются', () => {
  const base = { name: 'Иван', phone: '89123456789', works: ['tube'] };
  const today = '2026-10-23';
  assert.match(validateBooking({ ...base, date: '2026-10-22' }, today).errors.date, /прошла/);
  assert.match(validateBooking({ ...base, date: '2026-10-26' }, today).errors.date, /понедельник/);
  assert.match(validateBooking({ ...base, date: '2026-12-01' }, today).errors.date, /30/);
  assert.match(validateBooking({ ...base, date: '2026-02-30' }, today).errors.date, /Выберите/);
});

test('заявка: пустые поля дают все ошибки сразу', () => {
  const { ok, errors } = validateBooking({ name: ' ', phone: '', date: '' }, '2026-10-23');
  assert.equal(ok, false);
  assert.deepEqual(Object.keys(errors).sort(), ['date', 'name', 'phone', 'works']);
});

test('номер квитанции стабилен и одного формата', () => {
  const a = ticketNumber('+79123456789', '2026-10-28');
  assert.equal(a, ticketNumber('+79123456789', '2026-10-28'));
  assert.match(a, /^С-\d{5}$/);
  assert.equal(daysBetween('2026-10-23', '2026-11-02'), 10);
});
