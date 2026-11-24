import type { BuildComponent, PriceResult, RecommendRequest, StreamEvent } from '../../shared/types';

async function errorFrom(res: Response): Promise<Error> {
  try {
    const data = await res.json();
    return new Error(data?.error || `Error ${res.status}`);
  } catch {
    return new Error(`Error ${res.status}`);
  }
}

/** Lee la respuesta NDJSON de /api/recommend y llama a onEvent con cada evento. */
export async function streamRecommendation(body: RecommendRequest, onEvent: (ev: StreamEvent) => void, signal?: AbortSignal) {
  const res = await fetch('/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw await errorFrom(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const ev = JSON.parse(line) as StreamEvent;
      if (ev.type === 'done' || ev.type === 'error') finished = true;
      onEvent(ev);
    }
  }
  if (!finished) throw new Error('La conexión se cortó antes de terminar. Inténtalo de nuevo.');
}

export async function refreshPrices(c: BuildComponent): Promise<PriceResult> {
  const res = await fetch('/api/prices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: c.type, name: c.name, searchQuery: c.searchQuery, estimatedPrice: c.estimatedPrice, force: true }),
  });
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}
