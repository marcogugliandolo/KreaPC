/** Enlaces de búsqueda para cuando no hay una ficha con precio comprobado. */
const clean = (q: string) => encodeURIComponent(q.replace(/[/",:()]/g, ' ').replace(/\s+/g, ' ').trim());

export const searchLinks = (query: string) => [
  { store: 'PcComponentes', url: `https://www.pccomponentes.com/buscar/?query=${clean(query)}` },
  { store: 'Coolmod', url: `https://www.coolmod.com/buscar/?search=${clean(query)}` },
  { store: 'Neobyte', url: `https://www.neobyte.es/index.php?controller=search&s=${clean(query)}` },
  { store: 'Amazon', url: `https://www.amazon.es/s?k=${clean(query)}` },
];
