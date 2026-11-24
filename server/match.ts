/**
 * Comprueba que el producto de una tienda es el mismo modelo que pidió la IA
 * (evita coger el precio de otra capacidad, otra variante o un accesorio).
 */

const STOPWORDS = new Set(['de', 'con', 'para', 'the', 'and', 'with', 'gaming', 'edition', 'nuevo', 'new']);

const compact = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Tokens que identifican el modelo: los que llevan números (7800x3d, b650, 32gb, rm850e…). */
export function modelTokens(name: string): string[] {
  const all = tokens(name);
  const withDigits = all.filter((t) => /\d/.test(t) && t.length >= 2);
  if (withDigits.length) return [...new Set(withDigits)];
  return [...new Set(all.filter((t) => t.length >= 3 && !STOPWORDS.has(t)))];
}

/** Variante de unidades equivalentes: "6000mhz" ≈ "6000mts" ≈ "6000". */
function variants(token: string): string[] {
  const m = token.match(/^(\d+)(mhz|mts|mt|hz)$/);
  return m ? [token, m[1]] : [token];
}

/** Proporción de tokens de modelo presentes en el texto (0–1). */
export function matchScore(name: string, text: string): number {
  const wanted = modelTokens(name);
  if (!wanted.length) return 0;
  const hay = compact(text);
  const hit = wanted.filter((t) => variants(t).some((v) => hay.includes(v))).length;
  return hit / wanted.length;
}

export function isSameProduct(name: string, text: string | undefined, threshold = 0.6): boolean {
  if (!text) return false;
  return matchScore(name, text) >= threshold;
}
