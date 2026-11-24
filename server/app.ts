import express, { type NextFunction, type Request, type Response } from 'express';
import type { RecommendRequest } from '../shared/types';
import { CATALOG, CATALOG_BY_ID, type CatalogItem } from './catalog';
import { recommend } from './engine';
import type { PriceService } from './priceService';

export interface AppDeps {
  prices: PriceService;
  catalog?: CatalogItem[];
  now?: () => Date;
  /** Límite de "Actualizar precios" por IP y hora (0 = sin límite). */
  refreshPerHour?: number;
}

/** Límite sencillo por IP (ventana deslizante en memoria) para no saturar a las tiendas. */
function rateLimit(perHour: number) {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    if (perHour <= 0) return next();
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    const recent = (hits.get(key) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= perHour) {
      const retryMin = Math.ceil((3_600_000 - (now - recent[0])) / 60_000);
      return res.status(429).json({ error: `Has actualizado muchos precios seguidos. Vuelve a intentarlo en ${retryMin} min.` });
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.delete(hits.keys().next().value!);
    next();
  };
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

function parseRecommendBody(body: any): RecommendRequest {
  const color = body?.color;
  return {
    deviceType: body?.deviceType === 'Portátil' ? 'Portátil' : 'Torre',
    useCase: text(body?.useCase, 60),
    budget: text(body?.budget, 40),
    ram: text(body?.ram, 20),
    storage: text(body?.storage, 20),
    vram: text(body?.vram, 20),
    color: color === 'Blanco' || color === 'Negro' ? color : 'Indiferente',
    includePeripherals: Boolean(body?.includePeripherals),
  };
}

export function createApp(deps: AppDeps) {
  const app = express();
  const catalog = deps.catalog ?? CATALOG;
  const byId = deps.catalog ? new Map(catalog.map((i) => [i.id, i])) : CATALOG_BY_ID;
  // Detrás de Nginx Proxy Manager / Docker: confiamos solo en proxies de red privada.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/status', (_req, res) => {
    res.json(deps.prices.status());
  });

  /** Diagnóstico del catálogo: precios por producto y fallos por tienda. */
  app.get('/api/diagnostico', (_req, res) => {
    res.json(deps.prices.report());
  });

  /** Configuración recomendada con los precios ya comprobados en las tiendas. */
  app.post('/api/recommend', (req, res) => {
    try {
      const input = parseRecommendBody(req.body);
      res.json(recommend(input, catalog, deps.prices, deps.now?.()));
    } catch (err) {
      res.status(503).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  /** Vuelve a leer ahora mismo las fichas de un producto (botón "Actualizar"). */
  app.post('/api/prices/refresh', rateLimit(deps.refreshPerHour ?? 30), async (req, res) => {
    const item = byId.get(text(req.body?.catalogId, 80));
    if (!item) return res.status(400).json({ error: 'Producto no válido.' });
    try {
      await deps.prices.refreshItem(item);
      const url = text(req.body?.url, 500);
      // Portátiles: cada URL es un modelo distinto, devolvemos solo el suyo.
      const result = item.type === 'laptop' && url ? { offers: deps.prices.allBuyable(item.id).filter((o) => o.url === url) } : deps.prices.getPrices(item.id);
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return app;
}
