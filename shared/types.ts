/**
 * Tipos compartidos entre el servidor (Express) y el cliente (React).
 */

export type DeviceType = 'Torre' | 'Portátil';
export type ColorPref = 'Indiferente' | 'Negro' | 'Blanco';

export const COMPONENT_TYPES = [
  'cpu',
  'gpu',
  'motherboard',
  'ram',
  'storage',
  'psu',
  'case',
  'cooler',
  'laptop',
  'monitor',
  'keyboard',
  'mouse',
] as const;

export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const COMPONENT_LABELS: Record<ComponentType, string> = {
  cpu: 'Procesador',
  gpu: 'Tarjeta gráfica',
  motherboard: 'Placa base',
  ram: 'Memoria RAM',
  storage: 'Almacenamiento',
  psu: 'Fuente de alimentación',
  case: 'Caja',
  cooler: 'Refrigeración',
  laptop: 'Portátil',
  monitor: 'Monitor',
  keyboard: 'Teclado',
  mouse: 'Ratón',
};

/** Especificaciones que usamos para comprobar compatibilidad. */
export interface ComponentSpecs {
  /** Socket de CPU / placa (p. ej. "AM5", "LGA1851"). */
  socket?: string;
  /** Tipo de memoria (DDR4 / DDR5) que usa la RAM o admite la placa. */
  memoryType?: string;
  /** Formato de placa (ATX, Micro-ATX…) o formatos que admite la caja. */
  formFactor?: string;
  /** Consumo máximo de la CPU o consumo típico (TBP) de la GPU, en vatios. */
  tdpW?: number;
  /** Potencia de la fuente, en vatios. */
  psuWatts?: number;
  /** Longitud de la gráfica, en mm. */
  gpuLengthMm?: number;
  /** Longitud máxima de gráfica que admite la caja, en mm. */
  caseMaxGpuLengthMm?: number;
  /** Resumen corto de especificaciones clave. */
  summary?: string;
}

export interface BuildComponent {
  /** Identificador dentro de la configuración. */
  id: string;
  /** Producto del catálogo del que sale (para volver a consultar precios). */
  catalogId: string;
  type: ComponentType;
  name: string;
  searchQuery: string;
  reason?: string;
  /** Dato de rendimiento con su fuente, si lo hay (p. ej. "58 % de una RTX 5090 a 1440p"). */
  perfNote?: string;
  specs: ComponentSpecs;
}

/** Precio leído de la ficha del producto en la tienda (schema.org / JSON-LD). */
export interface Offer {
  storeId: string;
  store: string;
  url: string;
  price: number;
  currency: 'EUR';
  /** null = la tienda no indica stock */
  inStock: boolean | null;
  /** Nombre del producto tal y como aparece en la tienda. */
  title?: string;
  checkedAt: string;
}

export interface PriceResult {
  offers: Offer[];
  /** Última vez que se consultó este producto en las tiendas. */
  checkedAt?: string;
  error?: string;
}

export interface Build {
  deviceType: DeviceType;
  useCase: string;
  budget: string;
  explanation: string;
  components: BuildComponent[];
  /** Avisos importantes (presupuesto insuficiente, datos que faltan…). */
  warnings: string[];
  /** Total de la configuración con el mejor precio de cada pieza. */
  total: number;
  overBudget: boolean;
  generatedAt: string;
}

export interface RecommendRequest {
  deviceType: DeviceType;
  useCase: string;
  budget: string;
  ram?: string;
  storage?: string;
  vram?: string;
  color?: ColorPref;
  includePeripherals?: boolean;
}

export interface RecommendResponse {
  build: Build;
  prices: Record<string, PriceResult>;
}

export interface PriceStatus {
  ready: boolean;
  refreshing: boolean;
  lastRefresh?: string;
  progress: { done: number; total: number };
  items: number;
  itemsWithPrice: number;
}
