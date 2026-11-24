/**
 * Catálogo de componentes de KreaPC.
 *
 * - `match` / `exclude`: palabras que debe (o no puede) tener el nombre del producto en la
 *   tienda para aceptar su precio. Las que llevan números se buscan dentro del texto
 *   ("7800x3d"), el resto como palabra completa ("ti", "xt").
 * - `seeds`: fichas reales encontradas en las tiendas (noviembre de 2026).
 * - `listings`: páginas de categoría donde aparecen variantes del producto. Las marcadas como
 *   "patrón" siguen el formato de URL de la tienda pero no se han comprobado a mano;
 *   si no existen simplemente no aportan precios (ver `npm run catalog:check`).
 * - Rendimiento: Tom's Hardware, GPU Benchmarks Hierarchy 2026 y CPU Benchmarks Hierarchy 2026
 *   (actualizada en agosto de 2026). GPUs relativas a la RTX 5090; CPUs al Ryzen 7 9850X3D
 *   (juegos) y a la mejor de la tabla (multinúcleo / un núcleo).
 */

import type { ComponentSpecs, ComponentType } from '../shared/types';

export interface CatalogItem {
  id: string;
  type: ComponentType;
  /** Nombre que se muestra. */
  name: string;
  match: string[];
  exclude?: string[];
  /** Exige al menos una de estas palabras (p. ej. el color). */
  anyOf?: string[];
  /** Productos tipo portátil: el nombre debe indicar que es un portátil. */
  laptop?: boolean;
  /** Término de búsqueda para las tiendas. */
  query: string;
  seeds?: string[];
  listings?: string[];
  reason: string;
  specs: ComponentSpecs;
  color?: 'negro' | 'blanco';
  /** RAM y almacenamiento, en GB. */
  capacityGB?: number;
  vramGB?: number;
  /** La CPU tiene gráficos integrados. */
  igpu?: boolean;
  /** Vatios que puede disipar el disipador. */
  coolerRatingW?: number;
  /** Nivel de gama (portátiles y periféricos). */
  tier?: number;
  perf?: {
    /** CPU: juegos 1080p (% del Ryzen 7 9850X3D). */
    gaming?: number;
    /** CPU: multinúcleo (% de la mejor). */
    multi?: number;
    /** CPU: un núcleo (% de la mejor). */
    single?: number;
    /** GPU: rasterización 1440p Ultra (% de la RTX 5090). */
    raster1440?: number;
    /** GPU: trazado de rayos 1440p Ultra (% de la RTX 5090). */
    rt1440?: number;
  };
}

export const PERF_SOURCE = "Tom's Hardware, GPU y CPU Benchmarks Hierarchy 2026";

const NOT_LAPTOP = ['portatil', 'laptop', 'notebook'];
const WHITE = ['blanco', 'blanca', 'white'];

const PCC_GPU = (slug: string) => `https://www.pccomponentes.com/categorias/tarjetas-graficas/${slug}`;
const COOLMOD_GPU = (slug: string) => `https://www.coolmod.com/tarjetas-graficas/serie-${slug}/`;
const NEOBYTE_NV = (model: string) => `https://www.neobyte.es/nvidia-geforce-rtx-299?q=Modelo-GeForce+RTX+${model}`;
const LDLC = (pb: string) => `https://www.ldlc.com/es-es/ficha/${pb}.html`;

export const CATALOG: CatalogItem[] = [
  /* ------------------------------ Procesadores ------------------------------ */
  {
    id: 'cpu-7600x',
    type: 'cpu',
    name: 'AMD Ryzen 5 7600X',
    match: ['ryzen', '7600x'],
    exclude: ['7600x3d', 'placa'],
    query: 'AMD Ryzen 5 7600X',
    seeds: [
      'https://www.pccomponentes.com/amd-ryzen-5-7600x-47-ghz-box-sin-ventilador',
      'https://www.neobyte.es/amd-ryzen-5-7600x-procesador-am5-15297.html',
      'https://www.coolmod.com/amd-ryzen-5-7600x-5-3ghz-socket-am5/',
      'https://www.aussar.es/procesadores/amd-ryzen-5-7600x-sin-cooler-47-ghz-box.html',
      LDLC('PB00515316'),
    ],
    reason: '6 núcleos Zen 4: la entrada más barata a AM5 con buen rendimiento en juegos.',
    specs: { socket: 'AM5', memoryType: 'DDR5', tdpW: 142, summary: '6 núcleos · 12 hilos · hasta 5,3 GHz' },
    igpu: true,
    perf: { gaming: 67.3, multi: 30.1, single: 71.5 },
  },
  {
    id: 'cpu-9600x',
    type: 'cpu',
    name: 'AMD Ryzen 5 9600X',
    match: ['ryzen', '9600x'],
    exclude: ['9600x3d', 'placa'],
    query: 'AMD Ryzen 5 9600X',
    seeds: [
      'https://www.pccomponentes.com/procesador-amd-ryzen-5-9600x-3-9-5-4ghz',
      'https://www.neobyte.es/amd-ryzen-5-9600x-procesador-am5-22173.html',
      'https://www.neobyte.es/amd-ryzen-5-9600x-t-procesador-am5-32875.html',
      LDLC('PB00622385'),
    ],
    reason: '6 núcleos Zen 5 a 65 W: más rápido que el 7600X en juegos y en un solo hilo.',
    specs: { socket: 'AM5', memoryType: 'DDR5', tdpW: 88, summary: '6 núcleos · 12 hilos · hasta 5,4 GHz · 65 W' },
    igpu: true,
    perf: { gaming: 72.6, multi: 38.2, single: 89 },
  },
  {
    id: 'cpu-7700x',
    type: 'cpu',
    name: 'AMD Ryzen 7 7700X',
    match: ['ryzen', '7700x'],
    exclude: ['7700x3d', 'placa'],
    query: 'AMD Ryzen 7 7700X',
    seeds: ['https://www.pccomponentes.com/amd-ryzen-7-7700x-45-ghz-box-sin-ventilador'], // patrón
    reason: '8 núcleos Zen 4: más margen que un 6 núcleos para jugar y trabajar a la vez.',
    specs: { socket: 'AM5', memoryType: 'DDR5', tdpW: 142, summary: '8 núcleos · 16 hilos · hasta 5,4 GHz' },
    igpu: true,
    perf: { gaming: 70.6, multi: 45, single: 84 },
  },
  {
    id: 'cpu-7800x3d',
    type: 'cpu',
    name: 'AMD Ryzen 7 7800X3D',
    match: ['ryzen', '7800x3d'],
    exclude: ['placa'],
    query: 'AMD Ryzen 7 7800X3D',
    seeds: [
      'https://www.pccomponentes.com/amd-ryzen-7-7800x3d-42-ghz-5-ghz',
      'https://www.pccomponentes.com/procesador-amd-ryzen-7-7800x3d-4-2ghz-5ghz-tray',
      'https://www.coolmod.com/amd-ryzen-7-7800x3d-5-0ghz-socket-am5-oem/',
      'https://www.neobyte.es/amd-ryzen-7-7800x3d-procesador-am5-17301.html',
      'https://www.neobyte.es/amd-ryzen-7-7800x3d-t-procesador-am5-27400.html',
      LDLC('PB00546345'),
    ],
    reason: '8 núcleos con 3D V-Cache: en juegos rinde muy cerca de los Zen 5 X3D por menos dinero.',
    specs: { socket: 'AM5', memoryType: 'DDR5', tdpW: 162, summary: '8 núcleos · 16 hilos · 96 MB de caché L3' },
    igpu: true,
    perf: { gaming: 85.6, multi: 42.8, single: 77.3 },
  },
  {
    id: 'cpu-9800x3d',
    type: 'cpu',
    name: 'AMD Ryzen 7 9800X3D',
    match: ['ryzen', '9800x3d'],
    exclude: ['placa'],
    query: 'AMD Ryzen 7 9800X3D',
    seeds: [
      'https://www.pccomponentes.com/procesador-amd-ryzen-7-9800x3d-47-52ghz',
      'https://www.pccomponentes.com/procesador-amd-ryzen-7-9800x3d-47-52ghz-tray',
      'https://www.coolmod.com/amd-ryzen-7-9800x3d-5-2ghz-socket-am5-boxed/',
    ],
    reason: '8 núcleos Zen 5 con 3D V-Cache: de los procesadores más rápidos en juegos.',
    specs: { socket: 'AM5', memoryType: 'DDR5', tdpW: 162, summary: '8 núcleos · 16 hilos · hasta 5,2 GHz · 3D V-Cache' },
    igpu: true,
    perf: { gaming: 97, multi: 54.7, single: 87.6 },
  },
  {
    id: 'cpu-9850x3d',
    type: 'cpu',
    name: 'AMD Ryzen 7 9850X3D',
    match: ['ryzen', '9850x3d'],
    exclude: ['placa'],
    query: 'AMD Ryzen 7 9850X3D',
    seeds: [
      'https://www.coolmod.com/amd-ryzen-7-9850x3d-5-6ghz-socket-am5-boxed/',
      'https://www.neobyte.es/amd-ryzen-7-9850x3d-procesador-am5-32239.html',
      LDLC('PB00718884'),
    ],
    reason: 'El procesador más rápido en juegos de la tabla de Tom\'s Hardware.',
    specs: { socket: 'AM5', memoryType: 'DDR5', tdpW: 162, summary: '8 núcleos · 16 hilos · hasta 5,6 GHz · 3D V-Cache' },
    igpu: true,
    perf: { gaming: 100, multi: 54.8, single: 93.2 },
  },
  {
    id: 'cpu-9900x',
    type: 'cpu',
    name: 'AMD Ryzen 9 9900X',
    match: ['ryzen', '9900x'],
    exclude: ['9900x3d', 'placa'],
    query: 'AMD Ryzen 9 9900X',
    reason: '12 núcleos Zen 5: buen equilibrio entre juegos y trabajo multinúcleo.',
    specs: { socket: 'AM5', memoryType: 'DDR5', tdpW: 162, summary: '12 núcleos · 24 hilos · hasta 5,6 GHz' },
    igpu: true,
    perf: { gaming: 73.9, multi: 73.7, single: 92.2 },
  },
  {
    id: 'cpu-9950x',
    type: 'cpu',
    name: 'AMD Ryzen 9 9950X',
    match: ['ryzen', '9950x'],
    exclude: ['9950x3d', 'placa'],
    query: 'AMD Ryzen 9 9950X',
    reason: '16 núcleos Zen 5: para render, compilación y edición de vídeo.',
    specs: { socket: 'AM5', memoryType: 'DDR5', tdpW: 230, summary: '16 núcleos · 32 hilos · hasta 5,7 GHz' },
    igpu: true,
    perf: { gaming: 76.9, multi: 93, single: 93.3 },
  },
  {
    id: 'cpu-9950x3d',
    type: 'cpu',
    name: 'AMD Ryzen 9 9950X3D',
    match: ['ryzen', '9950x3d'],
    exclude: ['placa'],
    query: 'AMD Ryzen 9 9950X3D',
    reason: '16 núcleos con 3D V-Cache: el único en lo más alto tanto en juegos como en multinúcleo.',
    specs: { socket: 'AM5', memoryType: 'DDR5', tdpW: 230, summary: '16 núcleos · 32 hilos · 3D V-Cache' },
    igpu: true,
    perf: { gaming: 95.7, multi: 96.2, single: 92.8 },
  },
  {
    id: 'cpu-250kplus',
    type: 'cpu',
    name: 'Intel Core Ultra 5 250K Plus',
    match: ['ultra', '250k', 'plus'],
    exclude: ['placa'],
    query: 'Intel Core Ultra 5 250K Plus',
    reason: '18 núcleos (6P + 12E): mucho rendimiento multinúcleo por su precio.',
    specs: { socket: 'LGA1851', memoryType: 'DDR5', tdpW: 159, summary: '18 núcleos (6P + 12E) · LGA1851' },
    igpu: true,
    perf: { gaming: 73.3, multi: 68.2, single: 94 },
  },
  {
    id: 'cpu-270kplus',
    type: 'cpu',
    name: 'Intel Core Ultra 7 270K Plus',
    match: ['ultra', '270k', 'plus'],
    exclude: ['placa'],
    query: 'Intel Core Ultra 7 270K Plus',
    reason: '24 núcleos (8P + 16E): el más rápido en un solo hilo y de los mejores en multinúcleo.',
    specs: { socket: 'LGA1851', memoryType: 'DDR5', tdpW: 250, summary: '24 núcleos (8P + 16E) · LGA1851' },
    igpu: true,
    perf: { gaming: 77.5, multi: 91.9, single: 100 },
  },

  /* ---------------------------- Tarjetas gráficas ---------------------------- */
  {
    id: 'gpu-rtx5050',
    type: 'gpu',
    name: 'NVIDIA GeForce RTX 5050 8 GB',
    match: ['5050'],
    exclude: ['ti', ...NOT_LAPTOP],
    query: 'RTX 5050 8GB',
    listings: [PCC_GPU('nvidia-rtx-5050'), COOLMOD_GPU('rtx-5050')], // patrón
    reason: 'La gráfica NVIDIA más barata de la serie 50, para 1080p con ajustes medios.',
    specs: { tdpW: 130, summary: '8 GB GDDR6 · DLSS 4' },
    vramGB: 8,
    perf: { raster1440: 27.1, rt1440: 18.5 },
  },
  {
    id: 'gpu-rtx5060',
    type: 'gpu',
    name: 'NVIDIA GeForce RTX 5060 8 GB',
    match: ['5060'],
    exclude: ['ti', ...NOT_LAPTOP],
    query: 'RTX 5060 8GB',
    seeds: [
      'https://www.pccomponentes.com/tarjeta-grafica-gigabyte-geforce-rtx-5060-windforce-oc-8gb-gddr7-reflex-2-rtx-ai-dlss4',
      'https://www.pccomponentes.com/tarjeta-grafica-msi-geforce-rtx-5060-ventus-2x-oc-8gb-gddr7-reflex-2-rtx-ai-dlss4',
      'https://www.pccomponentes.com/tarjeta-grafica-msi-geforce-rtx-5060-gaming-oc-8gb-gddr7-reflex-2-rtx-ai-dlss4',
      'https://www.coolmod.com/gigabyte-geforce-rtx-5060-gaming-oc-8gb-gddr7-dlss4/',
      'https://www.coolmod.com/gigabyte-geforce-rtx-5060-windforce-max-oc-v2-8gb-gddr7-dlss4/',
      'https://www.aussar.es/tarjetas-graficas/vga-asus-geforceR-rtx-5060-8gb-dual-white-oc.html',
    ],
    listings: [PCC_GPU('nvidia-rtx-5060'), NEOBYTE_NV('5060')],
    reason: 'Para jugar en 1080p con ajustes altos y DLSS 4.',
    specs: { tdpW: 145, summary: '8 GB GDDR7 · DLSS 4' },
    vramGB: 8,
    perf: { raster1440: 35.8, rt1440: 24.4 },
  },
  {
    id: 'gpu-rtx5060ti16',
    type: 'gpu',
    name: 'NVIDIA GeForce RTX 5060 Ti 16 GB',
    match: ['5060', 'ti', '16gb'],
    exclude: NOT_LAPTOP,
    query: 'RTX 5060 Ti 16GB',
    listings: [PCC_GPU('nvidia-rtx-5060-ti'), COOLMOD_GPU('rtx-5060-ti'), NEOBYTE_NV('5060+Ti')], // patrón
    reason: '16 GB de VRAM: aguanta mejor los juegos nuevos en 1080p y 1440p.',
    specs: { tdpW: 180, summary: '16 GB GDDR7 · DLSS 4' },
    vramGB: 16,
    perf: { raster1440: 43.9, rt1440: 38.6 },
  },
  {
    id: 'gpu-rx9060xt16',
    type: 'gpu',
    name: 'AMD Radeon RX 9060 XT 16 GB',
    match: ['9060', 'xt', '16gb'],
    exclude: NOT_LAPTOP,
    query: 'RX 9060 XT 16GB',
    listings: [PCC_GPU('amd-rx-9060-xt'), COOLMOD_GPU('rx-9060-xt')], // patrón
    reason: '16 GB de VRAM y FSR 4 a buen precio para 1080p/1440p.',
    specs: { tdpW: 160, summary: '16 GB GDDR6 · FSR 4' },
    vramGB: 16,
    perf: { raster1440: 40.2, rt1440: 30.8 },
  },
  {
    id: 'gpu-rtx5070',
    type: 'gpu',
    name: 'NVIDIA GeForce RTX 5070 12 GB',
    match: ['5070'],
    exclude: ['ti', ...NOT_LAPTOP],
    query: 'RTX 5070 12GB',
    seeds: [
      'https://www.pccomponentes.com/tarjeta-grafica-gigabyte-geforce-rtx-5070-gaming-oc-12gb-gddr7-reflex-2-rtx-ai-dlss4',
      'https://www.pccomponentes.com/tarjeta-grafica-zotac-gaming-geforce-rtx-5070-solid-12gb-gddr7-reflex-2-rtx-ai-dlss4',
      'https://www.pccomponentes.com/tarjeta-grafica-pny-geforce-rtx-5070-overclocked-triple-fan-12gb-gddr7-reflex-2-rtx-ai-dlss4',
      'https://www.coolmod.com/msi-geforce-rtx-5070-ventus-2x-oc-12gb-gddr7-dlss4/',
      'https://www.coolmod.com/msi-geforce-rtx-5070-gaming-trio-oc-12gb-gddr7-dlss4/',
      'https://www.neobyte.es/gigabyte-geforce-rtx-5070-gaming-oc-12gb-gddr7-dlss4-tarjeta-grafica-26539.html',
    ],
    listings: [PCC_GPU('nvidia-rtx-5070'), COOLMOD_GPU('rtx-5070'), NEOBYTE_NV('5070')],
    reason: 'La gama media de referencia para jugar en 1440p con trazado de rayos y DLSS 4.',
    specs: { tdpW: 250, summary: '12 GB GDDR7 · DLSS 4' },
    vramGB: 12,
    perf: { raster1440: 57.6, rt1440: 51.1 },
  },
  {
    id: 'gpu-rx9070',
    type: 'gpu',
    name: 'AMD Radeon RX 9070 16 GB',
    match: ['9070'],
    exclude: ['xt', 'gre', ...NOT_LAPTOP],
    query: 'RX 9070 16GB',
    listings: [PCC_GPU('amd-rx-9070'), COOLMOD_GPU('rx-9070')], // patrón
    reason: 'Algo más rápida que la RTX 5070 en rasterización y con 16 GB de VRAM.',
    specs: { tdpW: 220, summary: '16 GB GDDR6 · FSR 4' },
    vramGB: 16,
    perf: { raster1440: 62.1, rt1440: 47.2 },
  },
  {
    id: 'gpu-rx9070xt',
    type: 'gpu',
    name: 'AMD Radeon RX 9070 XT 16 GB',
    match: ['9070', 'xt'],
    exclude: NOT_LAPTOP,
    query: 'RX 9070 XT 16GB',
    seeds: [
      'https://www.pccomponentes.com/tarjeta-grafica-asrock-steel-legend-amd-radeon-rx-9070-xt-16gb-gddr6-fsr-4',
      'https://www.pccomponentes.com/tarjeta-grafica-sapphire-pure-amd-radeon-rx-9070-xt-16gb-gddr6-fsr-4',
      'https://www.pccomponentes.com/tarjeta-grafica-asus-prime-amd-radeon-rx-9070-xt-oc-16gb-gddr6-fsr-4',
      'https://www.coolmod.com/sapphire-pulse-amd-radeon-rx-9070-xt-16gb-gddr6/',
      'https://www.coolmod.com/sapphire-pure-amd-radeon-rx-9070-xt-16gb-gddr6/',
    ],
    listings: [PCC_GPU('amd-rx-9070-xt'), COOLMOD_GPU('rx-9070-xt')],
    reason: 'Casi el rendimiento de una RTX 5070 Ti en rasterización, ideal para 1440p alto y 4K.',
    specs: { tdpW: 304, summary: '16 GB GDDR6 · FSR 4' },
    vramGB: 16,
    perf: { raster1440: 69.7, rt1440: 55.1 },
  },
  {
    id: 'gpu-rtx5070ti',
    type: 'gpu',
    name: 'NVIDIA GeForce RTX 5070 Ti 16 GB',
    match: ['5070', 'ti'],
    exclude: NOT_LAPTOP,
    query: 'RTX 5070 Ti 16GB',
    seeds: [
      'https://www.pccomponentes.com/tarjeta-grafica-msi-geforce-rtx-5070-ti-ventus-3x-oc-16gb-gddr7-reflex-2-rtx-ai-dlss4',
      'https://www.pccomponentes.com/tarjeta-grafica-gigabyte-geforce-rtx-5070-ti-gaming-oc-16gb-gddr7-reflex-2-rtx-ai-dlss4',
      'https://www.coolmod.com/msi-geforce-rtx-5070-ti-ventus-3x-oc-16gb-gddr7-dlss4/',
      'https://www.coolmod.com/gigabyte-geforce-rtx-5070-ti-eagle-oc-sff-16gb-gddr7/',
      'https://www.neobyte.es/pny-geforce-rtx-5070-ti-16gb-gddr7-argb-oc-triple-fan-tarjeta-grafica-43942.html',
    ],
    listings: ['https://www.pccomponentes.com/tarjetas-graficas/geforce-rtx-5070-ti/grafica-nvidia', COOLMOD_GPU('rtx-5070-ti')],
    reason: '16 GB y gran rendimiento con trazado de rayos: 1440p a alta tasa de refresco o 4K.',
    specs: { tdpW: 300, summary: '16 GB GDDR7 · DLSS 4' },
    vramGB: 16,
    perf: { raster1440: 69.8, rt1440: 65.7 },
  },
  {
    id: 'gpu-rtx5080',
    type: 'gpu',
    name: 'NVIDIA GeForce RTX 5080 16 GB',
    match: ['5080'],
    exclude: NOT_LAPTOP,
    query: 'RTX 5080 16GB',
    listings: [PCC_GPU('nvidia-rtx-5080'), COOLMOD_GPU('rtx-5080'), NEOBYTE_NV('5080')], // patrón
    reason: 'Para 4K con ajustes altos y trazado de rayos.',
    specs: { tdpW: 360, summary: '16 GB GDDR7 · DLSS 4' },
    vramGB: 16,
    perf: { raster1440: 76.7, rt1440: 73.4 },
  },
  {
    id: 'gpu-rtx5090',
    type: 'gpu',
    name: 'NVIDIA GeForce RTX 5090 32 GB',
    match: ['5090'],
    exclude: NOT_LAPTOP,
    query: 'RTX 5090 32GB',
    listings: [PCC_GPU('nvidia-rtx-5090'), COOLMOD_GPU('rtx-5090'), NEOBYTE_NV('5090')], // patrón
    reason: 'La gráfica más potente del mercado (referencia 100 % de la tabla).',
    specs: { tdpW: 575, summary: '32 GB GDDR7 · DLSS 4' },
    vramGB: 32,
    perf: { raster1440: 100, rt1440: 100 },
  },

  /* ------------------------------- Placas base ------------------------------- */
  {
    id: 'mb-msi-pro-b850-s-wifi6e',
    type: 'motherboard',
    name: 'MSI PRO B850-S WIFI6E',
    match: ['pro', 'b850', 'wifi6e'],
    exclude: ['evo', 'gaming', 'b850m', 'pack'],
    query: 'MSI PRO B850-S WIFI6E',
    seeds: ['https://www.coolmod.com/msi-placa-base-pro-b850-s-wifi6e-atx-am5/'],
    reason: 'Placa B850 ATX con WiFi 6E: lo necesario para AM5 sin pagar extras.',
    specs: { socket: 'AM5', memoryType: 'DDR5', formFactor: 'ATX', summary: 'AM5 · B850 · ATX · DDR5 · WiFi 6E' },
  },
  {
    id: 'mb-gigabyte-b850-eagle-wifi6e',
    type: 'motherboard',
    name: 'Gigabyte B850 EAGLE WIFI6E',
    match: ['b850', 'eagle', 'wifi6e'],
    exclude: ['b850m', 'ice'],
    query: 'Gigabyte B850 EAGLE WIFI6E',
    reason: 'B850 ATX con WiFi 6E y PCIe 5.0 para la gráfica.',
    specs: { socket: 'AM5', memoryType: 'DDR5', formFactor: 'ATX', summary: 'AM5 · B850 · ATX · DDR5 · WiFi 6E' },
  },
  {
    id: 'mb-msi-b850-gaming-plus-wifi6e',
    type: 'motherboard',
    name: 'MSI B850 GAMING PLUS WIFI6E',
    match: ['b850', 'gaming', 'plus', 'wifi6e'],
    exclude: ['b850m'],
    query: 'MSI B850 GAMING PLUS WIFI6E',
    reason: 'B850 ATX con buenas fases de alimentación y WiFi 6E.',
    specs: { socket: 'AM5', memoryType: 'DDR5', formFactor: 'ATX', summary: 'AM5 · B850 · ATX · DDR5 · WiFi 6E' },
  },
  {
    id: 'mb-msi-b850m-gaming-plus-wifi6e',
    type: 'motherboard',
    name: 'MSI B850M GAMING PLUS WIFI6E',
    match: ['b850m', 'gaming', 'plus'],
    query: 'MSI B850M GAMING PLUS WIFI6E',
    reason: 'B850 en formato Micro-ATX para cajas más pequeñas.',
    specs: { socket: 'AM5', memoryType: 'DDR5', formFactor: 'Micro-ATX', summary: 'AM5 · B850 · Micro-ATX · DDR5 · WiFi 6E' },
  },
  {
    id: 'mb-asus-tuf-b850-plus-wifi',
    type: 'motherboard',
    name: 'ASUS TUF Gaming B850-PLUS WIFI',
    match: ['tuf', 'b850', 'plus'],
    exclude: ['b850m', 'pack'],
    query: 'ASUS TUF GAMING B850-PLUS WIFI',
    seeds: ['https://www.coolmod.com/asus-tuf-gaming-b850-plus-wifi-socket-am5/'],
    reason: 'Placa robusta con WiFi 7 y buena refrigeración de VRM para CPUs de gama alta.',
    specs: { socket: 'AM5', memoryType: 'DDR5', formFactor: 'ATX', summary: 'AM5 · B850 · ATX · DDR5 · WiFi 7' },
  },
  {
    id: 'mb-msi-mag-b850-tomahawk-wifi',
    type: 'motherboard',
    name: 'MSI MAG B850 TOMAHAWK WIFI',
    match: ['b850', 'tomahawk'],
    exclude: ['max', 'b850m'],
    query: 'MSI MAG B850 TOMAHAWK WIFI',
    seeds: ['https://www.pccomponentes.com/placa-base-msi-mag-b850-tomahawk-wifi-am5-ddr5-atx-wifi-7-5g-lan-triple-m-2-pcie-5-0'],
    reason: 'B850 de gama alta: red de 5 Gb, WiFi 7 y tres M.2.',
    specs: { socket: 'AM5', memoryType: 'DDR5', formFactor: 'ATX', summary: 'AM5 · B850 · ATX · DDR5 · WiFi 7 · LAN 5G' },
  },
  {
    id: 'mb-asrock-b850-steel-legend-wifi',
    type: 'motherboard',
    name: 'ASRock B850 Steel Legend WIFI',
    match: ['b850', 'steel', 'legend'],
    exclude: ['b850m'],
    query: 'ASRock B850 Steel Legend WIFI',
    seeds: ['https://www.coolmod.com/asrock-b850-steel-legend-wifi-socket-am5/'],
    reason: 'B850 con estética blanca/plateada, ideal para montajes en blanco.',
    specs: { socket: 'AM5', memoryType: 'DDR5', formFactor: 'ATX', summary: 'AM5 · B850 · ATX · DDR5 · WiFi' },
    color: 'blanco',
  },
  {
    id: 'mb-b860-wifi',
    type: 'motherboard',
    name: 'Placa base Intel B860 ATX con WiFi',
    match: ['b860', 'wifi'],
    exclude: ['b860m', 'itx', 'ddr4'],
    query: 'placa base B860 WIFI ATX',
    listings: ['https://www.pccomponentes.com/placas-base/intel-b860'], // patrón
    reason: 'Chipset B860 para los Intel Core Ultra (LGA1851) con DDR5.',
    specs: { socket: 'LGA1851', memoryType: 'DDR5', formFactor: 'ATX', summary: 'LGA1851 · B860 · ATX · DDR5 · WiFi' },
  },

  /* ------------------------------- Memoria RAM ------------------------------- */
  {
    id: 'ram-ddr5-16-6000',
    type: 'ram',
    name: 'Kingston FURY Beast 16 GB (2×8 GB) DDR5 6000 CL30',
    match: ['fury', 'beast', '2x8', 'ddr5', '6000', 'cl30'],
    exclude: WHITE,
    query: 'Kingston FURY Beast 16GB 2x8GB DDR5 6000 CL30',
    seeds: [
      'https://www.pccomponentes.com/memoria-ram-kingston-fury-beast-16gb-2x8gb-ddr5-6000mhz-cl30-amd-expo-negro',
      'https://www.pccomponentes.com/memoria-ram-kingston-fury-beast-rgb-16gb-2x8gb-ddr5-6000mhz-cl30-amd-expo-negro',
      'https://www.coolmod.com/kingston-fury-beast-16gb-2x8gb-6000mhz-cl30-expo-xmp/',
      'https://www.coolmod.com/kingston-fury-beast-rgb-16gb-2x8gb-6000mhz-cl30-expo-xmp/',
      'https://www.neobyte.es/kingston-fury-beast-16gb-2x8gb-ddr5-6000mhz-cl30-memoria-ram-21754.html',
    ],
    reason: '6000 MT/s CL30 es la velocidad óptima para Ryzen 7000/9000.',
    specs: { memoryType: 'DDR5', summary: '2×8 GB · 6000 MT/s · CL30 · EXPO' },
    capacityGB: 16,
    color: 'negro',
  },
  {
    id: 'ram-ddr5-32-6000',
    type: 'ram',
    name: 'Kingston FURY Beast 32 GB (2×16 GB) DDR5 6000 CL30',
    match: ['fury', 'beast', '2x16', 'ddr5', '6000', 'cl30'],
    exclude: WHITE,
    query: 'Kingston FURY Beast 32GB 2x16GB DDR5 6000 CL30',
    seeds: [
      'https://www.coolmod.com/kingston-fury-beast-32gb-2x16gb-6000mhz-cl30-expo-xmp/',
      'https://www.coolmod.com/kingston-fury-beast-rgb-32gb-2x16gb-6000mhz-cl30-expo-xmp/',
      'https://www.neobyte.es/kingston-fury-beast-32gb-2x16gb-ddr5-6000mhz-cl30-memoria-ram-21314.html',
      'https://www.neobyte.es/kingston-fury-beast-32gb-2x16gb-ddr5-6000mhz-cl30-expo-memoria-ram-21759.html',
      'https://www.neobyte.es/kingston-fury-beast-rgb-32gb-2x16gb-ddr5-6000mhz-cl30-expo-memoria-ram-21326.html',
      'https://www.pccomponentes.com/memoria-ram-memoria-kingston-fury-beast-ddr5-rgb-32gb-6000mt-s-cl30-kit-2x16gb-dimm-negro',
    ],
    reason: '32 GB es lo recomendable hoy para juegos exigentes y multitarea.',
    specs: { memoryType: 'DDR5', summary: '2×16 GB · 6000 MT/s · CL30 · EXPO' },
    capacityGB: 32,
    color: 'negro',
  },
  {
    id: 'ram-ddr5-32-6000-white',
    type: 'ram',
    name: 'Kingston FURY Beast 32 GB (2×16 GB) DDR5 6000 CL30 blanca',
    match: ['fury', 'beast', '2x16', 'ddr5', '6000', 'cl30'],
    anyOf: WHITE,
    query: 'Kingston FURY Beast 32GB DDR5 6000 CL30 blanca',
    seeds: [
      'https://www.pccomponentes.com/memoria-ram-kingston-fury-beast-32gb-2x16gb-ddr5-6000mhz-cl30-amd-expo-blanco',
      'https://wipoid.com/kingston-fury-beast-rgb-blanca-ddr5-6000-32gb-2x16-cl30-amd-expo.html',
    ],
    reason: 'La misma memoria en blanco para montajes de ese color.',
    specs: { memoryType: 'DDR5', summary: '2×16 GB · 6000 MT/s · CL30 · blanca' },
    capacityGB: 32,
    color: 'blanco',
  },
  {
    id: 'ram-ddr5-64-6000',
    type: 'ram',
    name: 'Memoria 64 GB (2×32 GB) DDR5 6000',
    match: ['2x32', 'ddr5', '6000'],
    exclude: ['so', 'sodimm'],
    query: '64GB 2x32GB DDR5 6000',
    reason: '64 GB para edición de vídeo, máquinas virtuales y proyectos grandes.',
    specs: { memoryType: 'DDR5', summary: '2×32 GB · 6000 MT/s' },
    capacityGB: 64,
  },

  /* ------------------------------ Almacenamiento ----------------------------- */
  {
    id: 'ssd-sn7100-500',
    type: 'storage',
    name: 'WD_BLACK SN7100 500 GB',
    match: ['sn7100', '500gb'],
    query: 'WD Black SN7100 500GB',
    seeds: [
      'https://www.pccomponentes.com/disco-duro-wd-black-sn7100-500gb-disco-ssd-6800mb-s-nvme-pcie-4-0-m-2-gen4-tlc-3d-nand',
      'https://www.neobyte.es/wd-black-sn7100-500gb-disco-duro-ssd-m2-nvme-27481.html',
    ],
    reason: 'NVMe PCIe 4.0 rápido para sistema y programas.',
    specs: { summary: 'NVMe PCIe 4.0 · hasta 6.800 MB/s' },
    capacityGB: 500,
  },
  {
    id: 'ssd-sn7100-1tb',
    type: 'storage',
    name: 'WD_BLACK SN7100 1 TB',
    match: ['sn7100', '1tb'],
    query: 'WD Black SN7100 1TB',
    seeds: ['https://www.pccomponentes.com/disco-duro-wd-black-sn7100-1tb-disco-ssd-7250mb-s-nvme-pcie-4-0-m-2-gen4-tlc-3d-nand'], // patrón
    reason: '1 TB NVMe PCIe 4.0: espacio suficiente para el sistema y varios juegos.',
    specs: { summary: 'NVMe PCIe 4.0 · hasta 7.250 MB/s' },
    capacityGB: 1000,
  },
  {
    id: 'ssd-sn7100-2tb',
    type: 'storage',
    name: 'WD_BLACK SN7100 2 TB',
    match: ['sn7100', '2tb'],
    query: 'WD Black SN7100 2TB',
    seeds: [
      'https://www.pccomponentes.com/disco-duro-wd-black-sn7100-2tb-disco-ssd-7250mb-s-nvme-pcie-4-0-m-2-gen4-tlc-3d-nand',
      'https://www.coolmod.com/western-digital-black-sn7100-2tb-pcie-gen4-x4-nvme-ssd/',
      'https://www.neobyte.es/wd-black-sn7100-2tb-disco-duro-ssd-m2-nvme-27477.html',
    ],
    reason: '2 TB NVMe PCIe 4.0 de los más rápidos de su categoría.',
    specs: { summary: 'NVMe PCIe 4.0 · hasta 7.250 MB/s' },
    capacityGB: 2000,
  },
  {
    id: 'ssd-990-evo-plus-2tb',
    type: 'storage',
    name: 'Samsung 990 EVO Plus 2 TB',
    match: ['990', 'evo', 'plus', '2tb'],
    query: 'Samsung 990 EVO Plus 2TB',
    seeds: ['https://www.coolmod.com/samsung-990-evo-plus-series-2tb-pcie-gen4-x4-nvme-ssd/'],
    reason: 'SSD de 2 TB muy eficiente, con el software Samsung Magician.',
    specs: { summary: 'NVMe PCIe 4.0 · hasta 7.250 MB/s' },
    capacityGB: 2000,
  },
  {
    id: 'ssd-sn7100-4tb',
    type: 'storage',
    name: 'WD_BLACK SN7100 4 TB',
    match: ['sn7100', '4tb'],
    query: 'WD Black SN7100 4TB',
    reason: '4 TB NVMe para bibliotecas de juegos o proyectos de vídeo grandes.',
    specs: { summary: 'NVMe PCIe 4.0 · hasta 7.000 MB/s' },
    capacityGB: 4000,
  },

  /* ------------------------------- Fuentes ---------------------------------- */
  {
    id: 'psu-rm650e',
    type: 'psu',
    name: 'Corsair RM650e 650 W 80 Plus Gold',
    match: ['rm650e'],
    exclude: WHITE,
    query: 'Corsair RM650e',
    reason: 'Fuente modular 80 Plus Gold silenciosa y de buena calidad.',
    specs: { psuWatts: 650, summary: '650 W · 80 Plus Gold · modular' },
  },
  {
    id: 'psu-rm750e',
    type: 'psu',
    name: 'Corsair RM750e 750 W 80 Plus Gold',
    match: ['rm750e'],
    exclude: WHITE,
    query: 'Corsair RM750e',
    seeds: [
      'https://www.coolmod.com/corsair-rm750e-2025-80-plus-gold-750w-atx-3-0-pcie-5-0-modular/',
      'https://www.coolmod.com/corsair-rm750e-80-plus-gold-750w-atx-3-0-pcie-5-0-modular/',
      'https://www.neobyte.es/corsair-rm750e-atx-30-80-gold-fuente-de-alimentacion-750w-17290.html',
      'https://www.wipoid.com/corsair-rm750e-750w-80-gold-modular.html',
    ],
    reason: 'Fuente modular ATX 3.1 con margen para gráficas de gama media-alta.',
    specs: { psuWatts: 750, summary: '750 W · 80 Plus Gold · modular · ATX 3.1' },
  },
  {
    id: 'psu-rm750e-white',
    type: 'psu',
    name: 'Corsair RM750e 750 W 80 Plus Gold blanca',
    match: ['rm750e'],
    anyOf: WHITE,
    query: 'Corsair RM750e blanca',
    seeds: [
      'https://www.coolmod.com/corsair-rm750e-2025-80-plus-gold-750w-atx-3-1-pcie-5-1-modular-blanco/',
      'https://www.pccomponentes.com/fuente-alimentacion-corsair-rme-series-rm750e-atx-3-1-pcie-5-1-750w-cybenetics-80-plus-gold-modular-blanca',
    ],
    reason: 'La misma fuente en blanco, con cables blancos.',
    specs: { psuWatts: 750, summary: '750 W · 80 Plus Gold · modular · blanca' },
    color: 'blanco',
  },
  {
    id: 'psu-rm850e',
    type: 'psu',
    name: 'Corsair RM850e 850 W 80 Plus Gold',
    match: ['rm850e'],
    exclude: WHITE,
    query: 'Corsair RM850e',
    reason: '850 W para gráficas de gama alta como la RTX 5080.',
    specs: { psuWatts: 850, summary: '850 W · 80 Plus Gold · modular · ATX 3.1' },
  },
  {
    id: 'psu-rm1000e',
    type: 'psu',
    name: 'Corsair RM1000e 1000 W 80 Plus Gold',
    match: ['rm1000e'],
    exclude: WHITE,
    query: 'Corsair RM1000e',
    reason: '1000 W para la RTX 5090 y CPUs de 16 núcleos.',
    specs: { psuWatts: 1000, summary: '1000 W · 80 Plus Gold · modular · ATX 3.1' },
  },

  /* --------------------------------- Cajas ---------------------------------- */
  {
    id: 'case-lancool-216',
    type: 'case',
    name: 'Lian Li Lancool 216 negra',
    match: ['lancool', '216'],
    exclude: WHITE,
    query: 'Lian Li Lancool 216',
    seeds: [
      'https://www.pccomponentes.com/torre-pc-lian-li-lancool-216-cristal-templado-usb-3-0-negra', // patrón
      'https://www.neobyte.es/lian-li-lancool-216-caja-eatx-17743.html',
      'https://www.neobyte.es/lian-li-lancool-216-rgb-caja-eatx-17739.html',
      'https://www.aussar.es/cajas/lian-li-lancool-216-argb-negro.html',
      'https://www.coolmod.com/lian-li-lancool-216-mesh-negro/',
    ],
    reason: 'Excelente flujo de aire con tres ventiladores incluidos y sitio para gráficas largas.',
    specs: { formFactor: 'E-ATX, ATX, Micro-ATX, Mini-ITX', caseMaxGpuLengthMm: 392, summary: 'Semitorre · malla · 3 ventiladores · GPU hasta 392 mm' },
    color: 'negro',
  },
  {
    id: 'case-lancool-216-white',
    type: 'case',
    name: 'Lian Li Lancool 216 blanca',
    match: ['lancool', '216'],
    anyOf: WHITE,
    query: 'Lian Li Lancool 216 blanca',
    seeds: ['https://wipoid.com/lian-li-lancool-216-rgb-blanca-e-atx.html', 'https://www.coolmod.com/lian-li-lancool-216-rgb-con-controlador-blanco/'],
    reason: 'La misma caja en blanco.',
    specs: { formFactor: 'E-ATX, ATX, Micro-ATX, Mini-ITX', caseMaxGpuLengthMm: 392, summary: 'Semitorre · malla · blanca · GPU hasta 392 mm' },
    color: 'blanco',
  },

  /* ------------------------------ Refrigeración ----------------------------- */
  {
    id: 'cooler-pa120se',
    type: 'cooler',
    name: 'Thermalright Peerless Assassin 120 SE',
    match: ['peerless', 'assassin', '120', 'se'],
    exclude: [...WHITE, 'digital'],
    query: 'Thermalright Peerless Assassin 120 SE',
    seeds: [
      'https://www.coolmod.com/thermalright-peerless-assassin-120-se-negro/',
      'https://www.coolmod.com/thermalright-peerless-assassin-120-se-argb-negro/',
      'https://www.pccomponentes.com/ventilador-cpu-refrigeracion-aire-thermalright-socket-am4-am5-lga1200-120mm-peerless-assassin-120-se-doble-torre-negro',
      'https://www.pccomponentes.com/ventilador-cpu-thermalright-peerless-assassin-120-se-argb-ventilador-cpu-120mm-negro',
      'https://www.neobyte.es/thermalright-peerless-assassin-120-se-argb-negro-refrigeracion-cpu-42127.html',
    ],
    reason: 'Disipador de doble torre que enfría como modelos que cuestan el doble.',
    specs: { summary: 'Doble torre · 2 × 120 mm · 6 heatpipes' },
    coolerRatingW: 250,
    color: 'negro',
  },
  {
    id: 'cooler-pa120se-white',
    type: 'cooler',
    name: 'Thermalright Peerless Assassin 120 SE blanco',
    match: ['peerless', 'assassin', '120', 'se'],
    anyOf: WHITE,
    exclude: ['digital'],
    query: 'Thermalright Peerless Assassin 120 SE blanco',
    seeds: ['https://www.coolmod.com/thermalright-peerless-assassin-120-se-argb-blanco/'],
    reason: 'El mismo disipador en blanco.',
    specs: { summary: 'Doble torre · 2 × 120 mm · blanco' },
    coolerRatingW: 250,
    color: 'blanco',
  },

  /* ------------------------------- Periféricos ------------------------------ */
  {
    id: 'mon-q27g4xf',
    type: 'monitor',
    name: 'AOC Q27G4XF 27" QHD 180 Hz',
    match: ['q27g4xf'],
    query: 'AOC Q27G4XF',
    seeds: [
      'https://www.pccomponentes.com/monitor-aoc-q27g4xf-27-led-fast-ips-qhd-180hz-regulable-en-altura',
      'https://www.coolmod.com/aoc-gaming-q27g4xf-27-qhd-ips-180hz-0-5ms-hdr/',
      'https://www.neobyte.es/aoc-gaming-q27g4xf-monitor-27-quad-hd-180hz-25769.html',
    ],
    reason: '27" 2560×1440 a 180 Hz con panel Fast IPS: el punto dulce para jugar y trabajar.',
    specs: { summary: '27" · 2560×1440 · 180 Hz · Fast IPS' },
    tier: 1,
  },
  {
    id: 'mon-q27g4x',
    type: 'monitor',
    name: 'AOC Q27G4X 27" QHD 180 Hz',
    match: ['q27g4x'],
    exclude: ['q27g4xf', 'cq27g4x'],
    query: 'AOC Q27G4X',
    seeds: [
      'https://www.pccomponentes.com/aoc-q27g4x-27-lcd-fast-ips-qhd-180hz-g-sync-compatible',
      'https://www.coolmod.com/aoc-gaming-q27g4x-27-qhd-ips-180hz-0-5ms-hdr-g-sync/',
    ],
    reason: 'Igual que el Q27G4XF con soporte regulable en altura y HDR400.',
    specs: { summary: '27" · 2560×1440 · 180 Hz · Fast IPS · HDR400' },
    tier: 2,
  },
  {
    id: 'kb-g213',
    type: 'keyboard',
    name: 'Logitech G213 Prodigy',
    match: ['g213'],
    query: 'Logitech G213 Prodigy',
    seeds: ['https://www.pccomponentes.com/logitech-g213-prodigy-teclado-gaming'], // patrón
    reason: 'Teclado gaming fiable con reposamuñecas y resistencia a salpicaduras.',
    specs: { summary: 'Membrana · RGB · antisalpicaduras' },
    tier: 1,
  },
  {
    id: 'mouse-g305',
    type: 'mouse',
    name: 'Logitech G305 Lightspeed',
    match: ['g305'],
    exclude: ['superlight'],
    query: 'Logitech G305 Lightspeed',
    seeds: [
      'https://www.pccomponentes.com/logitech-g305-lightspeed-raton-inalambrico-gaming-12000dpi-negro',
      'https://www.pccomponentes.com/logitech-g305-lightspeed-raton-inalambrico-gaming-12000dpi-blanco',
      'https://www.neobyte.es/logitech-g305-lightspeed-raton-gaming-29040.html',
      'https://www.coolmod.com/logitech-g-g305-gaming-12000-dpi-wireless-blanco/',
    ],
    reason: 'Ratón inalámbrico ligero con sensor HERO y hasta 250 horas de batería.',
    specs: { summary: 'Inalámbrico · 12.000 DPI · 99 g' },
    tier: 1,
  },

  /* -------------------------------- Portátiles ------------------------------- */
  {
    id: 'laptop-office',
    type: 'laptop',
    name: 'Portátil con 16 GB de RAM',
    match: ['16gb', 'ssd'],
    exclude: ['rtx', 'geforce', 'chromebook'],
    laptop: true,
    query: 'portátil 16GB SSD',
    listings: ['https://www.pccomponentes.com/portatiles'], // patrón
    reason: 'Portátil sin gráfica dedicada: suficiente para ofimática, navegador y programación.',
    specs: { summary: 'Gráficos integrados' },
    tier: 0,
  },
  {
    id: 'laptop-rtx5050',
    type: 'laptop',
    name: 'Portátil gaming con RTX 5050',
    match: ['5050', 'ssd'],
    laptop: true,
    query: 'portátil RTX 5050',
    listings: ['https://www.pccomponentes.com/categorias/portatiles/nvidia-rtx-5050'], // patrón
    reason: 'Gaming de entrada en 1080p con DLSS 4.',
    specs: { summary: 'NVIDIA RTX 5050 Laptop' },
    tier: 2,
  },
  {
    id: 'laptop-rtx5060',
    type: 'laptop',
    name: 'Portátil gaming con RTX 5060',
    match: ['5060', 'ssd'],
    laptop: true,
    query: 'portátil RTX 5060',
    seeds: [
      'https://www.pccomponentes.com/portatil-lenovo-loq-15irx10-15-6-intel-core-i7-13645hx-16gb-512gb-ssd-rtx-5060-freedos',
      'https://www.pccomponentes.com/portatil-lenovo-loq-15irx10-156-intel-core-i5-13450hx-16gb-1tb-ssd-rtx-5060-windows-11-home',
      'https://www.pccomponentes.com/portatil-lenovo-loq-15irx10-156-intel-core-i7-13700hx-32gb-1tb-ssd-rtx-5060-8gb-luna-grey-rgb-e-shutter',
      'https://www.pccomponentes.com/portatil-asus-tuf-gaming-a16-tuf608um-rv041-amd-ryzen-7-260-16gb-1tb-ssd-rtx-5060-16-wuxga-165hz',
      'https://www.pccomponentes.com/portatil-asus-tuf-gaming-f16-16-intel-core-i7-14650hx-16gb-512gb-ssd-rtx-5060-sin-sistema-operativo',
      'https://www.pccomponentes.com/portatil-asus-tuf-gaming-tuf608jmr-rv038-16-intel-core-i7-14650hx-32gb-1tb-ssd-rtx-5060-8gb-qwerty-esp-gris',
      'https://www.coolmod.com/asus-tuf-gaming-tuf608jmr-rv038-i7-14650hx-rtx-5060-32gb-1tb-16-freedos/',
    ],
    listings: ['https://www.pccomponentes.com/categorias/portatiles/nvidia-rtx-5060'],
    reason: 'Juega en 1080p con ajustes altos y trazado de rayos.',
    specs: { summary: 'NVIDIA RTX 5060 Laptop' },
    tier: 3,
  },
  {
    id: 'laptop-rtx5070',
    type: 'laptop',
    name: 'Portátil gaming con RTX 5070',
    match: ['5070', 'ssd'],
    exclude: ['ti'],
    laptop: true,
    query: 'portátil RTX 5070',
    listings: ['https://www.pccomponentes.com/categorias/portatiles/nvidia-rtx-5070'], // patrón
    reason: 'Más potencia para pantallas de alta resolución y tasa de refresco.',
    specs: { summary: 'NVIDIA RTX 5070 Laptop' },
    tier: 4,
  },
  {
    id: 'laptop-rtx5070ti',
    type: 'laptop',
    name: 'Portátil gaming con RTX 5070 Ti',
    match: ['5070', 'ti', 'ssd'],
    laptop: true,
    query: 'portátil RTX 5070 Ti',
    listings: ['https://www.pccomponentes.com/categorias/portatiles/nvidia-rtx-5070-ti'], // patrón
    reason: 'Gama alta: 1440p con ajustes altos en portátil.',
    specs: { summary: 'NVIDIA RTX 5070 Ti Laptop' },
    tier: 5,
  },
];

export const CATALOG_BY_ID = new Map(CATALOG.map((i) => [i.id, i]));

/** Puntuación de juego de una GPU: 70 % rasterización + 30 % trazado de rayos (1440p). */
export function gpuGamingScore(item: CatalogItem): number {
  const r = item.perf?.raster1440 ?? 0;
  const rt = item.perf?.rt1440 ?? r;
  return Math.round((0.7 * r + 0.3 * rt) * 10) / 10;
}
