import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestOffer, checkCompatibility, formFactorRank, parseBudget } from '../shared/compat';
import type { BuildComponent, ComponentType, Offer } from '../shared/types';

const c = (type: ComponentType, specs: BuildComponent['specs'] = {}): BuildComponent => ({
  id: type,
  catalogId: type,
  type,
  name: type,
  searchQuery: type,
  specs,
});

const status = (checks: ReturnType<typeof checkCompatibility>, id: string) => checks.find((x) => x.id === id)?.status;

test('montaje compatible', () => {
  const checks = checkCompatibility([
    c('cpu', { socket: 'AM5', tdpW: 120 }),
    c('motherboard', { socket: 'Socket AM5', memoryType: 'DDR5', formFactor: 'ATX' }),
    c('ram', { memoryType: 'DDR5-6000' }),
    c('gpu', { tdpW: 250, gpuLengthMm: 300 }),
    c('psu', { psuWatts: 750 }),
    c('case', { formFactor: 'E-ATX, ATX, Micro-ATX, Mini-ITX', caseMaxGpuLengthMm: 400 }),
    c('cooler'),
  ]);
  assert.deepEqual(
    checks.map((x) => [x.id, x.status]),
    [['socket', 'ok'], ['memory', 'ok'], ['psu', 'ok'], ['formfactor', 'ok'], ['gpulength', 'ok']],
  );
});

test('detecta incompatibilidades', () => {
  const checks = checkCompatibility([
    c('cpu', { socket: 'LGA1851', tdpW: 125 }),
    c('motherboard', { socket: 'AM5', memoryType: 'DDR5', formFactor: 'ATX' }),
    c('ram', { memoryType: 'DDR4' }),
    c('gpu', { tdpW: 300, gpuLengthMm: 340 }),
    c('psu', { psuWatts: 450 }),
    c('case', { formFactor: 'Micro-ATX', caseMaxGpuLengthMm: 320 }),
  ]);
  assert.equal(status(checks, 'socket'), 'fail');
  assert.equal(status(checks, 'memory'), 'fail');
  assert.equal(status(checks, 'psu'), 'fail');
  assert.equal(status(checks, 'formfactor'), 'fail');
  assert.equal(status(checks, 'gpulength'), 'fail');
  assert.equal(status(checks, 'cooler'), 'warn');
});

test('sin datos no inventa un resultado', () => {
  const checks = checkCompatibility([c('cpu'), c('motherboard'), c('psu')]);
  assert.equal(status(checks, 'socket'), 'unknown');
  assert.equal(status(checks, 'psu'), 'unknown');
  assert.deepEqual(checkCompatibility([c('laptop')]), []);
});

test('formatos de placa', () => {
  assert.equal(formFactorRank('Micro-ATX')?.label, 'Micro-ATX');
  assert.equal(formFactorRank('ATX, Micro-ATX, Mini-ITX', 'max')?.label, 'ATX');
  assert.equal(formFactorRank('mATX')?.label, 'Micro-ATX');
});

test('mejor oferta prioriza stock y presupuesto se interpreta bien', () => {
  const o = (price: number, inStock: boolean | null): Offer => ({ storeId: String(price), store: 's', url: 'u', price, currency: 'EUR', inStock, checkedAt: '' });
  assert.equal(bestOffer([o(100, false), o(120, true), o(130, null)])?.price, 120);
  assert.equal(bestOffer([o(100, false), o(90, false)])?.price, 90);
  assert.equal(bestOffer([]), undefined);
  assert.deepEqual(parseBudget('< 800€'), { max: 800 });
  assert.deepEqual(parseBudget('800€ - 1500€'), { min: 800, max: 1500 });
  assert.deepEqual(parseBudget('> 2500€'), { min: 2500 });
});

