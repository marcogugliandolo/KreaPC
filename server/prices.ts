import { COMPONENT_LABELS, type BuildComponent, type Offer, type PriceResult } from '../shared/types';
import { extractProduct, isBotChallenge, parsePrice } from './extract';
import { parseJsonFromText, type AiClient } from './gemini';
import { fetchStorePage, mapLimit, resolveGroundingUrl, type FetchFn } from './http';
import { isSameProduct } from './match';
import { identifyStore, looksLikeProductPage, normalizeProductUrl, slugText, storeByName } from './stores';

export type PriceQuery = Pick<BuildComponent, 'type' | 'name' | 'searchQuery' | 'estimatedPrice'>;

export interface PriceDeps {
  ai: AiClient;
  fetchFn?: FetchFn;
  now?: () => Date;
  cache?: PriceCache;
}

const MIN_PRICE = 1;
const MAX_PRICE = 20000;
const MAX_CANDIDATES = 10;

/* ------------------------------------------------------------------ */
/* Caché en memoria (ahorra llamadas a Gemini y búsquedas de Google)    */
/* ------------------------------------------------------------------ */

export class PriceCache {
  private map = new Map<string, { expires: number; value: PriceResult }>();
  constructor(private ttlMs: number, private maxEntries = 500) {}

  static key(q: PriceQuery) {
    return `${q.type}|${q.name.toLowerCase().replace(/\s+/g, ' ').trim()}`;
  }
  get(q: PriceQuery): PriceResult | undefined {
    const hit = this.map.get(PriceCache.key(q));
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(PriceCache.key(q));
      return undefined;
    }
    return hit.value;
  }
  set(q: PriceQuery, value: PriceResult) {
    if (this.map.size >= this.maxEntries) this.map.delete(this.map.keys().next().value!);
    this.map.set(PriceCache.key(q), { expires: Date.now() + this.ttlMs, value });
  }
}

/* ------------------------------------------------------------------ */
/* Prompt                                                               */
/* ------------------------------------------------------------------ */

export function pricePrompt(q: PriceQuery, today: Date): string {
  const date = today.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });
  const officialStores = q.type === 'laptop' ? ', and the official Spanish stores of the brand (Lenovo, HP, Dell, Apple…)' : '';
  return [
    `Today is ${date}. Find the CURRENT price in Spain of this exact product: "${q.name}" (${COMPONENT_LABELS[q.type]}).`,
    `Search hint: "${q.searchQuery}".`,
    '',
    `Use Google Search to find PRODUCT PAGES (not search results or category listings) in Spanish online stores such as PcComponentes, Coolmod, Amazon.es, Wipoid, LDLC (es-es), Neobyte, Alternate.es, MediaMarkt, El Corte Inglés, Aussar, Xtremmedia, Izarmicro, App Informática, PCBox, Fnac or Worten${officialStores}.`,
    '',
    'Rules:',
    '- Only offers for this exact model. A different capacity, speed or variant is NOT valid.',
    '- "url" must be the product page URL exactly as it appears in the search results. Never build or guess URLs.',
    '- "price" is the current selling price in EUR (VAT included) shown in the search results. If you cannot see a price for a store, skip that store.',
    '- At most 6 offers, cheapest first.',
    '',
    'Reply with ONLY this JSON (no markdown, no comments):',
    '{"offers":[{"store":"PcComponentes","url":"https://...","price":123.45,"inStock":true}]}',
    'If you find nothing, reply {"offers":[]}.',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* Pipeline                                                             */
/* ------------------------------------------------------------------ */

interface Candidate {
  url: string;
  /** URL original (con el slug descriptivo) para comprobar que es el producto. */
  rawUrl: string;
  storeId: string;
  store: string;
  /** Precio que dice la IA a partir de los resultados de Google. */
  claimedPrice?: number;
  claimedStock: boolean | null;
  /** La URL aparece entre las fuentes reales de Google Search. */
  grounded: boolean;
}

const validPrice = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= MIN_PRICE && n <= MAX_PRICE;

const toNumber = (v: unknown) => parsePrice(v);

export async function lookupPrices(q: PriceQuery, deps: PriceDeps, opts: { signal?: AbortSignal; force?: boolean } = {}): Promise<PriceResult> {
  if (!opts.force) {
    const cached = deps.cache?.get(q);
    if (cached) return { ...cached, fromCache: true };
  }
  const now = deps.now?.() ?? new Date();
  const checkedAt = now.toISOString();

  // 1. La IA busca en Google las fichas del producto en tiendas españolas.
  const res = await deps.ai.generate({ prompt: pricePrompt(q, now), googleSearch: true, thinkingLevel: 'LOW', signal: opts.signal });
  const claimed = parseJsonFromText<{ offers?: any[] }>(res.text)?.offers ?? [];

  // 2. URLs reales de las fuentes que usó Google Search.
  const chunkUris = (res.grounding?.groundingChunks ?? []).map((c) => c.web?.uri).filter((u): u is string => Boolean(u));
  const resolved = await mapLimit(chunkUris.slice(0, 15), 6, (uri) => resolveGroundingUrl(uri, { fetchFn: deps.fetchFn, signal: opts.signal }));
  const grounded = new Map<string, string>(); // normalizada → original
  for (const raw of resolved) {
    const url = normalizeProductUrl(raw ?? undefined);
    if (url && raw && !grounded.has(url)) grounded.set(url, raw);
  }

  // 3. Candidatos: lo que dice la IA + fichas de tiendas que aparecen en las fuentes.
  const candidates = new Map<string, Candidate>();
  for (const o of claimed) {
    const url = normalizeProductUrl(o?.url);
    if (!url || !looksLikeProductPage(url)) continue;
    const store = identifyStore(url);
    if (!store) continue;
    const price = toNumber(o?.price);
    candidates.set(url, {
      url,
      rawUrl: String(o.url),
      storeId: store.id,
      store: store.name,
      claimedPrice: validPrice(price) ? price : undefined,
      claimedStock: typeof o?.inStock === 'boolean' ? o.inStock : null,
      grounded: grounded.has(url),
    });
  }
  for (const [url, rawUrl] of grounded) {
    const existing = candidates.get(url);
    if (existing) {
      existing.rawUrl = existing.rawUrl.length >= rawUrl.length ? existing.rawUrl : rawUrl;
      continue;
    }
    if (!looksLikeProductPage(url)) continue;
    const store = identifyStore(url);
    if (!store) continue;
    // Si la IA citó la misma tienda con otra URL, nos fiamos de la fuente real.
    const claimedSameStore = claimed.find((o) => storeByName(o?.store)?.id === store.id);
    const price = toNumber(claimedSameStore?.price);
    candidates.set(url, {
      url,
      rawUrl,
      storeId: store.id,
      store: store.name,
      claimedPrice: validPrice(price) ? price : undefined,
      claimedStock: null,
      grounded: true,
    });
  }

  // 4. Verificación: leemos la ficha de la tienda y sacamos el precio de sus datos estructurados.
  const verified = await mapLimit([...candidates.values()].slice(0, MAX_CANDIDATES), 5, async (c): Promise<Offer | null> => {
    const page = await fetchStorePage(c.url, { fetchFn: deps.fetchFn, signal: opts.signal });
    const base = { storeId: c.storeId, store: c.store, url: c.url, currency: 'EUR' as const, checkedAt };

    if (page.kind === 'notfound') return null; // descatalogado o URL inventada

    if (page.kind === 'ok') {
      const product = extractProduct(page.html);
      const nameOnPage = product.title ?? slugText(page.finalUrl);
      if (validPrice(product.price)) {
        if (!isSameProduct(q.name, `${nameOnPage} ${slugText(page.finalUrl)}`)) return null; // es otro producto
        return { ...base, url: normalizeProductUrl(page.finalUrl) ?? c.url, price: product.price, inStock: product.inStock, status: 'verified', title: product.title };
      }
      // Página leída pero sin precio estructurado (o reto anti-bot): caemos al precio de Google.
      if (!isBotChallenge(page.html) && product.title && !isSameProduct(q.name, product.title)) return null;
    }

    // La tienda no deja leer la ficha: solo aceptamos el precio si la URL salió de Google
    // y el slug corresponde al producto.
    if (c.grounded && validPrice(c.claimedPrice) && isSameProduct(q.name, slugText(c.rawUrl), 0.5)) {
      return { ...base, price: c.claimedPrice, inStock: c.claimedStock, status: 'google' };
    }
    return null;
  });

  // 5. Limpieza: una oferta por tienda (la más barata, priorizando verificadas) y fuera precios absurdos.
  const byStore = new Map<string, Offer>();
  for (const o of verified) {
    if (!o) continue;
    const prev = byStore.get(o.storeId);
    const better = !prev || (o.status === 'verified' && prev.status !== 'verified') || (o.status === prev.status && o.price < prev.price);
    if (better) byStore.set(o.storeId, o);
  }
  let offers = [...byStore.values()];
  if (offers.length >= 2) {
    const sorted = offers.map((o) => o.price).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    offers = offers.filter((o) => o.price >= median * 0.4 && o.price <= median * 2.5);
  }
  offers.sort((a, b) => a.price - b.price);

  const result: PriceResult = {
    offers,
    checkedAt,
    searchSuggestionsHtml: res.grounding?.searchEntryPoint?.renderedContent,
    queries: res.grounding?.webSearchQueries ?? [],
    fromCache: false,
  };
  deps.cache?.set(q, result);
  return result;
}
