import { useState } from 'react';
import {
  BadgeCheck,
  Box,
  CircuitBoard,
  Cpu,
  ExternalLink,
  Fan,
  Gauge,
  Gpu,
  HardDrive,
  Keyboard,
  Laptop,
  Loader2,
  MemoryStick,
  Monitor,
  Mouse,
  RefreshCw,
  Search,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { bestOffer } from '../../shared/compat';
import { COMPONENT_LABELS, type BuildComponent, type ComponentType, type Offer, type PriceResult } from '../../shared/types';
import { ago, eur } from '../lib/format';
import { searchLinks } from '../lib/searchLinks';

const ICONS: Record<ComponentType, LucideIcon> = {
  cpu: Cpu,
  gpu: Gpu,
  motherboard: CircuitBoard,
  ram: MemoryStick,
  storage: HardDrive,
  psu: Zap,
  case: Box,
  cooler: Fan,
  laptop: Laptop,
  monitor: Monitor,
  keyboard: Keyboard,
  mouse: Mouse,
};

function Stock({ inStock }: { inStock: boolean | null }) {
  if (inStock === true) return <span className="text-[10px] font-mono text-white/60">En stock</span>;
  if (inStock === false) return <span className="text-[10px] font-mono text-red-400">Agotado</span>;
  return <span className="text-[10px] font-mono text-white/30">Stock sin indicar</span>;
}

function OfferRow({ offer, best, showTitle }: { offer: Offer; best: boolean; showTitle: boolean }) {
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className={`w-32 font-bold text-sm ${best ? 'text-[#00FF66]' : ''}`}>{offer.store}</span>
        <span className="flex-1 min-w-[160px] flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1 text-[9px] uppercase font-bold tracking-widest text-[#00FF66]" title="Precio leído de la ficha del producto en la tienda">
            <BadgeCheck className="w-3 h-3" /> Comprobado {ago(offer.checkedAt)}
          </span>
          <Stock inStock={offer.inStock} />
        </span>
        <span className="font-mono font-bold text-sm">{eur(offer.price)}</span>
        <a
          href={offer.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest text-[#00FF66] hover:text-white transition-colors"
        >
          Ir a la tienda <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      {showTitle && offer.title && <p className="text-[11px] text-white/40 mt-1 sm:pl-36 break-words">{offer.title}</p>}
    </li>
  );
}

export function ComponentCard({
  component,
  price,
  index,
  alternative,
  refreshing,
  onRemove,
  onRefresh,
  onMakeMain,
}: {
  component: BuildComponent;
  price: PriceResult | undefined;
  index: number;
  /** Portátil alternativo: no suma en el total. */
  alternative?: boolean;
  refreshing?: boolean;
  onRemove: () => void;
  onRefresh: () => void;
  onMakeMain?: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const Icon = ICONS[component.type];
  const offers = price?.offers ?? [];
  const best = bestOffer(offers);
  const visible = showAll ? offers : offers.slice(0, 4);
  // En gráficas el nombre del catálogo es el chip; cada tienda vende un modelo concreto.
  const showTitles = component.type === 'gpu' || component.type === 'motherboard' || component.type === 'ram';

  return (
    <motion.article
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 + index * 0.05, duration: 0.4 }}
      className={`group bg-white/[0.04] border-l-4 transition-colors ${alternative ? 'border-white/10 opacity-80' : best ? 'border-[#00FF66]/70' : 'border-white/20'} hover:bg-white/[0.07]`}
    >
      <div className="flex flex-col sm:flex-row gap-4 p-4 sm:p-5">
        <div className="w-11 h-11 shrink-0 bg-[#111] hidden sm:flex items-center justify-center text-white/60 group-hover:text-[#00FF66] transition-colors">
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-[10px] uppercase font-bold tracking-widest text-[#00FF66]">{COMPONENT_LABELS[component.type]}</p>
            {component.type === 'laptop' &&
              (alternative ? (
                <button type="button" onClick={onMakeMain} className="text-[9px] uppercase font-bold tracking-widest border border-white/20 px-2 py-0.5 hover:border-[#00FF66] hover:text-[#00FF66] transition-colors">
                  Elegir esta opción
                </button>
              ) : (
                <span className="text-[9px] uppercase font-bold tracking-widest bg-[#00FF66] text-black px-2 py-0.5">Opción elegida</span>
              ))}
          </div>
          <h3 className="text-lg font-bold tracking-tight leading-snug break-words">{component.name}</h3>
          {component.specs.summary && <p className="text-xs font-mono text-white/50 mt-1">{component.specs.summary}</p>}
          {component.reason && <p className="text-xs text-white/60 italic mt-2 leading-relaxed">{component.reason}</p>}
          {component.perfNote && (
            <p className="text-[11px] text-white/45 mt-2 flex items-start gap-1.5">
              <Gauge className="w-3.5 h-3.5 mt-px shrink-0 text-[#00FF66]/70" /> {component.perfNote}
            </p>
          )}
        </div>

        <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2 sm:min-w-[150px]">
          {refreshing ? (
            <div className="flex items-center gap-2 text-white/50 text-xs font-mono">
              <Loader2 className="w-4 h-4 animate-spin" /> Consultando tiendas…
            </div>
          ) : best ? (
            <div className="text-right">
              <p className="text-2xl font-mono font-bold leading-none">{eur(best.price)}</p>
              <p className="text-[10px] uppercase tracking-widest text-white/50 mt-1">
                Mejor precio · <span className="text-white/80">{best.store}</span>
              </p>
            </div>
          ) : (
            <p className="text-sm font-mono text-white/60 text-right">Sin precio comprobado</p>
          )}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="p-2 text-white/40 hover:text-[#00FF66] hover:bg-white/5 transition-colors disabled:opacity-30"
              title="Volver a leer los precios en las tiendas"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={onRemove} className="p-2 text-white/40 hover:text-red-500 hover:bg-white/5 transition-colors" title="Quitar componente">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {offers.length > 0 && (
        <div className="px-4 sm:px-5 pb-4">
          <ul className="divide-y divide-white/5 border-t border-white/10">
            {visible.map((o) => (
              <OfferRow key={o.url} offer={o} best={o === best} showTitle={showTitles} />
            ))}
          </ul>
          {offers.length > 4 && (
            <button type="button" onClick={() => setShowAll(!showAll)} className="mt-2 text-[10px] uppercase tracking-widest text-white/50 hover:text-[#00FF66]">
              {showAll ? 'Ver menos' : `Ver ${offers.length - 4} tiendas más`}
            </button>
          )}
        </div>
      )}

      {offers.length === 0 && (
        <div className="px-4 sm:px-5 pb-4">
          <div className="border-t border-white/10 pt-3">
            <p className="text-xs text-white/50 mb-2">{price?.error ?? 'Ninguna tienda publica ahora mismo un precio para este modelo exacto. Búscalo directamente:'}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {searchLinks(component.searchQuery).map((l) => (
                <a
                  key={l.store}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest text-white/70 hover:text-[#00FF66] transition-colors"
                >
                  <Search className="w-3 h-3" /> {l.store}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.article>
  );
}
