import { useState } from 'react';
import {
  BadgeCheck,
  Box,
  CircuitBoard,
  Cpu,
  ExternalLink,
  Fan,
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
import { eur, eurRound, timeOf } from '../lib/format';
import { searchLinks } from '../lib/searchLinks';
import { GoogleSuggestions } from './GoogleSuggestions';

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

export type PriceState = PriceResult | 'loading' | undefined;

export function StatusBadge({ offer }: { offer: Offer }) {
  return offer.status === 'verified' ? (
    <span className="inline-flex items-center gap-1 text-[9px] uppercase font-bold tracking-widest text-[#00FF66]" title="Precio leído ahora mismo de la ficha del producto en la tienda">
      <BadgeCheck className="w-3 h-3" /> Verificado en tienda
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[9px] uppercase font-bold tracking-widest text-amber-300/90" title="Precio que muestra Google para esta ficha. La tienda no permite leer la página, puede variar.">
      <span className="w-3 h-3 rounded-full border border-current text-[7px] leading-[10px] text-center font-black">G</span> Precio en Google
    </span>
  );
}

function Stock({ inStock }: { inStock: boolean | null }) {
  if (inStock === true) return <span className="text-[10px] font-mono text-white/60">En stock</span>;
  if (inStock === false) return <span className="text-[10px] font-mono text-red-400">Agotado</span>;
  return <span className="text-[10px] font-mono text-white/30">Stock sin confirmar</span>;
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
  price: PriceState;
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
  const loading = price === 'loading' || refreshing;
  const result = typeof price === 'object' ? price : undefined;
  const offers = result?.offers ?? [];
  const best = bestOffer(offers);
  const visible = showAll ? offers : offers.slice(0, 4);

  return (
    <motion.article
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 + index * 0.06, duration: 0.4 }}
      className={`group bg-white/[0.04] border-l-4 transition-colors ${alternative ? 'border-white/10 opacity-80' : best ? 'border-[#00FF66]/70' : 'border-white/20'} hover:bg-white/[0.07]`}
    >
      {/* Cabecera */}
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
        </div>

        <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2 sm:min-w-[150px]">
          {loading ? (
            <div className="flex items-center gap-2 text-white/50 text-xs font-mono">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando precios…
            </div>
          ) : best ? (
            <div className="text-right">
              <p className="text-2xl font-mono font-bold leading-none">{eur(best.price)}</p>
              <p className="text-[10px] uppercase tracking-widest text-white/50 mt-1">
                Mejor precio · <span className="text-white/80">{best.store}</span>
              </p>
            </div>
          ) : (
            <div className="text-right">
              <p className="text-sm font-mono text-white/60">Sin precio fiable</p>
              {component.estimatedPrice > 0 && <p className="text-[10px] uppercase tracking-widest text-white/30 mt-1">Estimación IA ~{eurRound(component.estimatedPrice)}</p>}
            </div>
          )}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-2 text-white/40 hover:text-[#00FF66] hover:bg-white/5 transition-colors disabled:opacity-30"
              title="Volver a consultar precios"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={onRemove} className="p-2 text-white/40 hover:text-red-500 hover:bg-white/5 transition-colors" title="Quitar componente">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Ofertas */}
      {loading && price === 'loading' && (
        <div className="px-4 sm:px-5 pb-4 space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-9 bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      )}

      {!loading && offers.length > 0 && (
        <div className="px-4 sm:px-5 pb-4">
          <ul className="divide-y divide-white/5 border-t border-white/10">
            {visible.map((o) => (
              <li key={o.url} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                <span className={`w-32 font-bold text-sm ${o === best ? 'text-[#00FF66]' : ''}`}>{o.store}</span>
                <span className="flex-1 min-w-[140px] flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StatusBadge offer={o} />
                  <Stock inStock={o.inStock} />
                </span>
                <span className="font-mono font-bold text-sm">{eur(o.price)}</span>
                <a
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest text-[#00FF66] hover:text-white transition-colors"
                >
                  Ir a la tienda <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-between items-center gap-2 mt-2">
            <p className="text-[10px] font-mono text-white/30">
              Consultado a las {timeOf(result!.checkedAt)}
              {result!.fromCache ? ' (en caché)' : ''}
            </p>
            {offers.length > 4 && (
              <button type="button" onClick={() => setShowAll(!showAll)} className="text-[10px] uppercase tracking-widest text-white/50 hover:text-[#00FF66]">
                {showAll ? 'Ver menos' : `Ver ${offers.length - 4} tiendas más`}
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && result && offers.length === 0 && (
        <div className="px-4 sm:px-5 pb-4">
          <div className="border-t border-white/10 pt-3">
            <p className="text-xs text-white/50 mb-2">
              {result.error ?? 'No hemos encontrado una ficha con precio comprobable para este modelo exacto. Búscalo directamente:'}
            </p>
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

      {!loading && result?.searchSuggestionsHtml && (
        <div className="px-4 sm:px-5 pb-4">
          <GoogleSuggestions html={result.searchSuggestionsHtml} />
        </div>
      )}
    </motion.article>
  );
}
