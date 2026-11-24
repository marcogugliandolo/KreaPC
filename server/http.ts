import { identifyStore, looksLikeProductPage, safeUrl } from './stores';

export type FetchFn = typeof fetch;

/**
 * Nos identificamos de forma honesta (como hacen los generadores de vistas previas
 * de enlaces). Si una tienda no quiere servirnos la página, usamos el precio de Google.
 */
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; KreaPC/2.0; +https://github.com/marcogugliandolo/KreaPC)',
  Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9',
};

const MAX_HTML_BYTES = 3_000_000;
const GROUNDING_REDIRECT_HOST = 'vertexaisearch.cloud.google.com';

/** Combina la señal del cliente con un timeout (sin depender de AbortSignal.any). */
function withTimeout(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort(signal?.reason);
  if (signal?.aborted) ctrl.abort(signal.reason);
  else signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), ms);
  return {
    signal: ctrl.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

export type PageResult =
  | { kind: 'ok'; html: string; finalUrl: string }
  | { kind: 'notfound'; finalUrl?: string }
  | { kind: 'blocked'; status?: number }
  | { kind: 'error'; reason: string };

/**
 * Descarga la ficha de una tienda conocida. Sigue redirecciones a mano para
 * comprobar que nunca salimos de las tiendas permitidas.
 */
export async function fetchStorePage(
  url: string,
  opts: { fetchFn?: FetchFn; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<PageResult> {
  const fetchFn = opts.fetchFn ?? fetch;
  const t = withTimeout(opts.signal, opts.timeoutMs ?? 7000);
  try {
    let current = url;
    for (let hop = 0; hop < 5; hop++) {
      const u = safeUrl(current);
      if (!u || !identifyStore(u)) return { kind: 'error', reason: 'fuera de las tiendas permitidas' };
      const res = await fetchFn(u.toString(), { headers: HEADERS, redirect: 'manual', signal: t.signal });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        await res.body?.cancel().catch(() => {});
        if (!loc) return { kind: 'error', reason: `redirección ${res.status} sin destino` };
        current = new URL(loc, u).toString();
        // Producto descatalogado: muchas tiendas redirigen a la portada o a un listado.
        if (!looksLikeProductPage(current)) return { kind: 'notfound', finalUrl: current };
        continue;
      }
      if (res.status === 404 || res.status === 410) {
        await res.body?.cancel().catch(() => {});
        return { kind: 'notfound', finalUrl: current };
      }
      if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 503) {
        await res.body?.cancel().catch(() => {});
        return { kind: 'blocked', status: res.status };
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => {});
        return { kind: 'error', reason: `HTTP ${res.status}` };
      }
      const html = await res.text();
      return { kind: 'ok', html: html.length > MAX_HTML_BYTES ? html.slice(0, MAX_HTML_BYTES) : html, finalUrl: current };
    }
    return { kind: 'error', reason: 'demasiadas redirecciones' };
  } catch (err) {
    return { kind: 'error', reason: err instanceof Error ? err.message : String(err) };
  } finally {
    t.done();
  }
}

/**
 * Las fuentes de Google Search llegan como enlaces de redirección
 * (vertexaisearch.cloud.google.com/grounding-api-redirect/...). Leemos el destino real.
 */
export async function resolveGroundingUrl(
  uri: string | undefined,
  opts: { fetchFn?: FetchFn; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<string | null> {
  const u = safeUrl(uri);
  if (!u) return null;
  if (u.hostname !== GROUNDING_REDIRECT_HOST) return u.toString();
  const fetchFn = opts.fetchFn ?? fetch;
  const t = withTimeout(opts.signal, opts.timeoutMs ?? 4000);
  try {
    const res = await fetchFn(u.toString(), { redirect: 'manual', signal: t.signal, headers: { 'User-Agent': HEADERS['User-Agent'] } });
    await res.body?.cancel().catch(() => {});
    const loc = res.headers.get('location');
    return loc ? new URL(loc, u).toString() : null;
  } catch {
    return null;
  } finally {
    t.done();
  }
}

/** map con límite de concurrencia. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
