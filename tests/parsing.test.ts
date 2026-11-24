import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_BY_ID } from '../server/catalog';
import { extractProduct, extractProducts, isBotChallenge, parsePrice } from '../server/extract';
import { laptopRamGB, matchesItem } from '../server/matching';
import { isAllowed, parseRobots } from '../server/robots';
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

const item = (id: string) => CATALOG_BY_ID.get(id)!;

test('empareja cada producto del catálogo solo con su modelo exacto', () => {
  // CPUs: X3D distintos y packs con placa
  assert.equal(matchesItem(item('cpu-7800x3d'), 'AMD Ryzen 7 7800X3D 4.2 GHz/5 GHz'), true);
  assert.equal(matchesItem(item('cpu-7800x3d'), 'AMD Ryzen 7 9800X3D 4.7/5.2GHz'), false);
  assert.equal(matchesItem(item('cpu-7800x3d'), 'Pack AMD Ryzen 7 7800X3D 5.0GHz Tray + MSI PRO B850-S WIFI6E'), false);
  assert.equal(matchesItem(item('cpu-7700x'), 'Procesador AMD Ryzen 7 7700X3D 8 núcleos'), false);
  assert.equal(matchesItem(item('cpu-9950x'), 'AMD Ryzen 9 9950X3D'), false);
  // GPUs: Ti / XT / GRE y portátiles
  assert.equal(matchesItem(item('gpu-rtx5070'), 'MSI GeForce RTX 5070 VENTUS 2X OC 12GB GDDR7 DLSS4'), true);
  assert.equal(matchesItem(item('gpu-rtx5070'), 'MSI GeForce RTX 5070 Ti VENTUS 3X OC 16GB GDDR7'), false);
  assert.equal(matchesItem(item('gpu-rtx5070'), 'Portátil ASUS TUF 16" RTX 5070 32GB 1TB SSD'), false);
  assert.equal(matchesItem(item('gpu-rx9070'), 'Sapphire PULSE AMD Radeon RX 9070 XT 16GB'), false);
  assert.equal(matchesItem(item('gpu-rx9070xt'), 'Sapphire PULSE AMD Radeon RX 9070 XT 16GB GDDR6'), true);
  assert.equal(matchesItem(item('gpu-rtx5060ti16'), 'Gigabyte GeForce RTX 5060 Ti EAGLE OC 8GB GDDR7'), false);
  // RAM: capacidad, latencia y color
  assert.equal(matchesItem(item('ram-ddr5-32-6000'), 'Kingston Fury Beast 32GB (2x16GB) DDR5 6000MHz CL30'), true);
  assert.equal(matchesItem(item('ram-ddr5-32-6000'), 'Kingston FURY Beast 32GB 2x16GB DDR5 6000MHz CL30 AMD EXPO Blanco'), false);
  assert.equal(matchesItem(item('ram-ddr5-32-6000-white'), 'Kingston FURY Beast 32GB 2x16GB DDR5 6000MHz CL30 AMD EXPO Blanco'), true);
  assert.equal(matchesItem(item('ram-ddr5-16-6000'), 'Kingston Fury Beast 16GB (2x8GB) DDR5 6000MHz CL36'), false);
  // Monitores parecidos y reacondicionados
  assert.equal(matchesItem(item('mon-q27g4x'), 'AOC Q27G4XF 27" LED Fast IPS QHD 180Hz'), false);
  assert.equal(matchesItem(item('mon-q27g4x'), 'Reacondicionado Monitor AOC Gaming Q27G4X 27" QHD IPS 180Hz'), false);
  assert.equal(matchesItem(item('mon-q27g4x'), 'Monitor AOC Gaming Q27G4X 27" QHD IPS 180Hz 0.5ms HDR G-Sync'), true);
  // Portátiles: tienen que serlo
  assert.equal(matchesItem(item('laptop-rtx5060'), 'Portátil Lenovo LOQ 15IRX10 15.6" Intel Core i7-13645HX 16GB 512GB SSD RTX 5060 FreeDOS'), true);
  assert.equal(matchesItem(item('laptop-rtx5060'), 'ASUS TUF Gaming A16 TUF608UM-RV041 AMD Ryzen 7 260 16GB 1TB SSD RTX 5060 16" WUXGA 165Hz'), true);
  assert.equal(matchesItem(item('laptop-rtx5060'), 'PC Sobremesa Ryzen 5 9600X 32GB 1TB SSD RTX 5060'), false);
  assert.equal(laptopRamGB('Portátil Lenovo LOQ 15IRX10 15.6" Intel Core i7-13645HX 16GB 512GB SSD RTX 5060 8GB'), 16);
  assert.equal(laptopRamGB('ASUS TUF Gaming F16 i7-14650HX/32GB/1TB SSD/RTX 5060'), 32);
});

test('JSON-LD con variantes (ProductGroup): cada capacidad con su precio', () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    '@type': 'ProductGroup',
    name: 'WD BLACK SN7100',
    hasVariant: [
      { '@type': 'Product', name: 'WD BLACK SN7100 1TB', offers: { price: '224.59', priceCurrency: 'EUR', availability: 'InStock' } },
      { '@type': 'Product', name: 'WD BLACK SN7100 2TB', offers: { price: '433.91', priceCurrency: 'EUR', availability: 'InStock' } },
    ],
  })}</script>`;
  const products = extractProducts(html);
  assert.deepEqual(products.map((p) => [p.title, p.price]), [['WD BLACK SN7100 1TB', 224.59], ['WD BLACK SN7100 2TB', 433.91]]);
  assert.equal(products.find((p) => matchesItem(item('ssd-sn7100-2tb'), p.title))?.price, 433.91);
});

test('robots.txt: grupos, comodines y prioridad de la regla más larga', () => {
  const rules = parseRobots(`
User-agent: Googlebot
Disallow: /

User-agent: *
Disallow: /*controller=search
Disallow: /buscar
Allow: /buscar/ayuda
Disallow: /*.pdf$
`);
  assert.equal(isAllowed(rules, '/amd-ryzen-7-7800x3d'), true);
  assert.equal(isAllowed(rules, '/index.php?controller=search&s=rtx'), false);
  assert.equal(isAllowed(rules, '/buscar/?query=x'), false);
  assert.equal(isAllowed(rules, '/buscar/ayuda'), true);
  assert.equal(isAllowed(rules, '/manual.pdf'), false);
  assert.equal(isAllowed(rules, '/manual.pdf?x=1'), true);
  assert.equal(isAllowed(parseRobots('User-agent: *\nDisallow:'), '/lo-que-sea'), true);
});
