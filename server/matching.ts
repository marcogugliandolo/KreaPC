/**
 * Decide si el nombre de un producto en una tienda corresponde a un producto del catálogo.
 * Es estricto a propósito: es mejor no mostrar un precio que mostrar el de otro modelo.
 */
import type { CatalogItem } from './catalog';

/** Nunca aceptamos packs, reacondicionados ni productos usados. */
const GLOBAL_EXCLUDE_WORDS = ['reacondicionado', 'reacondicionada', 'refurbished', 'pack', 'bundle', 'usado', 'usada', 'outlet', 'kitpc'];
const GLOBAL_EXCLUDE_PHRASES = ['segunda mano', 'caja abierta', 'open box', 'como nuevo'];

/** Indicadores de que el producto es un portátil: palabra clave o tamaño de pantalla (15,6", 16"…). */
const LAPTOP_WORDS = ['portatil', 'laptop', 'notebook', 'macbook'];
const SCREEN_INCHES = /\b1[1-8](?:[.,]\d)?\s?(?:"|”|″|''|pulgadas|inch)/i;

export function normalizeText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const words = (s: string) => new Set(normalizeText(s).split(/[^a-z0-9]+/).filter(Boolean));
const compact = (s: string) => normalizeText(s).replace(/[^a-z0-9]/g, '');

function hasToken(token: string, w: Set<string>, c: string): boolean {
  const t = normalizeText(token);
  // Con números (7800x3d, 2x16, 16gb) se busca dentro del texto; sin números, palabra completa.
  return /\d/.test(t) ? c.includes(t.replace(/[^a-z0-9]/g, '')) : w.has(t);
}

export function matchesItem(item: Pick<CatalogItem, 'match' | 'exclude' | 'anyOf' | 'laptop'>, text: string | undefined): boolean {
  if (!text) return false;
  const w = words(text);
  const c = compact(text);
  const n = normalizeText(text);
  if (!item.match.every((t) => hasToken(t, w, c))) return false;
  if (item.exclude?.some((t) => hasToken(t, w, c))) return false;
  if (item.anyOf && !item.anyOf.some((t) => hasToken(t, w, c))) return false;
  if (GLOBAL_EXCLUDE_WORDS.some((t) => w.has(t)) || GLOBAL_EXCLUDE_PHRASES.some((p) => n.includes(p))) return false;
  if (item.laptop && !LAPTOP_WORDS.some((t) => w.has(t)) && !SCREEN_INCHES.test(text)) return false;
  return true;
}

/** RAM de un portátil a partir de su nombre ("… 16GB 512GB SSD RTX 5060 8GB" → 16). */
export function laptopRamGB(title: string): number | undefined {
  const m = normalizeText(title).match(/(\d{1,2})\s?gb(?!\s*(?:ssd|gddr|vram|de vram))/);
  const n = m ? Number(m[1]) : undefined;
  return n && [8, 12, 16, 18, 24, 32, 36, 48, 64].includes(n) ? n : undefined;
}
