/**
 * Motor de recomendación por reglas, sin IA: prueba todas las combinaciones de CPU y GPU
 * del catálogo, completa cada una con las piezas compatibles más baratas que tienen precio
 * real ahora mismo y se queda con la de más rendimiento para el uso elegido que cabe en el
 * presupuesto.
 */
import { formFactorRank, parseBudget } from '../shared/compat';
import type { Build, BuildComponent, ComponentType, Offer, PriceResult, RecommendRequest, RecommendResponse } from '../shared/types';
import { COMPONENT_LABELS } from '../shared/types';
import { gpuGamingScore, PERF_SOURCE, type CatalogItem } from './catalog';
import { laptopRamGB } from './matching';

export interface PriceSource {
  /** Mejor oferta comprable por tienda. */
  buyable(itemId: string): Offer[];
  /** Todas las ofertas comprables (portátiles: cada URL es un modelo distinto). */
  allBuyable(itemId: string): Offer[];
}

interface Priced {
  item: CatalogItem;
  offer: Offer;
  price: number;
}

type UseCase = 'Gaming' | 'Productividad' | 'Creación' | 'Desarrollo';

const pct = (n: number | undefined) => `${(n ?? 0).toLocaleString('es-ES')} %`;
const eur = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function useCaseOf(s: string): UseCase {
  return (['Gaming', 'Productividad', 'Creación', 'Desarrollo'] as const).find((u) => u === s) ?? 'Gaming';
}

function prefGB(s: string | undefined): number | undefined {
  const m = s?.match(/(\d+)\s*(GB|TB)/i);
  if (!m) return undefined;
  return m[2].toUpperCase() === 'TB' ? Number(m[1]) * 1000 : Number(m[1]);
}

export function budgetRange(budget: string): { min: number; max: number } {
  const r = parseBudget(budget);
  const min = r.min ?? 0;
  return { min, max: r.max ?? Math.max(min * 2, 3000) };
}

function priced(catalog: CatalogItem[], prices: PriceSource, type: ComponentType): Priced[] {
  const out: Priced[] = [];
  for (const item of catalog) {
    if (item.type !== type) continue;
    const offers = prices.buyable(item.id);
    if (!offers.length) continue;
    const offer = offers.reduce((a, b) => (b.price < a.price ? b : a));
    out.push({ item, offer, price: offer.price });
  }
  return out.sort((a, b) => a.price - b.price);
}

/** La más barata que cumple; con preferencia de color si la hay. */
function cheapest(list: Priced[], ok: (p: Priced) => boolean, color: RecommendRequest['color']): Priced | undefined {
  const pool = list.filter(ok);
  if (color === 'Blanco') return pool.find((p) => p.item.color === 'blanco') ?? pool[0];
  if (color === 'Negro') return pool.find((p) => p.item.color !== 'blanco') ?? pool[0];
  return pool[0];
}

function score(useCase: UseCase, cpu: CatalogItem, gpu: CatalogItem | null): number {
  const g = gpu ? gpuGamingScore(gpu) : 0;
  const cg = cpu.perf?.gaming ?? 50;
  const cm = cpu.perf?.multi ?? 30;
  const cs = cpu.perf?.single ?? 70;
  switch (useCase) {
    case 'Gaming':
      return g * (0.7 + (0.3 * cg) / 100);
    case 'Creación':
      return 0.5 * cm + 0.5 * g;
    case 'Desarrollo':
      return 0.65 * cm + 0.35 * cs;
    default:
      return 0.5 * cm + 0.5 * cs;
  }
}

function perfNote(item: CatalogItem): string | undefined {
  if (item.type === 'cpu' && item.perf) {
    return `${pct(item.perf.gaming)} en juegos · ${pct(item.perf.multi)} multinúcleo (respecto al mejor, ${PERF_SOURCE})`;
  }
  if (item.type === 'gpu' && item.perf?.raster1440) {
    return `${pct(item.perf.raster1440)} del rendimiento de una RTX 5090 a 1440p (${PERF_SOURCE})`;
  }
  return undefined;
}

function toComponent(p: Priced, id: string): BuildComponent {
  return {
    id,
    catalogId: p.item.id,
    type: p.item.type,
    name: p.item.name,
    searchQuery: p.item.query,
    reason: p.item.reason,
    perfNote: perfNote(p.item),
    specs: p.item.specs,
  };
}

/* -------------------------------------------------------------------------- */

interface Candidate {
  parts: Priced[];
  total: number;
  score: number;
  cpu: Priced;
  gpu: Priced | null;
  /** Avisos si alguna pieza no llega a lo pedido porque no hay otra con precio. */
  notes: string[];
}

/** La más barata con al menos `min` GB; si no hay ninguna, la de más capacidad disponible. */
function atLeast(list: Priced[], ok: (p: Priced) => boolean, min: number, color: RecommendRequest['color']): { pick?: Priced; short: boolean } {
  const pick = cheapest(list, (p) => ok(p) && (p.item.capacityGB ?? 0) >= min, color);
  if (pick) return { pick, short: false };
  const pool = list.filter(ok);
  if (!pool.length) return { short: false };
  return { pick: pool.reduce((a, b) => ((b.item.capacityGB ?? 0) > (a.item.capacityGB ?? 0) || ((b.item.capacityGB ?? 0) === (a.item.capacityGB ?? 0) && b.price < a.price) ? b : a)), short: true };
}

const gbLabel = (gb: number) => (gb >= 1000 ? `${gb / 1000} TB` : `${gb} GB`);

function pickPeripherals(catalog: CatalogItem[], prices: PriceSource, max: number, missing: Set<ComponentType>): Priced[] {
  const out: Priced[] = [];
  for (const type of ['monitor', 'keyboard', 'mouse'] as const) {
    const list = priced(catalog, prices, type);
    if (!list.length) {
      missing.add(type);
      continue;
    }
    // Presupuestos altos: el de más gama; si no, el más barato.
    const pick = max >= 2500 ? list.reduce((a, b) => ((b.item.tier ?? 0) > (a.item.tier ?? 0) ? b : a)) : list[0];
    out.push(pick);
  }
  return out;
}

function recommendDesktop(input: RecommendRequest, catalog: CatalogItem[], prices: PriceSource): { parts: Priced[]; total: number; overBudget: boolean; warnings: string[]; explanation: string } {
  const useCase = useCaseOf(input.useCase);
  const range = budgetRange(input.budget);
  const color = input.color ?? 'Indiferente';
  const warnings: string[] = [];
  const missing = new Set<ComponentType>();

  const ramMin = prefGB(input.ram) ?? (useCase === 'Creación' || (useCase === 'Desarrollo' && range.max > 1000) || range.max >= 2000 ? 32 : 16);
  const storageMin = prefGB(input.storage) ?? ({ Gaming: 1000, Creación: 2000, Productividad: 500, Desarrollo: 1000 } as const)[useCase];
  const vramMin = prefGB(input.vram) ?? 0;
  const needsGpu = useCase === 'Gaming' || useCase === 'Creación' || vramMin > 0;

  const peripherals = input.includePeripherals ? pickPeripherals(catalog, prices, range.max, missing) : [];
  const peripheralsTotal = peripherals.reduce((s, p) => s + p.price, 0);
  const towerMax = range.max - peripheralsTotal;

  const lists = {
    cpu: priced(catalog, prices, 'cpu'),
    gpu: priced(catalog, prices, 'gpu').filter((g) => (g.item.vramGB ?? 0) >= vramMin),
    motherboard: priced(catalog, prices, 'motherboard'),
    ram: priced(catalog, prices, 'ram'),
    storage: priced(catalog, prices, 'storage'),
    psu: priced(catalog, prices, 'psu'),
    case: priced(catalog, prices, 'case'),
    cooler: priced(catalog, prices, 'cooler'),
  };

  const candidates: Candidate[] = [];
  for (const cpu of lists.cpu) {
    const gpuOptions: Array<Priced | null> = needsGpu ? lists.gpu : cpu.item.igpu ? [null] : lists.gpu.slice(0, 1);
    if (!gpuOptions.length) missing.add('gpu');
    for (const gpu of gpuOptions) {
      const board = cheapest(lists.motherboard, (b) => b.item.specs.socket === cpu.item.specs.socket, color);
      if (!board) {
        missing.add('motherboard');
        continue;
      }
      const ramPick = atLeast(lists.ram, (r) => r.item.specs.memoryType === board.item.specs.memoryType, ramMin, color);
      const storagePick = atLeast(lists.storage, () => true, storageMin, color);
      const ram = ramPick.pick;
      const storage = storagePick.pick;
      const notes: string[] = [];
      if (ram && ramPick.short) notes.push(`No hay ahora mismo memoria de ${ramMin} GB con precio comprobado; se ha puesto ${gbLabel(ram.item.capacityGB ?? 0)}.`);
      if (storage && storagePick.short) notes.push(`No hay ahora mismo un SSD de ${gbLabel(storageMin)} con precio comprobado; se ha puesto uno de ${gbLabel(storage.item.capacityGB ?? 0)}.`);
      const draw = (cpu.item.specs.tdpW ?? 150) + (gpu?.item.specs.tdpW ?? 0) + 75;
      const psuNeed = Math.ceil((draw * 1.3) / 50) * 50;
      const psu = cheapest(lists.psu, (p) => (p.item.specs.psuWatts ?? 0) >= psuNeed, color);
      const boardFF = formFactorRank(board.item.specs.formFactor, 'first')?.rank ?? 3;
      const pcCase = cheapest(lists.case, (c) => (formFactorRank(c.item.specs.formFactor, 'max')?.rank ?? 0) >= boardFF, color);
      const cooler = cheapest(lists.cooler, (c) => (c.item.coolerRatingW ?? 0) >= (cpu.item.specs.tdpW ?? 0), color);

      const parts = { ram, storage, psu, case: pcCase, cooler };
      const lacking = (Object.keys(parts) as Array<keyof typeof parts>).filter((k) => !parts[k]);
      if (lacking.length) {
        lacking.forEach((k) => missing.add(k));
        continue;
      }
      const all = [cpu, gpu, board, ram!, storage!, psu!, pcCase!, cooler!].filter((p): p is Priced => Boolean(p));
      candidates.push({
        parts: all,
        total: all.reduce((s, p) => s + p.price, 0),
        score: score(useCase, cpu.item, gpu?.item ?? null),
        cpu,
        gpu,
        notes,
      });
    }
  }

  if (!candidates.length) {
    const names = [...missing].map((t) => COMPONENT_LABELS[t].toLowerCase());
    if (!lists.cpu.length) names.unshift('procesadores');
    throw new Error(
      `Ahora mismo no hay precios comprobados de: ${[...new Set(names)].join(', ') || 'algunos componentes'}. ` +
        'Puede que la lectura de precios aún no haya terminado o que las tiendas que los venden no dejen consultarlos.',
    );
  }

  const fitting = candidates.filter((c) => c.total <= towerMax);
  let chosen: Candidate;
  let overBudget = false;
  if (fitting.length) {
    const top = Math.max(...fitting.map((c) => c.score));
    // Si otra opción da al menos el 97 % del rendimiento por menos dinero, mejor esa.
    chosen = fitting.filter((c) => c.score >= top * 0.97).reduce((a, b) => (b.total < a.total ? b : a));
  } else {
    chosen = candidates.reduce((a, b) => (b.total < a.total ? b : a));
    overBudget = true;
  }

  // Con dinero de sobra: más RAM y más almacenamiento.
  let parts = [...chosen.parts];
  let total = chosen.total;
  if (!overBudget) {
    const swap = (type: ComponentType, ok: (p: Priced) => boolean) => {
      const idx = parts.findIndex((p) => p.item.type === type);
      if (idx === -1) return;
      const current = parts[idx];
      const better = cheapest(lists[type as keyof typeof lists] as Priced[], (p) => ok(p) && p.price > current.price, color);
      if (better && total - current.price + better.price <= towerMax) {
        total += better.price - current.price;
        parts[idx] = better;
      }
    };
    const ramNow = parts.find((p) => p.item.type === 'ram')!;
    if (useCase !== 'Productividad' && (ramNow.item.capacityGB ?? 0) < 32 && !input.ram?.match(/\d/)) {
      swap('ram', (p) => p.item.specs.memoryType === ramNow.item.specs.memoryType && (p.item.capacityGB ?? 0) === 32);
    }
    const ssdNow = parts.find((p) => p.item.type === 'storage')!;
    if ((useCase === 'Gaming' || useCase === 'Creación') && (ssdNow.item.capacityGB ?? 0) < 2000 && !input.storage?.match(/\d/)) {
      swap('storage', (p) => (p.item.capacityGB ?? 0) === 2000);
    }
  }

  parts = [...parts, ...peripherals];
  total = Math.round((total + peripheralsTotal) * 100) / 100;

  // Explicación con los datos reales usados.
  const cpu = chosen.cpu.item;
  const gpu = chosen.gpu?.item;
  const lines = [
    overBudget
      ? `Para ${useCase.toLowerCase()}, con los precios de hoy no hay ninguna configuración completa dentro de ${input.budget || 'ese presupuesto'}: esta es la más económica posible.`
      : `Para ${useCase.toLowerCase()} con un presupuesto de ${input.budget || 'sin límite'}, esta es la combinación con más rendimiento que cabe con los precios de hoy en las tiendas.`,
  ];
  if (useCase === 'Gaming' && gpu) {
    lines.push(
      `La ${gpu.name} rinde un ${pct(gpu.perf?.raster1440)} de una RTX 5090 a 1440p y el ${cpu.name} llega al ${pct(cpu.perf?.gaming)} del procesador más rápido en juegos (${PERF_SOURCE}).`,
    );
  } else if (useCase === 'Creación' && gpu) {
    lines.push(`El ${cpu.name} da el ${pct(cpu.perf?.multi)} del mejor rendimiento multinúcleo de la tabla y la ${gpu.name} acelera render y edición (${PERF_SOURCE}).`);
  } else {
    lines.push(
      `El ${cpu.name} da el ${pct(cpu.perf?.multi)} del mejor rendimiento multinúcleo y el ${pct(cpu.perf?.single)} en un solo núcleo (${PERF_SOURCE})` +
        (gpu ? '.' : '; no hace falta gráfica dedicada porque tiene gráficos integrados.'),
    );
  }
  lines.push(`Total con el mejor precio de cada pieza: ${eur(total)}.`);

  if (overBudget) {
    warnings.push(`Con los precios actuales no hay ninguna configuración completa por debajo de ${eur(range.max)}. La más económica posible cuesta ${eur(total)}.`);
  }
  warnings.push(...chosen.notes);
  const ramPart = parts.find((p) => p.item.type === 'ram');
  if (ramPart && ramPart.price / total > 0.25) {
    warnings.push(`La memoria RAM supone el ${Math.round((ramPart.price / total) * 100)} % del total: sus precios siguen muy altos por la escasez de DRAM.`);
  }
  if (missing.has('monitor') || missing.has('keyboard') || missing.has('mouse')) {
    warnings.push('Algunos periféricos no tienen precio comprobado ahora mismo y no se han incluido.');
  }

  return { parts, total, overBudget, warnings, explanation: lines.join(' ') };
}

function recommendLaptops(input: RecommendRequest, catalog: CatalogItem[], prices: PriceSource) {
  const useCase = useCaseOf(input.useCase);
  const range = budgetRange(input.budget);
  const missing = new Set<ComponentType>();
  const peripherals = input.includePeripherals ? pickPeripherals(catalog, prices, range.max, missing) : [];
  const peripheralsTotal = peripherals.reduce((s, p) => s + p.price, 0);
  const max = range.max - peripheralsTotal;
  const ramMin = prefGB(input.ram) ?? (useCase === 'Creación' ? 32 : 16);
  const gamingLike = useCase === 'Gaming' || useCase === 'Creación';

  const options: Array<Priced & { score: number }> = [];
  for (const item of catalog) {
    if (item.type !== 'laptop') continue;
    for (const offer of prices.allBuyable(item.id)) {
      const ram = laptopRamGB(offer.title ?? '') ?? 16;
      if (ram < ramMin) continue;
      const tier = item.tier ?? 0;
      const s = gamingLike ? tier * 100 + Math.min(ram, 32) : Math.min(ram, 32) * 3 + tier * 5;
      options.push({ item, offer, price: offer.price, score: s });
    }
  }
  if (!options.length) {
    throw new Error(
      'Ahora mismo no hay portátiles con precio comprobado que cumplan lo pedido: las tiendas que los venden no dejan consultar sus precios desde el servidor. Prueba con Torre.',
    );
  }

  const fitting = options.filter((o) => o.price <= max);
  const warnings: string[] = [];
  let picks: Array<Priced & { score: number }>;
  let overBudget = false;
  if (fitting.length) {
    const top = Math.max(...fitting.map((o) => o.score));
    const first = fitting.filter((o) => o.score >= top * 0.97).reduce((a, b) => (b.price < a.price ? b : a));
    const rest = fitting
      .filter((o) => o.offer.url !== first.offer.url && o.offer.title !== first.offer.title)
      .sort((a, b) => b.score - a.score || a.price - b.price);
    const alts: typeof rest = [];
    for (const o of rest) {
      if (alts.length >= 2) break;
      if (!alts.some((a) => a.offer.title === o.offer.title)) alts.push(o);
    }
    picks = [first, ...alts];
  } else {
    picks = [options.reduce((a, b) => (b.price < a.price ? b : a))];
    overBudget = true;
    warnings.push(`No hay portátiles con precio comprobado por debajo de ${eur(max)} que cumplan lo pedido. El más económico cuesta ${eur(picks[0].price)}.`);
  }

  const total = Math.round((picks[0].price + peripheralsTotal) * 100) / 100;
  const explanation =
    `Para ${useCase.toLowerCase()} con un presupuesto de ${input.budget || 'sin límite'}, ` +
    (gamingLike
      ? 'se prioriza la gráfica más potente que cabe y después la memoria RAM.'
      : 'se prioriza la memoria RAM y el precio; una gráfica dedicada no es necesaria.') +
    ` El primero es la opción elegida (${eur(picks[0].price)}); los demás son alternativas que no suman en el total.`;
  return { picks, peripherals, total, overBudget, warnings, explanation };
}

export function recommend(input: RecommendRequest, catalog: CatalogItem[], prices: PriceSource, now = new Date()): RecommendResponse {
  const base = { deviceType: input.deviceType, useCase: input.useCase, budget: input.budget, generatedAt: now.toISOString() };
  const priceMap: Record<string, PriceResult> = {};

  if (input.deviceType === 'Portátil') {
    const r = recommendLaptops(input, catalog, prices);
    const components: BuildComponent[] = [];
    r.picks.forEach((p, i) => {
      const id = `laptop-${i + 1}`;
      components.push({ ...toComponent(p, id), name: p.offer.title ?? p.item.name });
      priceMap[id] = { offers: [p.offer], checkedAt: p.offer.checkedAt };
    });
    for (const p of r.peripherals) {
      components.push(toComponent(p, p.item.type));
      priceMap[p.item.type] = { offers: prices.buyable(p.item.id), checkedAt: p.offer.checkedAt };
    }
    return { build: { ...base, components, explanation: r.explanation, warnings: r.warnings, total: r.total, overBudget: r.overBudget }, prices: priceMap };
  }

  const r = recommendDesktop(input, catalog, prices);
  const components = r.parts.map((p) => {
    priceMap[p.item.type] = { offers: prices.buyable(p.item.id), checkedAt: p.offer.checkedAt };
    return toComponent(p, p.item.type);
  });
  return { build: { ...base, components, explanation: r.explanation, warnings: r.warnings, total: r.total, overBudget: r.overBudget }, prices: priceMap };
}
