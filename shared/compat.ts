import type { BuildComponent, ComponentType, Offer } from './types';

export type CheckStatus = 'ok' | 'warn' | 'fail' | 'unknown';

export interface CompatCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

const norm = (s?: string) =>
  (s ?? '')
    .toUpperCase()
    .replace(/SOCKET/g, '')
    .replace(/[\s_-]+/g, '')
    .trim();

const ddr = (s?: string) => s?.toUpperCase().match(/DDR\s?(\d)/)?.[1];

const FORM_FACTOR_RANK: Array<[RegExp, number, string]> = [
  [/E-?ATX|EXTENDED/i, 4, 'E-ATX'],
  [/MINI[\s-]?ITX|\bITX\b/i, 1, 'Mini-ITX'],
  [/MICRO[\s-]?ATX|M-?ATX|µATX|UATX/i, 2, 'Micro-ATX'],
  [/ATX/i, 3, 'ATX'],
];

/**
 * Clasifica un formato. Una caja puede venir como lista ("ATX, Micro-ATX, Mini-ITX"):
 * con mode 'max' nos quedamos con el mayor que admite; una placa usa 'first'.
 */
export function formFactorRank(s: string | undefined, mode: 'first' | 'max' = 'first'): { rank: number; label: string } | null {
  if (!s) return null;
  const found = s
    .split(/[,;/|]|\s+y\s+|\s+o\s+/i)
    .map((token) => FORM_FACTOR_RANK.find(([re]) => re.test(token)))
    .filter((m): m is [RegExp, number, string] => Boolean(m))
    .map(([, rank, label]) => ({ rank, label }));
  if (!found.length) return null;
  return mode === 'first' ? found[0] : found.reduce((a, b) => (b.rank > a.rank ? b : a));
}

function first(components: BuildComponent[], type: ComponentType) {
  return components.find((c) => c.type === type);
}

/**
 * Comprobaciones de compatibilidad calculadas a partir de las especificaciones
 * de cada componente (no es un porcentaje inventado: cada check dice qué ha mirado).
 */
export function checkCompatibility(components: BuildComponent[]): CompatCheck[] {
  const cpu = first(components, 'cpu');
  const mb = first(components, 'motherboard');
  const ram = first(components, 'ram');
  const gpu = first(components, 'gpu');
  const psu = first(components, 'psu');
  const pcCase = first(components, 'case');
  const cooler = first(components, 'cooler');

  // Solo tiene sentido en montajes de sobremesa.
  if (!cpu && !mb && !gpu && !psu) return [];

  const checks: CompatCheck[] = [];

  // 1. Socket CPU ↔ placa
  if (cpu && mb) {
    const a = norm(cpu.specs.socket);
    const b = norm(mb.specs.socket);
    if (!a || !b) {
      checks.push({ id: 'socket', label: 'Socket CPU ↔ placa', status: 'unknown', detail: 'Falta el socket de alguno de los dos componentes.' });
    } else if (a === b) {
      checks.push({ id: 'socket', label: 'Socket CPU ↔ placa', status: 'ok', detail: `Ambos usan ${cpu.specs.socket}.` });
    } else {
      checks.push({ id: 'socket', label: 'Socket CPU ↔ placa', status: 'fail', detail: `La CPU es ${cpu.specs.socket} y la placa ${mb.specs.socket}.` });
    }
  }

  // 2. Tipo de memoria RAM ↔ placa
  if (ram && mb) {
    const a = ddr(ram.specs.memoryType);
    const b = ddr(mb.specs.memoryType);
    if (!a || !b) {
      checks.push({ id: 'memory', label: 'RAM ↔ placa', status: 'unknown', detail: 'Falta el tipo de memoria de la RAM o de la placa.' });
    } else if (a === b) {
      checks.push({ id: 'memory', label: 'RAM ↔ placa', status: 'ok', detail: `Las dos son DDR${a}.` });
    } else {
      checks.push({ id: 'memory', label: 'RAM ↔ placa', status: 'fail', detail: `La RAM es DDR${a} y la placa admite DDR${b}.` });
    }
  }

  // 3. Potencia de la fuente
  if (psu) {
    const watts = psu.specs.psuWatts;
    const cpuW = cpu?.specs.tdpW ?? 0;
    const gpuW = gpu?.specs.tdpW ?? 0;
    if (!watts || (!cpuW && !gpuW)) {
      checks.push({ id: 'psu', label: 'Potencia de la fuente', status: 'unknown', detail: 'Faltan los vatios de la fuente o el consumo de CPU/GPU.' });
    } else {
      const draw = cpuW + gpuW + 75; // placa, RAM, discos y ventiladores
      const recommended = Math.ceil((draw * 1.3) / 50) * 50;
      if (watts >= recommended) {
        checks.push({ id: 'psu', label: 'Potencia de la fuente', status: 'ok', detail: `${watts} W para un consumo estimado de ~${draw} W (recomendado ≥ ${recommended} W).` });
      } else if (watts >= draw) {
        checks.push({ id: 'psu', label: 'Potencia de la fuente', status: 'warn', detail: `${watts} W va justa para ~${draw} W de consumo; mejor ≥ ${recommended} W.` });
      } else {
        checks.push({ id: 'psu', label: 'Potencia de la fuente', status: 'fail', detail: `${watts} W no llega al consumo estimado de ~${draw} W.` });
      }
    }
  }

  // 4. Formato placa ↔ caja
  if (mb && pcCase) {
    const a = formFactorRank(mb.specs.formFactor, 'first');
    const b = formFactorRank(pcCase.specs.formFactor, 'max');
    if (!a || !b) {
      checks.push({ id: 'formfactor', label: 'Placa ↔ caja', status: 'unknown', detail: 'Falta el formato de la placa o de la caja.' });
    } else if (a.rank <= b.rank) {
      checks.push({ id: 'formfactor', label: 'Placa ↔ caja', status: 'ok', detail: `Placa ${a.label} en caja que admite hasta ${b.label}.` });
    } else {
      checks.push({ id: 'formfactor', label: 'Placa ↔ caja', status: 'fail', detail: `Placa ${a.label} no cabe en una caja ${b.label}.` });
    }
  }

  // 5. Longitud de la gráfica
  if (gpu && pcCase && gpu.specs.gpuLengthMm && pcCase.specs.caseMaxGpuLengthMm) {
    const len = gpu.specs.gpuLengthMm;
    const max = pcCase.specs.caseMaxGpuLengthMm;
    checks.push({
      id: 'gpulength',
      label: 'Gráfica ↔ caja',
      status: len <= max - 10 ? 'ok' : len <= max ? 'warn' : 'fail',
      detail: `La gráfica mide ${len} mm y la caja admite ${max} mm.`,
    });
  }

  // 6. Refrigeración
  if (cpu && !cooler) {
    checks.push({ id: 'cooler', label: 'Refrigeración CPU', status: 'warn', detail: 'No hay disipador en la lista: comprueba si el procesador lo incluye.' });
  }

  return checks;
}

/* ------------------------------------------------------------------ */
/* Precios y presupuesto                                                */
/* ------------------------------------------------------------------ */

/** Mejor oferta: la más barata con stock (o sin dato de stock); si no, la más barata. */
export function bestOffer(offers: Offer[] | undefined): Offer | undefined {
  if (!offers?.length) return undefined;
  const available = offers.filter((o) => o.inStock !== false);
  const pool = available.length ? available : offers;
  return pool.reduce((min, o) => (o.price < min.price ? o : min));
}

export interface BudgetRange {
  min?: number;
  max?: number;
}

export function parseBudget(budget: string): BudgetRange {
  const nums = (budget.match(/\d[\d.]*/g) ?? []).map((n) => Number(n.replace(/\./g, '')));
  if (budget.includes('<') && nums[0]) return { max: nums[0] };
  if (budget.includes('>') && nums[0]) return { min: nums[0] };
  if (nums.length >= 2) return { min: nums[0], max: nums[1] };
  return {};
}
