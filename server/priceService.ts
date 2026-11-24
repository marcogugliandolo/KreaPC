/**
 * Servicio de precios: lee periódicamente las fichas de las tiendas y guarda el precio
 * que publican en sus datos estructurados (schema.org / JSON-LD). Sin APIs de terceros.
 *
 * - Una petición a la vez por tienda y una pausa entre peticiones (no saturamos a nadie).
 * - Respeta robots.txt.
 * - Si una ficha deja de existir (404) o pasa a ser otro producto, el precio se borra.
 * - Si una tienda bloquea temporalmente, se conserva el último precio leído hasta que caduca.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Offer, PriceResult, PriceStatus } from '../shared/types';
import type { CatalogItem } from './catalog';
import { extractProductLinks, searchPages } from './discovery';
import { extractProducts, isBotChallenge, isDiscontinuedPage } from './extract';
import { fetchStorePage, mapLimit, type FetchFn, type PageResult } from './http';
import { matchesItem } from './matching';
import { RobotsCache } from './robots';
import { identifyStore, normalizeProductUrl, slugText } from './stores';

export interface PriceServiceOptions {
  fetchFn?: FetchFn;
  now?: () => Date;
  /** Cada cuántas horas se vuelven a leer todas las fichas. */
  refreshHours?: number;
  /** Cada cuántas horas se buscan fichas nuevas en categorías y buscadores. */
  discoveryHours?: number;
  /** Horas que un precio sigue siendo válido si la tienda no se puede consultar. */
  maxAgeHours?: number;
  /** Pausa entre peticiones a la misma tienda. */
  hostDelayMs?: number;
  /** Fichero donde guardar los precios entre reinicios (null = no guardar). */
  file?: string | null;
  respectRobots?: boolean;
  /** Horas que se deja de consultar una tienda que bloquea al servidor. */
  storeBlockHours?: number;
  log?: (msg: string) => void;
}

interface StoreHealth {
  /** Fallos seguidos (403, 429, reto anti-bot, sin respuesta…). */
  strikes: number;
  /** Hasta cuándo no se le vuelve a pedir nada (ms). */
  pausedUntil?: number;
}

/** Bloqueos seguidos tras los que se deja de consultar una tienda durante un tiempo. */
const STRIKES_TO_PAUSE = 3;
const PAUSED = 'tienda en pausa';

interface ItemState {
  offers: Record<string, Offer>;
  discovered: string[];
  lastDiscovery?: string;
  checkedAt?: string;
  failures: Record<string, string>;
}

export interface ItemReport {
  id: string;
  name: string;
  offers: Offer[];
  failures: Record<string, string>;
}

const MIN_PRICE = 1;
const MAX_PRICE = 20000;
const MAX_URLS_PER_ITEM = 14;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function describe(res: PageResult): string {
  switch (res.kind) {
    case 'blocked':
      return `bloqueado (HTTP ${res.status ?? '?'})`;
    case 'notfound':
      return 'no existe (404 o redirige a otra página)';
    case 'error':
      return `error: ${res.reason}`;
    default:
      return 'ok';
  }
}

export class PriceService {
  private state: Record<string, ItemState> = {};
  private chains = new Map<string, Promise<unknown>>();
  private robots: RobotsCache;
  private running: Promise<ItemReport[]> | null = null;
  private timer: NodeJS.Timeout | null = null;
  private progress = { done: 0, total: 0 };
  private lastRefresh?: string;
  private stores: Record<string, StoreHealth> = {};
  private readonly opts: Required<Omit<PriceServiceOptions, 'file' | 'log'>> & Pick<PriceServiceOptions, 'file' | 'log'>;

  constructor(private catalog: CatalogItem[], options: PriceServiceOptions = {}) {
    this.opts = {
      fetchFn: options.fetchFn ?? fetch,
      now: options.now ?? (() => new Date()),
      refreshHours: options.refreshHours ?? 6,
      discoveryHours: options.discoveryHours ?? 24,
      maxAgeHours: options.maxAgeHours ?? 48,
      hostDelayMs: options.hostDelayMs ?? 1500,
      respectRobots: options.respectRobots ?? true,
      storeBlockHours: options.storeBlockHours ?? 24,
      file: options.file,
      log: options.log,
    };
    this.robots = new RobotsCache(this.opts.fetchFn);
  }

  /* ------------------------------ Ciclo de vida ----------------------------- */

  async start() {
    await this.load();
    void this.refreshAll();
    this.timer = setInterval(() => void this.refreshAll(), this.opts.refreshHours * 3_600_000);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  status(): PriceStatus {
    const itemsWithPrice = this.catalog.filter((i) => this.getPrices(i.id).offers.length > 0).length;
    return {
      ready: Boolean(this.lastRefresh),
      refreshing: Boolean(this.running),
      lastRefresh: this.lastRefresh,
      progress: { ...this.progress },
      items: this.catalog.length,
      itemsWithPrice,
    };
  }

  /* --------------------------------- Lectura -------------------------------- */

  /** Ofertas vigentes de un producto: una por tienda, la más barata primero. */
  getPrices(itemId: string): PriceResult {
    const st = this.state[itemId];
    if (!st) return { offers: [] };
    const now = this.opts.now().getTime();
    const maxAge = this.opts.maxAgeHours * 3_600_000;
    const byStore = new Map<string, Offer>();
    for (const o of Object.values(st.offers)) {
      if (now - new Date(o.checkedAt).getTime() > maxAge) continue;
      const prev = byStore.get(o.storeId);
      if (!prev || o.price < prev.price) byStore.set(o.storeId, o);
    }
    let offers = [...byStore.values()];
    // Defensa extra contra variantes mal emparejadas: fuera precios absurdamente bajos.
    if (offers.length >= 3) {
      const sorted = offers.map((o) => o.price).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      offers = offers.filter((o) => o.price >= median * 0.4);
    }
    offers.sort((a, b) => a.price - b.price);
    return { offers, checkedAt: st.checkedAt };
  }

  /** Ofertas que se pueden comprar ahora (con stock o sin dato de stock). */
  buyable(itemId: string): Offer[] {
    return this.getPrices(itemId).offers.filter((o) => o.inStock !== false);
  }

  /** Todas las ofertas vigentes y comprables, sin agrupar por tienda (portátiles). */
  allBuyable(itemId: string): Offer[] {
    const st = this.state[itemId];
    if (!st) return [];
    const now = this.opts.now().getTime();
    const maxAge = this.opts.maxAgeHours * 3_600_000;
    return Object.values(st.offers)
      .filter((o) => o.inStock !== false && now - new Date(o.checkedAt).getTime() <= maxAge)
      .sort((a, b) => a.price - b.price);
  }

  /** Diagnóstico: qué productos tienen precio y por qué falla cada URL, agrupado por tienda. */
  report() {
    const stores: Record<string, { ok: number; fallos: Record<string, number> }> = {};
    const items = this.catalog.map((item) => {
      const st = this.state[item.id];
      const offers = this.getPrices(item.id).offers;
      for (const o of Object.values(st?.offers ?? {})) (stores[o.storeId] ??= { ok: 0, fallos: {} }).ok++;
      for (const [url, reason] of Object.entries(st?.failures ?? {})) {
        const host = identifyStore(url)?.id ?? url;
        const key = reason.replace(/: ".*$/, '').replace(/^error: .*/, 'error de red');
        const s = (stores[host] ??= { ok: 0, fallos: {} });
        s.fallos[key] = (s.fallos[key] ?? 0) + 1;
      }
      return {
        id: item.id,
        precios: offers.map((o) => `${o.store} ${o.price} €`),
        comprobado: st?.checkedAt,
        fallos: st?.failures ?? {},
      };
    });
    const pausas = Object.fromEntries(
      Object.entries(this.stores)
        .filter(([, h]) => h.pausedUntil)
        .map(([id, h]) => [id, new Date(h.pausedUntil!).toISOString()]),
    );
    return { estado: this.status(), tiendas: stores, tiendasEnPausaHasta: pausas, productos: items };
  }

  /* -------------------------------- Refresco -------------------------------- */

  refreshAll(): Promise<ItemReport[]> {
    if (this.running) return this.running;
    this.progress = { done: 0, total: this.catalog.length };
    this.running = (async () => {
      const started = Date.now();
      try {
        const reports = await mapLimit(this.catalog, 4, async (item) => {
          const r = await this.refreshItem(item).catch((err) => {
            this.opts.log?.(`[precios] ${item.id}: ${err}`);
            return { id: item.id, name: item.name, offers: [], failures: { general: String(err) } };
          });
          this.progress.done++;
          if (this.progress.done % 5 === 0) await this.save(); // no perder lo leído si se reinicia
          return r;
        });
        this.lastRefresh = this.opts.now().toISOString();
        await this.save();
        const ok = reports.filter((r) => r.offers.length).length;
        this.opts.log?.(`[precios] actualizados ${ok}/${reports.length} productos en ${Math.round((Date.now() - started) / 1000)} s`);
        return reports;
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  async refreshItem(item: CatalogItem, opts: { forceDiscovery?: boolean } = {}): Promise<ItemReport> {
    const st = (this.state[item.id] ??= { offers: {}, discovered: [], failures: {} });
    const now = this.opts.now();
    const failures: Record<string, string> = {};

    // 1. Descubrir fichas nuevas (como mucho una vez al día).
    const discoveryAge = st.lastDiscovery ? now.getTime() - new Date(st.lastDiscovery).getTime() : Infinity;
    if (opts.forceDiscovery || discoveryAge > this.opts.discoveryHours * 3_600_000) {
      const pages = [...(item.listings ?? []), ...searchPages(item)];
      const found = new Set<string>();
      await Promise.all(
        pages.map(async (page) => {
          if (this.isPaused(page, now)) {
            failures[page] = 'tienda en pausa: bloquea al servidor o no responde, se reintenta más tarde';
            return;
          }
          if (!(await this.allowed(page))) {
            failures[page] = 'no permitido por robots.txt';
            return;
          }
          const res = await this.fetchTracked(page, false);
          if (res.kind === 'ok') extractProductLinks(res.html, res.finalUrl, item).forEach((u) => found.add(u));
          else failures[page] = describe(res);
        }),
      );
      st.discovered = [...found];
      st.lastDiscovery = now.toISOString();
    }

    // 2. Leer cada ficha conocida.
    const seeds = (item.seeds ?? []).map((u) => normalizeProductUrl(u)).filter((u): u is string => Boolean(u));
    // Primero las tiendas que dejan leer sus fichas; las que bloquean se saltan un tiempo.
    const all = [...new Set([...seeds, ...st.discovered, ...Object.keys(st.offers)])];
    const urls = all.filter((u) => !this.isPaused(u, now)).slice(0, MAX_URLS_PER_ITEM);
    for (const u of all) if (this.isPaused(u, now)) failures[u] = 'tienda en pausa: bloquea al servidor o no responde, se reintenta más tarde';

    await Promise.all(
      urls.map(async (url) => {
        const store = identifyStore(url);
        if (!store) return;
        if (!(await this.allowed(url))) {
          failures[url] = 'no permitido por robots.txt';
          delete st.offers[url];
          return;
        }
        // La comprobación va dentro de la cola: si la tienda se pausa mientras esperamos, no se le pide nada.
        const res = await this.fetchTracked(url, true);
        if (res.kind === 'error' && res.reason === PAUSED) {
          failures[url] = 'tienda en pausa: bloquea al servidor o no responde, se reintenta más tarde';
          return;
        }
        if (res.kind === 'notfound') {
          failures[url] = describe(res);
          delete st.offers[url];
          st.discovered = st.discovered.filter((u) => u !== url);
          return;
        }
        if (res.kind !== 'ok') {
          failures[url] = describe(res); // se conserva el último precio leído hasta que caduque
          return;
        }

        const products = extractProducts(res.html);
        if (!products.length) {
          if (isBotChallenge(res.html)) {
            failures[url] = 'bloqueado (reto anti-bot)';
          } else {
            failures[url] = 'la página no publica el precio en datos estructurados';
            delete st.offers[url];
          }
          return;
        }
        if (isDiscontinuedPage(res.html)) {
          failures[url] = 'la tienda ya no lo vende';
          delete st.offers[url];
          return;
        }
        const slug = slugText(res.finalUrl);
        const matching = products.filter(
          (p) => p.price && p.price >= MIN_PRICE && p.price <= MAX_PRICE && matchesItem(item, `${p.title ?? ''} ${slug}`),
        );
        if (!matching.length) {
          failures[url] = `es otro producto: "${products[0].title ?? 'sin nombre'}"`;
          delete st.offers[url];
          return;
        }
        const inStock = matching.filter((p) => p.inStock !== false);
        const best = (inStock.length ? inStock : matching).reduce((a, b) => (b.price! < a.price! ? b : a));
        st.offers[url] = {
          storeId: store.id,
          store: store.name,
          url: normalizeProductUrl(res.finalUrl) ?? url,
          price: best.price!,
          currency: 'EUR',
          inStock: best.inStock,
          title: best.title,
          checkedAt: now.toISOString(),
        };
      }),
    );

    st.checkedAt = now.toISOString();
    st.failures = failures;
    return { id: item.id, name: item.name, offers: this.getPrices(item.id).offers, failures };
  }

  /* -------------------------------- Interno --------------------------------- */

  /**
   * Pide una página por la cola de su tienda y anota si la tienda responde.
   * Todo ocurre dentro de la cola: si la tienda se pausa mientras esperamos turno, no se le pide nada.
   * Bloqueos, cortes y tiempos de espera cuentan igual: una tienda que no responde no debe atascar la lectura.
   */
  private fetchTracked(url: string, expectProduct: boolean): Promise<PageResult> {
    return this.queue(url, async () => {
      if (this.isPaused(url, this.opts.now())) return { kind: 'error', reason: PAUSED } as PageResult;
      const res = await fetchStorePage(url, { fetchFn: this.opts.fetchFn, expectProduct });
      const storeId = identifyStore(url)?.id;
      if (storeId) {
        const challenge = expectProduct && res.kind === 'ok' && !extractProducts(res.html).length && isBotChallenge(res.html);
        this.recordHealth(storeId, res.kind === 'blocked' || res.kind === 'error' || challenge);
      }
      return res;
    });
  }

  private isPaused(url: string, now: Date): boolean {
    const id = identifyStore(url)?.id;
    const until = id ? this.stores[id]?.pausedUntil : undefined;
    return Boolean(until && until > now.getTime());
  }

  /** Cuenta bloqueos seguidos; al llegar al límite la tienda se pausa (no insistimos si no quiere). */
  private recordHealth(storeId: string, blocked: boolean) {
    const h = (this.stores[storeId] ??= { strikes: 0 });
    if (!blocked) {
      h.strikes = 0;
      h.pausedUntil = undefined;
      return;
    }
    h.strikes++;
    if (h.strikes >= STRIKES_TO_PAUSE && !h.pausedUntil) {
      h.pausedUntil = this.opts.now().getTime() + this.opts.storeBlockHours * 3_600_000;
      this.opts.log?.(`[precios] ${storeId} bloquea al servidor o no responde: en pausa ${this.opts.storeBlockHours} h`);
    }
  }

  private allowed(url: string): Promise<boolean> {
    return this.opts.respectRobots ? this.robots.allowed(url) : Promise.resolve(true);
  }

  /** Cola por tienda: una petición a la vez y una pausa entre peticiones. */
  private queue<T>(url: string, fn: () => Promise<T>): Promise<T> {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const prev = this.chains.get(host) ?? Promise.resolve();
    const run = prev.then(fn);
    this.chains.set(
      host,
      run.catch(() => {}).then(() => sleep(this.opts.hostDelayMs)),
    );
    return run;
  }

  private async load() {
    if (!this.opts.file) return;
    try {
      const data = JSON.parse(await fs.readFile(this.opts.file, 'utf8'));
      if (data?.version === 1 && data.state) {
        this.state = data.state;
        this.lastRefresh = data.lastRefresh;
        this.stores = data.stores ?? {};
      }
    } catch {
      /* primera ejecución */
    }
  }

  private async save() {
    if (!this.opts.file) return;
    try {
      await fs.mkdir(path.dirname(this.opts.file), { recursive: true });
      await fs.writeFile(this.opts.file, JSON.stringify({ version: 1, lastRefresh: this.lastRefresh, state: this.state, stores: this.stores }));
    } catch (err) {
      this.opts.log?.(`[precios] no se pudo guardar ${this.opts.file}: ${err}`);
    }
  }
}
