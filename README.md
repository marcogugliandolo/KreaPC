# KreaPC

Configurador de PC y portátiles con IA que te da **componentes actuales y precios reales de tiendas españolas**, con enlace directo a la ficha de cada producto.

## Cómo consigue los datos

1. **Selección de componentes**: Gemini con *Grounding with Google Search* busca qué se vende hoy en España y a qué precio, y devuelve una configuración compatible con sus especificaciones (socket, tipo de RAM, formato, consumo…).
2. **Precios por tienda**: para cada componente, Gemini busca en Google las fichas del producto en PcComponentes, Coolmod, Amazon, Wipoid, LDLC, Neobyte, MediaMarkt, etc.
3. **Verificación**: el servidor abre cada ficha y lee el precio y el stock de sus datos estructurados (schema.org / JSON-LD), comprobando que es el mismo modelo.
   - **Verificado en tienda**: precio leído de la propia ficha en ese momento.
   - **Precio en Google**: la tienda no deja leer la página, pero la URL sale de los resultados de Google y el precio es el que muestra Google.
   - Se descartan URLs inventadas, páginas que no existen, listados de búsqueda y productos de otra variante.
4. **Compatibilidad**: se calcula en código a partir de las especificaciones (socket, DDR, potencia de la fuente, formato placa/caja, longitud de la gráfica).

Los precios se cachean en memoria (3 h por defecto) y se pueden volver a consultar desde cada componente.

## Puesta en marcha

```bash
npm install
cp .env.example .env   # pon tu GEMINI_API_KEY
npm run dev            # desarrollo en http://localhost:3000
```

Producción:

```bash
npm run build
NODE_ENV=production npm start
```

Variables opcionales en `.env.example` (modelos, puerto, concurrencia, caché y límite de consultas por IP).

## Scripts

- `npm run dev`: servidor con Vite en modo desarrollo
- `npm run build` / `npm start`: compilación y servidor de producción
- `npm test`: tests (extracción de precios, URLs, compatibilidad y flujo completo con IA simulada)
- `npm run lint`: comprobación de tipos

## Coste de la API

Cada configuración hace 1 llamada para elegir componentes + 1 por componente para los precios, todas con búsqueda de Google. Con Gemini 3 se factura por búsqueda (las primeras 5.000 al mes son gratis). El límite por IP (`RATE_LIMIT_RECOMMEND_PER_HOUR`) protege tus créditos si la web es pública.
