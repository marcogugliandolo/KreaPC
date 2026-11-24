import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createApp } from './server/app';
import { CATALOG } from './server/catalog';
import { PriceService } from './server/priceService';

dotenv.config();

const envNumber = (name: string, fallback: number) => {
  const raw = process.env[name];
  const n = Number(raw);
  return raw !== undefined && raw !== '' && Number.isFinite(n) ? n : fallback;
};

async function startServer() {
  const prices = new PriceService(CATALOG, {
    refreshHours: envNumber('PRICE_REFRESH_HOURS', 6),
    discoveryHours: envNumber('PRICE_DISCOVERY_HOURS', 24),
    maxAgeHours: envNumber('PRICE_MAX_AGE_HOURS', 48),
    hostDelayMs: envNumber('STORE_DELAY_MS', 1500),
    file: process.env.PRICES_FILE || path.join(process.cwd(), 'data', 'prices.json'),
    log: (msg) => console.log(msg),
  });

  const app = createApp({ prices, refreshPerHour: envNumber('RATE_LIMIT_REFRESH_PER_HOUR', 30) });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  const port = envNumber('PORT', 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`KreaPC en http://localhost:${port} · consultando precios de ${CATALOG.length} productos en segundo plano`);
  });
  await prices.start();
}

startServer();
