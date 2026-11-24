/**
 * Extrae precio, disponibilidad y nombre de la ficha de un producto a partir de su HTML.
 * Orden: JSON-LD (schema.org Product/Offer) → meta tags → microdata → patrones de Amazon.
 */

export interface ExtractedProduct {
  title?: string;
  price?: number;
  currency?: string;
  inStock: boolean | null;
  source: 'jsonld' | 'meta' | 'microdata' | 'amazon' | 'none';
}

/**
 * Convierte "1.299,90 €", "1299.90", "1,299.90" o 1299.9 en número.
 * Con `schema` (JSON-LD, meta, microdata) el punto es siempre decimal, como manda schema.org.
 */
export function parsePrice(value: unknown, schema = false): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : undefined;
  if (typeof value !== 'string') return undefined;
  let s = value.replace(/[^\d.,]/g, '');
  if (!s) return undefined;
  if (schema && /^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return n > 0 ? Math.round(n * 100) / 100 : undefined;
  }
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    // El último separador es el decimal.
    const dec = lastDot > lastComma ? '.' : ',';
    const thou = dec === '.' ? ',' : '.';
    s = s.split(thou).join('').replace(dec, '.');
  } else if (lastComma !== -1) {
    // "1299,90" → decimal | "1,299" → miles
    s = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastDot !== -1) {
    // "1.299" (formato español) → miles | "1299.9" → decimal
    const parts = s.split('.');
    s = parts.length > 2 || /\.\d{3}$/.test(s) ? parts.join('') : s;
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
}

function availabilityToStock(value: unknown): boolean | null {
  if (typeof value !== 'string') return null;
  const v = value.toLowerCase();
  if (/(outofstock|out of stock|soldout|sold out|discontinued|agotado|sin stock)/.test(v)) return false;
  if (/(instock|in stock|limitedavailability|onlineonly|en stock|disponible)/.test(v)) return true;
  return null;
}

const decodeEntities = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

export function parseJsonLoose(raw: string): unknown {
  const text = raw.trim().replace(/^<!--|-->$/g, '');
  try {
    return JSON.parse(text);
  } catch {
    try {
      // Saltos de línea sin escapar y comas finales: errores típicos en JSON-LD de tiendas.
      return JSON.parse(text.replace(/[\u0000-\u001f]+/g, ' ').replace(/,\s*([}\]])/g, '$1'));
    } catch {
      return undefined;
    }
  }
}

const hasType = (node: any, type: string) => {
  const t = node?.['@type'];
  return Array.isArray(t) ? t.some((x) => String(x).toLowerCase() === type) : String(t ?? '').toLowerCase() === type;
};

export function collectProducts(node: any, out: any[], depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectProducts(n, out, depth + 1));
    return;
  }
  if (hasType(node, 'product') || hasType(node, 'productgroup')) out.push(node);
  for (const key of ['@graph', 'mainEntity', 'itemListElement', 'item', 'hasVariant']) {
    if (node[key]) collectProducts(node[key], out, depth + 1);
  }
}

interface PriceCandidate {
  price: number;
  currency?: string;
  inStock: boolean | null;
}

function offersOf(product: any): PriceCandidate[] {
  const list: any[] = [];
  const push = (o: any) => (Array.isArray(o) ? o.forEach(push) : o && typeof o === 'object' && list.push(o));
  push(product.offers);

  const out: PriceCandidate[] = [];
  for (const o of list) {
    if (o.offers) push(o.offers); // AggregateOffer con offers dentro
    const specs = Array.isArray(o.priceSpecification) ? o.priceSpecification : o.priceSpecification ? [o.priceSpecification] : [];
    const price = parsePrice(o.price, true) ?? parsePrice(o.lowPrice, true) ?? specs.map((p: any) => parsePrice(p?.price, true)).find(Boolean);
    if (!price) continue;
    out.push({
      price,
      currency: o.priceCurrency ?? specs.find((p: any) => p?.priceCurrency)?.priceCurrency,
      inStock: availabilityToStock(o.availability),
    });
  }
  return out;
}

/** Todos los productos con precio del JSON-LD (las variantes de un ProductGroup van por separado). */
function fromJsonLd(html: string): ExtractedProduct[] {
  const re = /<script[^>]+type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  const products: any[] = [];
  for (const m of html.matchAll(re)) {
    const data = parseJsonLoose(m[1]);
    if (data) collectProducts(data, products);
  }
  const out: ExtractedProduct[] = [];
  for (const p of products) {
    const offers = offersOf(p).filter((o) => !o.currency || o.currency.toUpperCase() === 'EUR');
    if (!offers.length) continue;
    const available = offers.filter((o) => o.inStock !== false);
    const pool = available.length ? available : offers;
    const best = pool.reduce((a, b) => (b.price < a.price ? b : a));
    const anyStock = offers.some((o) => o.inStock === true) ? true : offers.every((o) => o.inStock === false) ? false : null;
    out.push({
      title: typeof p.name === 'string' ? decodeEntities(p.name).trim() : pageTitle(html),
      price: best.price,
      currency: 'EUR',
      inStock: anyStock,
      source: 'jsonld',
    });
  }
  return out;
}

function metaContent(html: string, key: string): string | undefined {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const a = new RegExp(`<meta[^>]+(?:property|name|itemprop)\\s*=\\s*["']${k}["'][^>]*content\\s*=\\s*["']([^"']*)["']`, 'i');
  const b = new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name|itemprop)\\s*=\\s*["']${k}["']`, 'i');
  const v = html.match(a)?.[1] ?? html.match(b)?.[1];
  return v ? decodeEntities(v) : undefined;
}

function pageTitle(html: string): string | undefined {
  const og = metaContent(html, 'og:title');
  if (og) return og.trim();
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return t ? decodeEntities(t).replace(/\s+/g, ' ').trim() : undefined;
}

function fromMeta(html: string): ExtractedProduct | null {
  const raw = metaContent(html, 'product:price:amount') ?? metaContent(html, 'og:price:amount');
  const price = parsePrice(raw, true);
  if (!price) return null;
  const currency = metaContent(html, 'product:price:currency') ?? metaContent(html, 'og:price:currency');
  if (currency && currency.toUpperCase() !== 'EUR') return null;
  return {
    title: pageTitle(html),
    price,
    currency: 'EUR',
    inStock: availabilityToStock(metaContent(html, 'product:availability') ?? metaContent(html, 'og:availability')),
    source: 'meta',
  };
}

function fromMicrodata(html: string): ExtractedProduct | null {
  const m =
    html.match(/itemprop\s*=\s*["']price["'][^>]*content\s*=\s*["']([^"']+)["']/i) ??
    html.match(/content\s*=\s*["']([^"']+)["'][^>]*itemprop\s*=\s*["']price["']/i);
  const price = parsePrice(m?.[1], true);
  if (!price) return null;
  const avail = html.match(/itemprop\s*=\s*["']availability["'][^>]*(?:href|content)\s*=\s*["']([^"']+)["']/i)?.[1];
  return { title: pageTitle(html), price, currency: 'EUR', inStock: availabilityToStock(avail), source: 'microdata' };
}

function fromAmazon(html: string): ExtractedProduct | null {
  const m =
    html.match(/id=["']twister-plus-price-data-price["'][^>]*value=["']([\d.,]+)["']/i) ??
    html.match(/id=["']attach-base-product-price["'][^>]*value=["']([\d.,]+)["']/i) ??
    html.match(/"priceAmount"\s*:\s*([\d.]+)/);
  const price = parsePrice(m?.[1], true);
  if (!price) return null;
  const title = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i)?.[1];
  const inStock = /id=["']add-to-cart-button["']/i.test(html) ? true : /id=["']outOfStock["']/i.test(html) ? false : null;
  return { title: title ? decodeEntities(title).replace(/\s+/g, ' ').trim() : pageTitle(html), price, currency: 'EUR', inStock, source: 'amazon' };
}

/** Todos los productos con precio que hay en la página. */
export function extractProducts(html: string): ExtractedProduct[] {
  const fromLd = fromJsonLd(html);
  if (fromLd.length) return fromLd;
  const single = fromMeta(html) ?? fromMicrodata(html) ?? fromAmazon(html);
  return single ? [single] : [];
}

export function extractProduct(html: string): ExtractedProduct {
  return extractProducts(html)[0] ?? { title: pageTitle(html), inStock: null, source: 'none' };
}

export { pageTitle };

/**
 * Ficha de un producto descatalogado: algunas tiendas (LDLC) siguen mostrando el "último precio",
 * que no sirve porque ya no se puede comprar.
 */
export function isDiscontinuedPage(html: string): boolean {
  return /ya no est(?:a|á|&aacute;) a la venta|no longer (?:on|for) sale|n['’]est plus (?:en vente|commercialis)/i.test(html);
}

/** Páginas de reto anti-bot (Cloudflare, captcha de Amazon…). */
export function isBotChallenge(html: string): boolean {
  return /(cf-chl|challenge-platform|just a moment\.\.\.|attention required! \| cloudflare|captcha|robot check|validatecaptcha|px-captcha|datadome)/i.test(
    html.slice(0, 20000),
  );
}
