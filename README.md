# KreaPC

Configurador de PC y portátiles con **precios reales de tiendas españolas**, enlace directo a la ficha de cada producto, compatibilidad comprobada y rendimiento según benchmarks. **No usa IA ni APIs de Google**: no hay claves ni costes por consulta.

## Cómo funciona

1. **Catálogo** (`server/catalog.ts`): procesadores, gráficas, placas, RAM, SSD, fuentes, cajas, disipadores, periféricos y portátiles con sus especificaciones reales y las fichas donde se venden (PcComponentes, Coolmod, Neobyte, Wipoid, Aussar, LDLC…).
2. **Precios** (`server/priceService.ts`): el servidor lee cada ficha y saca el precio y el stock de sus datos estructurados (schema.org / JSON-LD), cada 6 horas.
   - Solo acepta el precio si el nombre del producto en la tienda es exactamente el modelo del catálogo (descarta variantes, packs y reacondicionados).
   - Si una ficha desaparece (404) o la tienda ya no vende el producto se borra; si una tienda bloquea un rato, se mantiene el último precio leído hasta 48 h.
   - Si una tienda bloquea al servidor o no responde 3 veces seguidas (403, reto anti-bot, tiempo de espera) se deja de consultar 24 h y luego se reintenta. No se intenta saltar ningún bloqueo.
   - Busca fichas nuevas en las páginas de categoría una vez al día.
   - Una petición a la vez por tienda, con pausa entre peticiones, y respeta `robots.txt`.
3. **Recomendación** (`server/engine.ts`): prueba todas las combinaciones de CPU y GPU, completa cada una con las piezas compatibles más baratas que tienen precio y elige la de más rendimiento para el uso (gaming, productividad, creación, desarrollo) que cabe en el presupuesto. Si no cabe nada, lo dice y muestra la opción más económica posible.
4. **Rendimiento**: datos de Tom's Hardware (GPU y CPU Benchmarks Hierarchy 2026). **Compatibilidad**: socket, tipo de RAM, potencia de la fuente, formato de placa y caja.

### Tiendas que dejan leer sus precios

Desde un servidor en un centro de datos (como Oracle Cloud), hoy **LDLC** sirve sus fichas con normalidad, mientras que PcComponentes, Coolmod, Neobyte y Aussar responden 403 (bloqueo antibots). Por eso el catálogo prioriza fichas de LDLC. `GET /api/diagnostico` muestra, tienda a tienda y producto a producto, qué se ha podido leer y por qué falla lo demás.

La forma legítima de tener los precios de las tiendas que bloquean es su **feed de afiliados** (PcComponentes y Coolmod los ofrecen a través de redes como Awin): un archivo con todos sus productos y precios que se puede descargar con permiso.

## Puesta en marcha

```bash
npm install
npm run dev            # http://localhost:3000
```

Producción:

```bash
npm run build
NODE_ENV=production npm start
```

Al arrancar, el servidor tarda unos minutos en leer todos los precios por primera vez (la web muestra el progreso). Los precios se guardan en `data/prices.json` para no empezar de cero en cada reinicio; si el contenedor no tiene volumen, simplemente se vuelven a leer.

## Mantener el catálogo

```bash
npm run catalog:check                    # comprueba todo el catálogo contra las tiendas
npm run catalog:check gpu-rtx5070        # solo algunos productos
```

Muestra qué productos tienen precio, en qué tiendas, y qué URLs fallan (404, bloqueo, robots.txt, otro producto). Para añadir un producto o una tienda, edita `server/catalog.ts` (y `server/stores.ts` si la tienda es nueva).

## Scripts

- `npm run dev`: servidor con Vite en modo desarrollo
- `npm run build` / `npm start`: compilación y servidor de producción
- `npm test`: tests (lectura de precios, emparejado de modelos, robots.txt, motor de recomendación, API)
- `npm run lint`: comprobación de tipos
- `npm run catalog:check`: estado real del catálogo en las tiendas
