/**
 * Descubre fichas de producto en páginas de categoría o de búsqueda de las tiendas.
 * Así el catálogo no depende solo de URLs escritas a mano: si una tienda cambia la URL
 * de un producto o añade una variante nueva, se encuentra en la siguiente pasada.
 */
import type { CatalogItem } from './catalog';
import { collectProducts, parseJsonLoose } from './extract';
import { matchesItem } from './matching';
import { identifyStore, looksLikeProductPage, normalizeProductUrl, slugText } from './stores';

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Páginas de búsqueda de tiendas PrestaShop (formato estándar index.php?controller=search). */
export function searchPages(item: CatalogItem): string[] {
  const q = encodeURIComponent(item.query);
  return [
    `https://www.neobyte.es/index.php?controller=search&s=${q}`,
    `https://www.wipoid.com/index.php?controller=search&s=${q}`,
    `https://www.aussar.es/index.php?controller=search&s=${q}`,
  ];
}

/**
 * Enlaces a fichas del producto dentro de un listado: primero los del JSON-LD (ItemList),
 * luego los <a> cuyo texto, título o URL encajan con el producto.
 */
export function extractProductLinks(html: string, pageUrl: string, item: CatalogItem, limit = 6): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const add = (href: string | undefined, text: string) => {
    if (!href || found.length >= limit) return;
    let abs: string;
    try {
      abs = new URL(decode(href), pageUrl).toString();
    } catch {
      return;
    }
    const url = normalizeProductUrl(abs);
    if (!url || seen.has(url) || !identifyStore(url) || !looksLikeProductPage(url)) return;
    if (!matchesItem(item, `${text} ${slugText(abs)}`)) return;
    seen.add(url);
    found.push(url);
  };

  // 1. JSON-LD de listados (ItemList con productos).
  const re = /<script[^>]+type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const products: any[] = [];
    const data = parseJsonLoose(m[1]);
    if (data) collectProducts(data, products);
    for (const p of products) {
      const href = typeof p.url === 'string' ? p.url : typeof p['@id'] === 'string' ? p['@id'] : p.offers?.url;
      if (typeof p.name === 'string') add(href, p.name);
    }
  }

  // 2. Enlaces del HTML.
  const aRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(aRe)) {
    const attrs = m[1];
    const href = attrs.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    const title = attrs.match(/title\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
    add(href, `${decode(m[2])} ${decode(title)}`);
  }
  return found;
}
