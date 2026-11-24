import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app';
import type { AiClient, AiRequest } from '../server/gemini';
import { lookupPrices, PriceCache } from '../server/prices';
import type { StreamEvent } from '../shared/types';

const R = (id: string) => `https://vertexaisearch.cloud.google.com/grounding-api-redirect/${id}`;

const REDIRECTS: Record<string, string> = {
  [R('pcc')]: 'https://www.pccomponentes.com/amd-ryzen-7-7800x3d-42-50ghz?srsltid=abc',
  [R('cool')]: 'https://www.coolmod.com/amd-ryzen-7-7800x3d-procesador/',
  [R('ldlc')]: 'https://www.ldlc.com/es-es/ficha/PB00012345.html',
  [R('neo')]: 'https://www.neobyte.es/amd-ryzen-7-7800x3d-42ghz-box-12345.html',
  [R('news')]: 'https://www.xataka.com/componentes/analisis-7800x3d',
};

const jsonLd = (name: string, price: number, availability = 'InStock') =>
  `<html><script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    offers: { '@type': 'Offer', price: price.toFixed(2), priceCurrency: 'EUR', availability: `https://schema.org/${availability}` },
  })}</script></html>`;

const PAGES: Record<string, { status: number; body?: string; location?: string }> = {
  'https://www.pccomponentes.com/amd-ryzen-7-7800x3d-42-50ghz': { status: 403, body: '<title>Just a moment...</title>' },
  'https://www.coolmod.com/amd-ryzen-7-7800x3d-procesador/': { status: 200, body: jsonLd('AMD Ryzen 7 7800X3D 4.2GHz Socket AM5', 359.9) },
  'https://www.amazon.es/dp/B0BTZB7F88': { status: 503 },
  'https://www.wipoid.com/amd-ryzen-7-7800x3d-made-up.html': { status: 404 },
  'https://www.ldlc.com/es-es/ficha/PB00012345.html': { status: 200, body: jsonLd('AMD Ryzen 7 9800X3D', 479) },
  'https://www.neobyte.es/amd-ryzen-7-7800x3d-42ghz-box-12345.html': { status: 200, body: jsonLd('AMD Ryzen 7 7800X3D Box', 362.5) },
};

const fakeFetch: typeof fetch = async (input) => {
  const url = String(input);
  if (REDIRECTS[url]) return new Response(null, { status: 302, headers: { location: REDIRECTS[url] } });
  const page = PAGES[url];
  if (!page) return new Response('not found', { status: 404 });
  return new Response(page.body ?? '', { status: page.status, headers: page.location ? { location: page.location } : {} });
};

const priceText = JSON.stringify({
  offers: [
    { store: 'PcComponentes', url: 'https://www.pccomponentes.com/amd-ryzen-7-7800x3d-42-50ghz', price: 369, inStock: true },
    { store: 'Coolmod', url: 'https://www.coolmod.com/amd-ryzen-7-7800x3d-procesador/', price: 365, inStock: true },
    { store: 'Amazon', url: 'https://www.amazon.es/AMD-Ryzen-7800X3D/dp/B0BTZB7F88?tag=x', price: 349, inStock: true },
    { store: 'Wipoid', url: 'https://www.wipoid.com/amd-ryzen-7-7800x3d-made-up.html', price: 199, inStock: true },
    { store: 'LDLC', url: 'https://www.ldlc.com/es-es/ficha/PB00012345.html', price: 379 },
    { store: 'PcComponentes', url: 'https://www.pccomponentes.com/buscar/?query=7800x3d', price: 300 },
  ],
});

function fakeAi(handler: (req: AiRequest) => string): AiClient & { calls: number } {
  const client = {
    models: ['fake-model'],
    calls: 0,
    async generate(req: AiRequest) {
      client.calls++;
      return {
        text: handler(req),
        model: 'fake-model',
        grounding: {
          webSearchQueries: ['precio AMD Ryzen 7 7800X3D'],
          searchEntryPoint: { renderedContent: '<div class="chip">precio 7800X3D</div>' },
          groundingChunks: Object.keys(REDIRECTS).map((uri) => ({ web: { uri, title: new URL(REDIRECTS[uri]).hostname } })),
        },
      };
    },
  };
  return client;
}

const query = { type: 'cpu' as const, name: 'AMD Ryzen 7 7800X3D', searchQuery: 'AMD Ryzen 7 7800X3D', estimatedPrice: 370 };

test('solo devuelve precios verificados o respaldados por Google', async () => {
  const ai = fakeAi(() => '```json\n' + priceText + '\n```');
  const res = await lookupPrices(query, { ai, fetchFn: fakeFetch });

  assert.deepEqual(
    res.offers.map((o) => [o.store, o.price, o.status]),
    [
      ['Coolmod', 359.9, 'verified'], // precio leído de la ficha (no el que dijo la IA)
      ['Neobyte', 362.5, 'verified'], // ficha encontrada en las fuentes de Google
      ['PcComponentes', 369, 'google'], // Cloudflare bloquea, pero la URL viene de Google
    ],
  );
  // Amazon (no aparece en las fuentes y no se pudo leer), Wipoid (404) y LDLC (otro modelo) se descartan.
  assert.equal(res.offers[2].url, 'https://www.pccomponentes.com/amd-ryzen-7-7800x3d-42-50ghz');
  assert.equal(res.searchSuggestionsHtml, '<div class="chip">precio 7800X3D</div>');
  assert.deepEqual(res.queries, ['precio AMD Ryzen 7 7800X3D']);
});

test('usa la caché y permite forzar la actualización', async () => {
  const ai = fakeAi(() => priceText);
  const cache = new PriceCache(60_000);
  await lookupPrices(query, { ai, fetchFn: fakeFetch, cache });
  const second = await lookupPrices(query, { ai, fetchFn: fakeFetch, cache });
  assert.equal(ai.calls, 1);
  assert.equal(second.fromCache, true);
  await lookupPrices(query, { ai, fetchFn: fakeFetch, cache }, { force: true });
  assert.equal(ai.calls, 2);
});

test('respuesta de la IA sin JSON → sin ofertas inventadas', async () => {
  const ai = fakeAi(() => 'No he encontrado nada.');
  const noPages: typeof fetch = async (input) =>
    REDIRECTS[String(input)] ? new Response(null, { status: 302, headers: { location: REDIRECTS[String(input)] } }) : new Response('', { status: 403 });
  const res = await lookupPrices(query, { ai, fetchFn: noPages });
  // Hay fichas en las fuentes, pero sin precio legible ni precio de Google: no se muestra nada.
  assert.deepEqual(res.offers, []);
});

test('/api/recommend emite la configuración y luego los precios en streaming', async () => {
  const build = {
    explanation: 'Montaje equilibrado para jugar en 1440p.',
    components: [
      { type: 'cpu', name: 'AMD Ryzen 7 7800X3D', searchQuery: 'AMD Ryzen 7 7800X3D', estimatedPrice: 370, reason: 'r', summary: 's', socket: 'AM5', tdpW: 120 },
      { type: 'monitor', name: 'Monitor que no se pidió', searchQuery: 'x', estimatedPrice: 200, reason: 'r', summary: 's' },
      { type: 'psu', name: 'Corsair RM850e', searchQuery: 'Corsair RM850e', estimatedPrice: 110, reason: 'r', summary: 's', psuWatts: 850 },
    ],
  };
  const ai = fakeAi((req) => (req.jsonSchema ? JSON.stringify(build) : priceText));
  const app = createApp({ ai, fetchFn: fakeFetch, recommendPerHour: 0 });
  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/api/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceType: 'Torre', useCase: 'Gaming', budget: '800€ - 1500€', includePeripherals: false }),
    });
    assert.equal(res.headers.get('content-type'), 'application/x-ndjson; charset=utf-8');
    const events = (await res.text()).trim().split('\n').map((l) => JSON.parse(l) as StreamEvent);
    const types = events.map((e) => e.type);
    assert.deepEqual(types.slice(0, 3), ['status', 'build', 'status']);
    assert.equal(types.at(-1), 'done');
    const buildEv = events.find((e) => e.type === 'build') as Extract<StreamEvent, { type: 'build' }>;
    assert.deepEqual(buildEv.build.components.map((c) => c.id), ['cpu-1', 'psu-1']); // el monitor se filtra
    assert.equal(buildEv.build.components[0].specs.socket, 'AM5');
    assert.equal(buildEv.build.sources.length, 5);
    assert.equal(buildEv.build.sources[0].url, REDIRECTS[R('pcc')]);
    const priceEvents = events.filter((e) => e.type === 'prices');
    assert.equal(priceEvents.length, 2);
  } finally {
    server.close();
  }
});

test('/api/prices valida la entrada y sin API key avisa', async () => {
  const app = createApp({ ai: null });
  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/api/prices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 500);
    assert.match((await res.json()).error, /GEMINI_API_KEY/);
  } finally {
    server.close();
  }
});
