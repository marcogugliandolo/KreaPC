import { useState, type ReactNode } from 'react';
import { ChevronDown, CircleAlert, CircleCheck, CircleDashed, CircleX, ExternalLink, Loader2 } from 'lucide-react';
import { parseBudget, type CheckStatus, type CompatCheck } from '../../shared/compat';
import type { Build } from '../../shared/types';
import { eur, eurRound, hostOf } from '../lib/format';
import { GoogleSuggestions } from './GoogleSuggestions';

export interface Totals {
  total: number;
  counted: number;
  priced: number;
  pending: number;
  missing: number;
  missingEstimate: number;
  verified: number;
}

const CHECK_ICON: Record<CheckStatus, { Icon: typeof CircleCheck; cls: string }> = {
  ok: { Icon: CircleCheck, cls: 'text-[#00FF66]' },
  warn: { Icon: CircleAlert, cls: 'text-amber-300' },
  fail: { Icon: CircleX, cls: 'text-red-400' },
  unknown: { Icon: CircleDashed, cls: 'text-white/40' },
};

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-4">{children}</h2>;
}

export function Sidebar({ build, checks, totals }: { build: Build; checks: CompatCheck[]; totals: Totals }) {
  const [showSources, setShowSources] = useState(false);
  const range = parseBudget(build.budget);
  const over = range.max !== undefined ? totals.total - range.max : 0;
  const fill = range.max ? Math.min(100, (totals.total / range.max) * 100) : 0;
  const failed = checks.filter((c) => c.status === 'fail').length;
  const warned = checks.filter((c) => c.status === 'warn').length;

  return (
    <aside className="w-full md:w-80 flex flex-col gap-8 shrink-0">
      <section>
        <SectionTitle>01 / Análisis de la IA</SectionTitle>
        <div className="bg-white/5 p-6 border border-white/5 space-y-4">
          <p className="text-sm leading-relaxed text-white/80">{build.explanation}</p>
          <GoogleSuggestions html={build.searchSuggestionsHtml} />
          {build.sources.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-white/50 hover:text-[#00FF66] transition-colors"
              >
                Fuentes consultadas ({build.sources.length})
                <ChevronDown className={`w-3 h-3 transition-transform ${showSources ? 'rotate-180' : ''}`} />
              </button>
              {showSources && (
                <ul className="mt-2 space-y-1">
                  {build.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs font-mono text-white/60 hover:text-[#00FF66] break-all">
                        <ExternalLink className="w-3 h-3 shrink-0" /> {hostOf(s.url)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      {checks.length > 0 && (
        <section>
          <SectionTitle>02 / Compatibilidad</SectionTitle>
          <div className="border border-white/10 p-6 bg-[#080808]">
            <p className={`text-sm font-bold uppercase tracking-widest mb-4 ${failed ? 'text-red-400' : warned ? 'text-amber-300' : 'text-[#00FF66]'}`}>
              {failed ? `${failed} problema${failed > 1 ? 's' : ''} detectado${failed > 1 ? 's' : ''}` : warned ? 'Compatible, con avisos' : 'Todo compatible'}
            </p>
            <ul className="space-y-3">
              {checks.map((c) => {
                const { Icon, cls } = CHECK_ICON[c.status];
                return (
                  <li key={c.id} className="flex gap-3">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cls}`} />
                    <div>
                      <p className="text-[11px] uppercase font-bold tracking-widest">{c.label}</p>
                      <p className="text-xs text-white/50 leading-relaxed">{c.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-[10px] font-mono text-white/30 mt-4">Calculado a partir de las especificaciones de cada pieza.</p>
          </div>
        </section>
      )}

      <section>
        <SectionTitle>{checks.length > 0 ? '03' : '02'} / Presupuesto</SectionTitle>
        <div className="border border-white/10 p-6 bg-[#080808] space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">{totals.missing || totals.pending ? 'Total parcial (precios reales)' : 'Total con precios reales'}</p>
            <p className="text-4xl font-black font-mono text-[#00FF66] leading-tight">{eur(totals.total)}</p>
          </div>

          {range.max !== undefined && (
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest">
                <span className="text-white/50">Objetivo {build.budget}</span>
                <span className={over > 0 ? 'text-red-400' : 'text-[#00FF66]'}>{over > 0 ? `+${eurRound(over)}` : 'Dentro'}</span>
              </div>
              <div className="h-1 bg-white/10 w-full">
                <div className={`h-full transition-all duration-700 ${over > 0 ? 'bg-red-400' : 'bg-[#00FF66]'}`} style={{ width: `${fill}%` }} />
              </div>
            </div>
          )}

          <ul className="text-xs font-mono text-white/50 space-y-1">
            <li>
              {totals.priced}/{totals.counted} componentes con precio real
              {totals.verified > 0 && ` · ${totals.verified} verificados en tienda`}
            </li>
            {totals.pending > 0 && (
              <li className="flex items-center gap-2 text-white/60">
                <Loader2 className="w-3 h-3 animate-spin" /> {totals.pending} buscando precio…
              </li>
            )}
            {totals.missing > 0 && (
              <li className="text-amber-300/80">
                {totals.missing} sin precio fiable{totals.missingEstimate > 0 && ` (estimación IA ~${eurRound(totals.missingEstimate)})`}
              </li>
            )}
          </ul>
        </div>
      </section>
    </aside>
  );
}
