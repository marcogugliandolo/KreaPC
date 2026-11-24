/**
 * Tiendas españolas de las que aceptamos precios. Solo se descargan páginas de
 * estos dominios (evita SSRF y enlaces a webs dudosas).
 */

export interface Store {
  id: string;
  name: string;
  hosts: string[];
  /** Para dominios multipaís (ldlc.com, lenovo.com…): solo la sección de España. */
  pathPrefix?: RegExp;
  /** Portada de la tienda en España (por defecto https://www.<dominio>/). */
  home?: string;
}

export const storeHome = (s: Store) => s.home ?? `https://www.${s.hosts[0]}/`;

export const STORES: Store[] = [
  { id: 'pccomponentes', name: 'PcComponentes', hosts: ['pccomponentes.com'] },
  { id: 'amazon', name: 'Amazon', hosts: ['amazon.es'] },
  { id: 'coolmod', name: 'Coolmod', hosts: ['coolmod.com'] },
  { id: 'wipoid', name: 'Wipoid', hosts: ['wipoid.com'] },
  { id: 'ldlc', name: 'LDLC', hosts: ['ldlc.com'], pathPrefix: /^\/es-es\//i, home: 'https://www.ldlc.com/es-es/' },
  { id: 'neobyte', name: 'Neobyte', hosts: ['neobyte.es'] },
  { id: 'alternate', name: 'Alternate', hosts: ['alternate.es'] },
  { id: 'mediamarkt', name: 'MediaMarkt', hosts: ['mediamarkt.es'] },
  { id: 'elcorteingles', name: 'El Corte Inglés', hosts: ['elcorteingles.es'] },
  { id: 'aussar', name: 'Aussar', hosts: ['aussar.es'] },
  { id: 'xtremmedia', name: 'Xtremmedia', hosts: ['xtremmedia.com'] },
  { id: 'izarmicro', name: 'Izarmicro', hosts: ['izarmicro.net'] },
  { id: 'appinformatica', name: 'App Informática', hosts: ['appinformatica.com'] },
  { id: 'pcbox', name: 'PCBox', hosts: ['pcbox.com'] },
  { id: 'fnac', name: 'Fnac', hosts: ['fnac.es'] },
  { id: 'worten', name: 'Worten', hosts: ['worten.es'] },
  { id: 'vsgamers', name: 'VS Gamers', hosts: ['vsgamers.es'] },
  { id: 'carrefour', name: 'Carrefour', hosts: ['carrefour.es'] },
  { id: 'lenovo', name: 'Lenovo', hosts: ['lenovo.com'], pathPrefix: /^\/es\//i, home: 'https://www.lenovo.com/es/es/' },
  { id: 'hp', name: 'HP Store', hosts: ['hp.com'], pathPrefix: /^\/es-es\//i, home: 'https://www.hp.com/es-es/home.html' },
  { id: 'dell', name: 'Dell', hosts: ['dell.com'], pathPrefix: /^\/es-es\//i, home: 'https://www.dell.com/es-es' },
  { id: 'apple', name: 'Apple', hosts: ['apple.com'], pathPrefix: /^\/es\//i, home: 'https://www.apple.com/es/' },
];

const hostMatches = (host: string, h: string) => host === h || host.endsWith(`.${h}`);

export function safeUrl(raw: string | undefined): URL | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u;
  } catch {
    return null;
  }
}

export function identifyStore(raw: string | URL | undefined): Store | null {
  const u = raw instanceof URL ? raw : safeUrl(raw);
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  return (
    STORES.find((s) => s.hosts.some((h) => hostMatches(host, h)) && (!s.pathPrefix || s.pathPrefix.test(u.pathname))) ?? null
  );
}

const TRACKING_PARAMS = /^(utm_.*|gclid|gbraid|wbraid|gad_source|gad_campaignid|srsltid|fbclid|msclkid|mc_cid|mc_eid|ref|ref_|tag|psc|th|smid|qid|sr|keywords|crid|sprefix|dib|dib_tag|_encoding|pd_rd_.*|pf_rd_.*|content-id|linkcode|linkid|camp|creative|ascsubtag|affid|aff_id|campaign|source|medium)$/i;

/** Normaliza la URL de una ficha: https, sin tracking, sin #, Amazon como /dp/ASIN. */
export function normalizeProductUrl(raw: string | undefined): string | null {
  const u = safeUrl(raw);
  if (!u) return null;
  u.protocol = 'https:';
  u.hash = '';
  u.hostname = u.hostname.toLowerCase();

  const store = identifyStore(u);
  if (store?.id === 'amazon') {
    const asin = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i)?.[1];
    if (asin) return `https://www.amazon.es/dp/${asin.toUpperCase()}`;
  }

  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
  }
  let out = u.toString();
  if (out.endsWith('?')) out = out.slice(0, -1);
  return out;
}

const LISTING_PATTERNS = [
  /\/(buscar|busqueda|search|resultados)\b/i,
  /\/s(\/|$)/i,
  /\/(categoria|categorias|category|categories|listado|marcas?|brand|ofertas|outlet|tag)\//i,
  /[?&](q|query|search|k|s|keyword|text)=/i,
];

/**
 * Descarta páginas de búsqueda y listados: un precio de un listado no es el
 * precio del producto concreto.
 */
export function looksLikeProductPage(raw: string | undefined): boolean {
  const u = safeUrl(raw);
  if (!u) return false;
  const store = identifyStore(u);
  if (!store) return false;
  if (store.id === 'amazon') return /\/(dp|gp\/product|gp\/aw\/d)\/[A-Z0-9]{10}/i.test(u.pathname);
  const pathAndQuery = u.pathname + u.search;
  if (LISTING_PATTERNS.some((re) => re.test(pathAndQuery))) return false;
  const segments = u.pathname.split('/').filter(Boolean);
  if (store.pathPrefix) segments.shift();
  return segments.length > 0;
}

/** Texto legible del slug de la URL, útil para comprobar que es el producto correcto. */
export function slugText(raw: string): string {
  const u = safeUrl(raw);
  if (!u) return '';
  return decodeURIComponent(u.pathname).replace(/[-_/.]+/g, ' ').replace(/\b(html?|php|aspx)\b/gi, ' ');
}

export function storeById(id: string): Store | undefined {
  return STORES.find((s) => s.id === id);
}

export function storeByName(name: string | undefined): Store | undefined {
  if (!name) return undefined;
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return STORES.find((s) => s.name.toLowerCase().replace(/[^a-z0-9]/g, '') === n || s.id === n);
}
