import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractProduct, isBotChallenge, parsePrice } from '../server/extract';
import { isSameProduct, matchScore } from '../server/match';
import { identifyStore, looksLikeProductPage, normalizeProductUrl } from '../server/stores';

test('parsePrice entiende formatos españoles e ingleses', () => {
  assert.equal(parsePrice('1.299,90 €'), 1299.9);
  assert.equal(parsePrice('1299,90'), 1299.9);
  assert.equal(parsePrice('1,299.90'), 1299.9);
  assert.equal(parsePrice('1.299'), 1299);
  assert.equal(parsePrice('349.99'), 349.99);
  assert.equal(parsePrice(449), 449);
  assert.equal(parsePrice('1299.000', true), 1299);
  assert.equal(parsePrice('gratis'), undefined);
  assert.equal(parsePrice(0), undefined);
});

test('extrae precio y stock del JSON-LD (Offer, AggregateOffer y @graph)', () => {
  const html = `<html><head>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList"}</script>
    <script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[{"@type":"Product","name":"AMD Ryzen 7 7800X3D 4.2 GHz",
      "offers":{"@type":"Offer","price":"359.90","priceCurrency":"EUR","availability":"https://schema.org/InStock"}}]}
    </script></head></html>`;
  const p = extractProduct(html);
  assert.equal(p.source, 'jsonld');
  assert.equal(p.price, 359.9);
  assert.equal(p.inStock, true);
  assert.equal(p.title, 'AMD Ryzen 7 7800X3D 4.2 GHz');

  const agg = extractProduct(`<script type="application/ld+json">[{"@type":["Product"],"name":"X",
    "offers":{"@type":"AggregateOffer","lowPrice":289,"highPrice":320,"priceCurrency":"EUR","availability":"OutOfStock"}}]</script>`);
  assert.equal(agg.price, 289);
  assert.equal(agg.inStock, false);
});

test('ignora precios en otra moneda y cae a meta tags', () => {
  const html = `<script type="application/ld+json">{"@type":"Product","name":"Y","offers":{"price":"99","priceCurrency":"USD"}}</script>
    <meta property="og:title" content="Corsair RM850e 850W">
    <meta content="119,90" property="product:price:amount"><meta property="product:price:currency" content="EUR">
    <meta property="product:availability" content="in stock">`;
  const p = extractProduct(html);
  assert.equal(p.source, 'meta');
  assert.equal(p.price, 119.9);
  assert.equal(p.inStock, true);
  assert.equal(p.title, 'Corsair RM850e 850W');
});

test('microdata y Amazon', () => {
  assert.equal(extractProduct('<span itemprop="price" content="74.95">74,95 €</span>').price, 74.95);
  const amz = extractProduct('<span id="productTitle"> Samsung 990 PRO 2TB </span><input type="hidden" id="twister-plus-price-data-price" value="164.99"><input id="add-to-cart-button">');
  assert.equal(amz.source, 'amazon');
  assert.equal(amz.price, 164.99);
  assert.equal(amz.title, 'Samsung 990 PRO 2TB');
  assert.equal(amz.inStock, true);
});

test('detecta retos anti-bot', () => {
  assert.equal(isBotChallenge('<title>Just a moment...</title><div id="cf-chl-widget">'), true);
  assert.equal(isBotChallenge('<html><body>Producto normal</body></html>'), false);
});

test('identifica tiendas y descarta listados', () => {
  assert.equal(identifyStore('https://www.pccomponentes.com/amd-ryzen-7-7800x3d')?.id, 'pccomponentes');
  assert.equal(identifyStore('https://www.ldlc.com/es-es/ficha/PB00123.html')?.id, 'ldlc');
  assert.equal(identifyStore('https://www.ldlc.com/fiche/PB00123.html'), null); // LDLC Francia
  assert.equal(identifyStore('https://evil.com/?u=pccomponentes.com'), null);
  assert.equal(identifyStore('https://pccomponentes.com.evil.com/x'), null);

  assert.equal(looksLikeProductPage('https://www.pccomponentes.com/amd-ryzen-7-7800x3d-42-50ghz'), true);
  assert.equal(looksLikeProductPage('https://www.pccomponentes.com/buscar/?query=7800x3d'), false);
  assert.equal(looksLikeProductPage('https://www.amazon.es/s?k=7800x3d'), false);
  assert.equal(looksLikeProductPage('https://www.amazon.es/AMD-Ryzen-7800X3D/dp/B0BTZB7F88'), true);
  assert.equal(looksLikeProductPage('https://www.coolmod.com/'), false);
  assert.equal(looksLikeProductPage('https://www.mediamarkt.es/es/category/portatiles-gaming-123.html'), false);
});

test('normaliza URLs: sin tracking y Amazon como /dp/ASIN', () => {
  assert.equal(
    normalizeProductUrl('https://www.amazon.es/AMD-Ryzen-7800X3D-Procesador/dp/B0BTZB7F88/ref=sr_1_1?crid=1&srsltid=abc'),
    'https://www.amazon.es/dp/B0BTZB7F88',
  );
  assert.equal(
    normalizeProductUrl('http://www.pccomponentes.com/amd-ryzen-7-7800x3d?utm_source=google&srsltid=xyz#reviews'),
    'https://www.pccomponentes.com/amd-ryzen-7-7800x3d',
  );
  assert.equal(normalizeProductUrl('javascript:alert(1)'), null);
});

test('compara modelos (mismo producto vs variante distinta)', () => {
  assert.equal(isSameProduct('AMD Ryzen 7 7800X3D', 'AMD Ryzen 7 7800X3D 4.2/5GHz Box'), true);
  assert.equal(isSameProduct('AMD Ryzen 7 7800X3D', 'AMD Ryzen 7 9800X3D 4.7GHz'), false);
  assert.equal(isSameProduct('Kingston FURY Beast 32GB (2x16GB) DDR5 6000MHz CL30', 'Kingston FURY Beast DDR5 6000 MT/s 32GB 2x16GB CL30'), true);
  assert.equal(isSameProduct('Samsung 990 PRO 2TB', 'Samsung 990 PRO 1TB NVMe'), false);
  assert.equal(isSameProduct('ASUS TUF Gaming A15 FA507NV', 'ASUS TUF Gaming A15 FA507NVR-LP091W Ryzen 7'), true);
  assert.ok(matchScore('Logitech G Pro X Superlight', 'Logitech G PRO X SUPERLIGHT Wireless') >= 0.6);
});
