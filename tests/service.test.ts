import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app';
import { CATALOG, CATALOG_BY_ID, type CatalogItem } from '../server/catalog';
import { recommend, type PriceSource } from '../server/engine';
import { PriceService } from '../server/priceService';
import type { Offer, RecommendResponse } from '../shared/types';

const jsonLd = (name: string, price: number, availability = 'InStock') =>
  `<html><script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    offers: { '@type': 'Offer', price: price.toFixed(2), priceCurrency: 'EUR', availability: `https://schema.org/${availability}` },
  })}</script></html>`;

type Page = { status: number; body?: string };

function fakeFetch(pages: Record<string, Page>, calls: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith('/robots.txt')) {
      return url.includes('neobyte') ? new Response('User-agent: *\nDisallow: /*controller=search', { status: 200 }) : new Response('', { status: 404 });
    }
    const p = pages[url];
    return p ? new Response(p.body ?? '', { status: p.status }) : new Response('not found', { status: 404 });
  }) as typeof fetch;
}

const testItem: CatalogItem = {
  id: 'gpu-test',
  type: 'gpu',
  name: 'NVIDIA GeForce RTX 5070 12 GB',
  match: ['5070'],
  exclude: ['ti'],
  query: 'RTX 5070',
  seeds: [
    'https://www.coolmod.com/msi-rtx-5070-ventus/',
    'https://www.pccomponentes.com/gigabyte-rtx-5070-gaming-oc',
    'https://www.neobyte.es/rtx-5070-descatalogada-1.html',
    'https://www.wipoid.com/msi-rtx-5070-ti.html',
  ],
  listings: ['https://www.pccomponentes.com/categorias/tarjetas-graficas/nvidia-rtx-5070'],
  reason: '',
  specs: {},
};

const listing = `<html><body>
  <a href="/zotac-rtx-5070-solid" title="ZOTAC GAMING GeForce RTX 5070 SOLID 12GB">ZOTAC RTX 5070 SOLID</a>
  <a href="/msi-rtx-5070-ti-ventus">MSI RTX 5070 Ti Ventus</a>
  <a href="/buscar/?query=5070">Buscar</a>
</body></html>`;

test('PriceService: lee precios reales, descubre fichas y descarta lo que no encaja', async () => {
  const pages: Record<string, Page> = {
    'https://www.coolmod.com/msi-rtx-5070-ventus/': { status: 200, body: jsonLd('MSI GeForce RTX 5070 VENTUS 2X OC 12GB', 975.95) },
    'https://www.pccomponentes.com/gigabyte-rtx-5070-gaming-oc': { status: 200, body: jsonLd('Gigabyte GeForce RTX 5070 GAMING OC 12GB', 1099.99) },
    'https://www.wipoid.com/msi-rtx-5070-ti.html': { status: 200, body: jsonLd('MSI GeForce RTX 5070 Ti VENTUS 3X 16GB', 1599) },
    'https://www.pccomponentes.com/categorias/tarjetas-graficas/nvidia-rtx-5070': { status: 200, body: listing },
    'https://www.pccomponentes.com/zotac-rtx-5070-solid': { status: 200, body: jsonLd('ZOTAC GAMING GeForce RTX 5070 SOLID 12GB', 1049, 'OutOfStock') },
  };
  const calls: string[] = [];
  const svc = new PriceService([testItem], { fetchFn: fakeFetch(pages, calls), hostDelayMs: 0, file: null });
  const report = await svc.refreshItem(testItem);

  // Una oferta por tienda: Coolmod (975,95) y la más barata de PcComponentes (1049, aunque agotada).
  assert.deepEqual(report.offers.map((o) => [o.store, o.price, o.inStock]), [
    ['Coolmod', 975.95, true],
    ['PcComponentes', 1049, false],
  ]);
  assert.deepEqual(svc.buyable('gpu-test').map((o) => o.store), ['Coolmod']);
  assert.match(report.failures['https://www.wipoid.com/msi-rtx-5070-ti.html'], /otro producto/);
  assert.match(report.failures['https://www.neobyte.es/rtx-5070-descatalogada-1.html'], /no existe/);
  // robots.txt de Neobyte prohíbe su buscador: no se llama.
  assert.ok(!calls.some((u) => u.includes('neobyte.es/index.php?controller=search')));
  assert.match(report.failures[`https://www.neobyte.es/index.php?controller=search&s=${encodeURIComponent('RTX 5070')}`], /robots/);
  // El enlace al 5070 Ti del listado no se siguió.
  assert.ok(!calls.includes('https://www.pccomponentes.com/msi-rtx-5070-ti-ventus'));
});

test('PriceService: si una tienda bloquea se conserva el último precio hasta que caduca', async () => {
  const item: CatalogItem = { ...testItem, seeds: ['https://www.coolmod.com/msi-rtx-5070-ventus/'], listings: [] };
  let now = new Date('2026-11-24T10:00:00Z');
  const pages: Record<string, Page> = { 'https://www.coolmod.com/msi-rtx-5070-ventus/': { status: 200, body: jsonLd('MSI RTX 5070 12GB', 999) } };
  const svc = new PriceService([item], { fetchFn: fakeFetch(pages), hostDelayMs: 0, file: null, now: () => now, maxAgeHours: 48 });
  await svc.refreshItem(item);
  assert.equal(svc.getPrices(item.id).offers[0].price, 999);

  pages['https://www.coolmod.com/msi-rtx-5070-ventus/'] = { status: 403, body: '<title>Just a moment...</title>' };
  now = new Date('2026-11-25T10:00:00Z');
  await svc.refreshItem(item);
  assert.equal(svc.getPrices(item.id).offers[0].price, 999, 'se mantiene tras un bloqueo');

  now = new Date('2026-11-27T10:00:01Z');
  assert.equal(svc.getPrices(item.id).offers.length, 0, 'caduca a las 48 h');
});

test('PriceService: una tienda que bloquea varias veces seguidas se deja de consultar un tiempo', async () => {
  const blockedUrls = ['a', 'b', 'c', 'd', 'e'].map((x) => `https://www.coolmod.com/rtx-5070-${x}/`);
  const item: CatalogItem = { ...testItem, seeds: [...blockedUrls, 'https://www.ldlc.com/es-es/ficha/PB00668553.html'], listings: [] };
  const pages: Record<string, Page> = Object.fromEntries(blockedUrls.map((u) => [u, { status: 403 }]));
  pages['https://www.ldlc.com/es-es/ficha/PB00668553.html'] = { status: 200, body: jsonLd('MSI GeForce RTX 5070 12G VENTUS 2X OC', 669.95) };
  const calls: string[] = [];
  let now = new Date('2026-11-24T10:00:00Z');
  const svc = new PriceService([item], { fetchFn: fakeFetch(pages, calls), hostDelayMs: 0, file: null, now: () => now, storeBlockHours: 24 });
  const report = await svc.refreshItem(item);

  const coolmodCalls = () => calls.filter((u) => u.includes('coolmod.com/rtx')).length;
  assert.equal(coolmodCalls(), 3, 'tras 3 bloqueos seguidos no se le piden más fichas');
  assert.match(report.failures[blockedUrls[4]], /pausa/);
  assert.deepEqual(report.offers.map((o) => [o.store, o.price]), [['LDLC', 669.95]]);

  await svc.refreshItem(item);
  assert.equal(coolmodCalls(), 3, 'sigue en pausa en la siguiente pasada');

  now = new Date('2026-11-25T10:00:01Z');
  await svc.refreshItem(item);
  assert.ok(coolmodCalls() > 3, 'pasado el tiempo se vuelve a intentar');
});

test('PriceService: una ficha descatalogada no da precio aunque muestre el último', async () => {
  const url = 'https://www.ldlc.com/es-es/ficha/PB00654317.html';
  const item: CatalogItem = { ...testItem, seeds: [url], listings: [] };
  const pages: Record<string, Page> = {
    [url]: { status: 200, body: jsonLd('MSI GeForce RTX 5070 12G', 499, 'InStock') + '<p>Este producto ya no está a la venta permanentemente</p>' },
  };
  const svc = new PriceService([item], { fetchFn: fakeFetch(pages), hostDelayMs: 0, file: null });
  const report = await svc.refreshItem(item);
  assert.equal(report.offers.length, 0);
  assert.match(report.failures[url], /ya no lo vende/);
});

test('PriceService: una tienda que no responde también se pausa y no atasca la lectura', async () => {
  const urls = ['a', 'b', 'c', 'd'].map((x) => `https://www.neobyte.es/rtx-5070-${x}.html`);
  const item: CatalogItem = { ...testItem, seeds: urls, listings: [] };
  let product = 0;
  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/robots.txt')) return new Response('', { status: 404 });
    if (url.includes('neobyte.es')) product++;
    throw new Error('The operation was aborted due to timeout');
  }) as typeof fetch;
  const svc = new PriceService([item], { fetchFn, hostDelayMs: 0, file: null });
  const report = await svc.refreshItem(item);
  assert.equal(product, 3, 'su buscador y 2 fichas; las otras 2 ya no se piden');
  assert.match(report.failures[urls[3]], /no responde/);
});

/* ------------------------------- Motor ------------------------------------ */

/** Precios simulados (precios orientativos de noviembre de 2026 vistos en las tiendas). */
const PRICES: Record<string, number> = {
  'cpu-7600x': 169.9,
  'cpu-9600x': 189.95,
  'cpu-7800x3d': 309.89,
  'cpu-9800x3d': 449.9,
  'cpu-9850x3d': 519,
  'cpu-9950x': 560,
  'gpu-rtx5060': 481.36,
  'gpu-rtx5070': 975.95,
  'gpu-rx9070xt': 889,
  'gpu-rtx5070ti': 1289.9,
  'mb-msi-pro-b850-s-wifi6e': 129.9,
  'mb-asrock-b850-steel-legend-wifi': 199.9,
  'ram-ddr5-16-6000': 317.99,
  'ram-ddr5-32-6000': 652.9,
  'ram-ddr5-32-6000-white': 697.6,
  'ssd-sn7100-500': 179.94,
  'ssd-sn7100-1tb': 224.59,
  'ssd-sn7100-2tb': 387.9,
  'psu-rm750e': 140.9,
  'psu-rm750e-white': 159.95,
  'case-lancool-216': 82.9,
  'case-lancool-216-white': 95,
  'cooler-pa120se': 60.95,
  'cooler-pa120se-white': 83.95,
  'mon-q27g4xf': 159.99,
  'kb-g213': 34.99,
  'mouse-g305': 34.99,
};

const offer = (id: string, price: number, extra: Partial<Offer> = {}): Offer => ({
  storeId: 'coolmod',
  store: 'Coolmod',
  url: `https://www.coolmod.com/${id}/`,
  price,
  currency: 'EUR',
  inStock: true,
  title: CATALOG_BY_ID.get(id)?.name,
  checkedAt: '2026-11-24T10:00:00.000Z',
  ...extra,
});

const LAPTOPS: Record<string, Offer[]> = {
  'laptop-rtx5060': [
    offer('l1', 1199, { title: 'Portátil Lenovo LOQ 15IRX10 15.6" i7-13645HX 16GB 512GB SSD RTX 5060' }),
    offer('l2', 1499, { title: 'Portátil ASUS TUF Gaming F16 i7-14650HX 32GB 1TB SSD RTX 5060' }),
  ],
  'laptop-office': [offer('l3', 649, { title: 'Portátil HP 15" Ryzen 7 16GB 512GB SSD' })],
};

const fakePrices: PriceSource = {
  buyable: (id) => (PRICES[id] ? [offer(id, PRICES[id])] : []),
  allBuyable: (id) => LAPTOPS[id] ?? [],
};

const ids = (r: RecommendResponse) => r.build.components.map((c) => c.catalogId);

test('motor: gaming 1500-2500 € elige la mejor gráfica que cabe y todo compatible', () => {
  const r = recommend({ deviceType: 'Torre', useCase: 'Gaming', budget: '1500€ - 2500€' }, CATALOG, fakePrices);
  assert.equal(r.build.overBudget, false);
  assert.ok(r.build.total <= 2500);
  assert.ok(ids(r).includes('gpu-rx9070xt') || ids(r).includes('gpu-rtx5070ti'), ids(r).join(','));
  for (const type of ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler']) {
    assert.ok(r.build.components.some((c) => c.type === type), `falta ${type}`);
  }
  assert.equal(r.prices.gpu.offers[0].price, PRICES[r.build.components.find((c) => c.type === 'gpu')!.catalogId]);
  assert.match(r.build.explanation, /Tom's Hardware/);
});

test('motor: si no cabe nada lo dice y da la opción más barata posible', () => {
  const r = recommend({ deviceType: 'Torre', useCase: 'Gaming', budget: '< 800€' }, CATALOG, fakePrices);
  assert.equal(r.build.overBudget, true);
  assert.match(r.build.warnings[0], /no hay ninguna configuración completa/);
  assert.ok(ids(r).includes('gpu-rtx5060') && ids(r).includes('cpu-7600x'));
});

test('motor: productividad sin gráfica dedicada y estética blanca respetada', () => {
  const r = recommend({ deviceType: 'Torre', useCase: 'Productividad', budget: '1500€ - 2500€', color: 'Blanco' }, CATALOG, fakePrices);
  assert.ok(!r.build.components.some((c) => c.type === 'gpu'));
  assert.ok(ids(r).includes('cpu-9950x'), 'el mejor multinúcleo que cabe');
  assert.ok(ids(r).includes('case-lancool-216-white') && ids(r).includes('psu-rm750e-white'));
});

test('motor: si falta la capacidad pedida usa la mayor disponible y lo avisa', () => {
  const sin32: PriceSource = {
    buyable: (id) => (id === 'ram-ddr5-32-6000' || id === 'ram-ddr5-32-6000-white' || id === 'ssd-sn7100-2tb' ? [] : fakePrices.buyable(id)),
    allBuyable: fakePrices.allBuyable,
  };
  const r = recommend({ deviceType: 'Torre', useCase: 'Creación', budget: '1500€ - 2500€' }, CATALOG, sin32);
  assert.ok(ids(r).includes('ram-ddr5-16-6000') && ids(r).includes('ssd-sn7100-1tb'), ids(r).join(','));
  assert.ok(r.build.warnings.some((w) => /memoria de 32 GB/.test(w)));
  assert.ok(r.build.warnings.some((w) => /SSD de 2 TB/.test(w)));
});

test('motor: portátiles ordenados por gráfica y RAM, el elegido dentro del presupuesto', () => {
  const r = recommend({ deviceType: 'Portátil', useCase: 'Gaming', budget: '800€ - 1500€' }, CATALOG, fakePrices);
  const laptops = r.build.components.filter((c) => c.type === 'laptop');
  assert.equal(laptops[0].name, 'Portátil ASUS TUF Gaming F16 i7-14650HX 32GB 1TB SSD RTX 5060');
  assert.equal(r.build.total, 1499);
  assert.equal(laptops.length, 3);
  const r2 = recommend({ deviceType: 'Portátil', useCase: 'Gaming', budget: '800€ - 1500€', ram: '32GB' }, CATALOG, fakePrices);
  assert.equal(r2.build.components.filter((c) => c.type === 'laptop').length, 1, 'solo uno con 32 GB');
});

test('API: /api/recommend y /api/status', async () => {
  const svc = new PriceService(CATALOG, { fetchFn: fakeFetch({}), hostDelayMs: 0, file: null });
  // Sin precios todavía: error claro.
  const app = createApp({ prices: svc, refreshPerHour: 0 });
  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${port}`;
    const status = await (await fetch(`${base}/api/status`)).json();
    assert.equal(status.ready, false);
    const res = await fetch(`${base}/api/recommend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceType: 'Torre', useCase: 'Gaming', budget: '800€ - 1500€' }) });
    assert.equal(res.status, 503);
    assert.match((await res.json()).error, /no hay precios comprobados/);
    const bad = await fetch(`${base}/api/prices/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalogId: 'nada' }) });
    assert.equal(bad.status, 400);
  } finally {
    server.close();
  }
});
