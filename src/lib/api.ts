import type { BuildComponent, PriceResult, PriceStatus, RecommendRequest, RecommendResponse } from '../../shared/types';

async function errorFrom(res: Response): Promise<Error> {
  try {
    const data = await res.json();
    return new Error(data?.error || `Error ${res.status}`);
  } catch {
    return new Error(`Error ${res.status}`);
  }
}

export async function getRecommendation(body: RecommendRequest): Promise<RecommendResponse> {
  const res = await fetch('/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}

/** Vuelve a leer ahora las fichas del producto en las tiendas. */
export async function refreshPrices(c: BuildComponent, url?: string): Promise<PriceResult> {
  const res = await fetch('/api/prices/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ catalogId: c.catalogId, url }),
  });
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}

export async function getStatus(): Promise<PriceStatus | null> {
  try {
    const res = await fetch('/api/status');
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}
