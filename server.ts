import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createApp } from './server/app';
import { createGeminiClient } from './server/gemini';

dotenv.config();

const envNumber = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && process.env[name] !== '' && process.env[name] !== undefined ? n : fallback;
};

async function startServer() {
  const apiKey = process.env.GEMINI_API_KEY;
  // Se prueba el primero; si Google lo retira o no está disponible, el siguiente.
  const models = (process.env.GEMINI_MODEL || 'gemini-3.8-flash,gemini-3.6-flash')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  if (!apiKey) console.warn('⚠️  Falta GEMINI_API_KEY: la web arrancará, pero no podrá generar configuraciones.');

  const app = createApp({
    ai: apiKey ? createGeminiClient(apiKey, models) : null,
    priceConcurrency: envNumber('PRICE_CONCURRENCY', 4),
    priceCacheMinutes: envNumber('PRICE_CACHE_MINUTES', 180),
    recommendPerHour: envNumber('RATE_LIMIT_RECOMMEND_PER_HOUR', 15),
    pricesPerHour: envNumber('RATE_LIMIT_PRICES_PER_HOUR', 60),
  });

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
    console.log(`KreaPC en http://localhost:${port} (modelos: ${models.join(', ')})`);
  });
}

startServer();
