/**
 * Comprueba el catálogo contra las tiendas reales y muestra qué productos tienen precio,
 * en qué tiendas y qué URLs fallan (404, bloqueos, robots.txt…).
 *
 *   npm run catalog:check            → todo el catálogo
 *   npm run catalog:check gpu-rtx5070 cpu-9800x3d   → solo esos productos
 */
import { CATALOG } from '../server/catalog';
import { PriceService } from '../server/priceService';

const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

async function main() {
  const ids = process.argv.slice(2);
  const items = ids.length ? CATALOG.filter((i) => ids.includes(i.id)) : CATALOG;
  if (!items.length) {
    console.error(`No hay productos con esos ids. Disponibles:\n${CATALOG.map((i) => i.id).join('\n')}`);
    process.exit(1);
  }
  const service = new PriceService(items, { file: null, hostDelayMs: Number(process.env.STORE_DELAY_MS) || 1500 });
  console.log(`Consultando ${items.length} productos (una petición por tienda cada ${(Number(process.env.STORE_DELAY_MS) || 1500) / 1000} s)…\n`);

  const reports = await service.refreshAll();
  let withPrice = 0;
  for (const r of reports) {
    const ok = r.offers.length > 0;
    if (ok) withPrice++;
    console.log(`${ok ? '✔' : '✘'} ${r.id} — ${r.name}`);
    for (const o of r.offers) {
      console.log(`    ${o.store.padEnd(16)} ${eur(o.price).padStart(12)}  ${o.inStock === false ? 'agotado' : o.inStock ? 'en stock' : 'stock ?'}  ${o.url}`);
    }
    for (const [url, reason] of Object.entries(r.failures)) console.log(`    · ${reason}: ${url}`);
  }
  console.log(`\n${withPrice}/${reports.length} productos con precio comprobado.`);
}

main();
