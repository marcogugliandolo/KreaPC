/** Enlaces de búsqueda para cuando no encontramos una ficha con precio fiable. */
const clean = (q: string) => encodeURIComponent(q.replace(/[/",:()]/g, ' ').replace(/\s+/g, ' ').trim());

export const searchLinks = (query: string) => [
  { store: 'PcComponentes', url: `https://www.pccomponentes.com/buscar/?query=${clean(query)}` },
  { store: 'Amazon', url: `https://www.amazon.es/s?k=${clean(query)}` },
  { store: 'Coolmod', url: `https://www.coolmod.com/buscar/?search=${clean(query)}` },
  { store: 'Google Shopping', url: `https://www.google.es/search?tbm=shop&q=${clean(query)}` },
];
