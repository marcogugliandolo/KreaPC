/**
 * Tipos compartidos entre el servidor (Express) y el cliente (React).
 */

export type DeviceType = 'Torre' | 'Portátil';

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

/** Especificaciones mínimas que usamos para comprobar compatibilidad. */
export interface ComponentSpecs {
  /** Socket de CPU / placa (p. ej. "AM5", "LGA1851"). */
  socket?: string;
  /** Tipo de memoria (DDR4 / DDR5) que usa la RAM o admite la placa. */
  memoryType?: string;
  /** Formato de placa (ATX, Micro-ATX, Mini-ITX) o formato máximo que admite la caja. */
  formFactor?: string;
  /** TDP de la CPU o consumo típico (TBP) de la GPU, en vatios. */
  tdpW?: number;
  /** Potencia de la fuente, en vatios. */
  psuWatts?: number;
  /** Longitud de la gráfica, en mm. */
  gpuLengthMm?: number;
  /** Longitud máxima de gráfica que admite la caja, en mm. */
  caseMaxGpuLengthMm?: number;
  /** Resumen corto de especificaciones clave para mostrar. */
  summary?: string;
}

export interface BuildComponent {
  id: string;
  type: ComponentType;
  name: string;
  /** Término limpio para buscar el producto en tiendas. */
  searchQuery: string;
  /** Estimación de la IA (solo orientativa; el precio real viene de las tiendas). */
  estimatedPrice: number;
  reason?: string;
  specs: ComponentSpecs;
}

/**
 * verified: precio leído ahora mismo de la ficha del producto en la tienda.
 * google:   precio que aparece en los resultados de Google para esa ficha
 *           (la tienda no deja leer la página desde el servidor).
 */
export type OfferStatus = 'verified' | 'google';

export interface Offer {
  storeId: string;
  store: string;
  url: string;
  price: number;
  currency: 'EUR';
  /** null = desconocido */
  inStock: boolean | null;
  status: OfferStatus;
  /** Nombre del producto tal y como aparece en la tienda (si se pudo leer). */
  title?: string;
  checkedAt: string;
}

export interface SourceLink {
  title: string;
  url: string;
}

export interface PriceResult {
  offers: Offer[];
  checkedAt: string;
  /** HTML/CSS de las "Sugerencias de búsqueda" de Google (obligatorio mostrarlas). */
  searchSuggestionsHtml?: string;
  queries: string[];
  fromCache: boolean;
  error?: string;
}

export interface Build {
  deviceType: DeviceType;
  useCase: string;
  budget: string;
  explanation: string;
  components: BuildComponent[];
  searchSuggestionsHtml?: string;
  sources: SourceLink[];
  generatedAt: string;
  model: string;
}

export interface RecommendRequest {
  deviceType: DeviceType;
  useCase: string;
  budget: string;
  ram?: string;
  storage?: string;
  vram?: string;
  extraDetails?: string;
  includePeripherals?: boolean;
}

export type StreamEvent =
  | { type: 'status'; message: string }
  | { type: 'build'; build: Build }
  | { type: 'prices'; componentId: string; result: PriceResult }
  | { type: 'done' }
  | { type: 'error'; error: string };
