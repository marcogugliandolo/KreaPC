import express, { type Request, type Response, type NextFunction } from 'express';
import { COMPONENT_TYPES, type Build, type ComponentType, type PriceResult, type RecommendRequest, type StreamEvent } from '../shared/types';
import { friendlyAiError, type AiClient } from './gemini';
import { mapLimit, type FetchFn } from './http';
import { lookupPrices, PriceCache, type PriceQuery } from './prices';
import { recommendBuild } from './recommend';

export interface AppDeps {
  ai: AiClient | null;
  fetchFn?: FetchFn;
  now?: () => Date;
  priceConcurrency?: number;
  priceCacheMinutes?: number;
  recommendPerHour?: number;
  pricesPerHour?: number;
}

/** Límite sencillo por IP (ventana deslizante en memoria) para proteger los créditos de la API. */
function rateLimit(perHour: number) {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    if (perHour <= 0) return next();
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    const recent = (hits.get(key) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= perHour) {
      const retryMin = Math.ceil((3_600_000 - (now - recent[0])) / 60_000);
      return res.status(429).json({ error: `Has hecho muchas consultas seguidas. Vuelve a intentarlo en ${retryMin} min.` });
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.delete(hits.keys().next().value!);
    next();
  };
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

function parseRecommendBody(body: any): RecommendRequest {
  return {
    deviceType: body?.deviceType === 'Portátil' ? 'Portátil' : 'Torre',
    useCase: text(body?.useCase, 60),
    budget: text(body?.budget, 40),
    ram: text(body?.ram, 20),
    storage: text(body?.storage, 20),
    vram: text(body?.vram, 20),
    extraDetails: text(body?.extraDetails, 500),
    includePeripherals: Boolean(body?.includePeripherals),
  };
}

export function createApp(deps: AppDeps) {
  const app = express();
  // Detrás de Nginx Proxy Manager / Docker: confiamos solo en proxies de red privada.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.use(express.json({ limit: '32kb' }));

  const cache = new PriceCache((deps.priceCacheMinutes ?? 180) * 60_000);
  const concurrency = deps.priceConcurrency ?? 4;

  const requireAi = (_req: Request, res: Response, next: NextFunction) => {
    if (!deps.ai) return res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en las variables de entorno.' });
    next();
  };

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ai: Boolean(deps.ai), models: deps.ai?.models ?? [] });
  });

  /**
   * Devuelve NDJSON en streaming: primero la configuración elegida y después
   * los precios reales de cada componente según van llegando.
   */
  app.post('/api/recommend', requireAi, rateLimit(deps.recommendPerHour ?? 15), async (req, res) => {
    const input = parseRecommendBody(req.body);
    const ctrl = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) ctrl.abort(new Error('cliente desconectado'));
    });

    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx: no bufferizar
    res.flushHeaders();
    const send = (ev: StreamEvent) => {
      if (!res.writableEnded) res.write(`${JSON.stringify(ev)}\n`);
    };

    try {
      send({ type: 'status', message: 'Consultando el mercado actual con Google…' });
      const build: Build = await recommendBuild(input, { ai: deps.ai!, fetchFn: deps.fetchFn, now: deps.now }, ctrl.signal);
      send({ type: 'build', build });
      send({ type: 'status', message: 'Buscando precios reales en tiendas…' });

      await mapLimit(build.components, concurrency, async (c) => {
        if (ctrl.signal.aborted) return;
        let result: PriceResult;
        try {
          result = await lookupPrices(c, { ai: deps.ai!, fetchFn: deps.fetchFn, now: deps.now, cache }, { signal: ctrl.signal });
        } catch (err) {
          if (ctrl.signal.aborted) return;
          console.error(`[prices] ${c.name}:`, err);
          result = { offers: [], checkedAt: new Date().toISOString(), queries: [], fromCache: false, error: friendlyAiError(err) };
        }
        send({ type: 'prices', componentId: c.id, result });
      });
      send({ type: 'done' });
    } catch (err) {
      if (!ctrl.signal.aborted) {
        console.error('[recommend]', err);
        send({ type: 'error', error: friendlyAiError(err) });
      }
    } finally {
      res.end();
    }
  });

  /** Vuelve a consultar los precios de un componente (botón "Actualizar"). */
  app.post('/api/prices', requireAi, rateLimit(deps.pricesPerHour ?? 60), async (req, res) => {
    const type = req.body?.type as ComponentType;
    const name = text(req.body?.name, 200).trim();
    if (!COMPONENT_TYPES.includes(type) || !name) return res.status(400).json({ error: 'Componente no válido.' });
    const q: PriceQuery = {
      type,
      name,
      searchQuery: text(req.body?.searchQuery, 200) || name,
      estimatedPrice: Number(req.body?.estimatedPrice) || 0,
    };
    try {
      const result = await lookupPrices(q, { ai: deps.ai!, fetchFn: deps.fetchFn, now: deps.now, cache }, { force: Boolean(req.body?.force) });
      res.json(result);
    } catch (err) {
      console.error('[prices]', err);
      res.status(502).json({ error: friendlyAiError(err) });
    }
  });

  return app;
}
