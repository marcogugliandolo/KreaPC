/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { FileDown, Loader2, RotateCcw, TriangleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { bestOffer, checkCompatibility } from '../shared/compat';
import type { Build, PriceResult, PriceStatus, RecommendRequest } from '../shared/types';
import { ComponentCard } from './components/ComponentCard';
import { Sidebar, type Totals } from './components/Sidebar';
import { DEFAULT_FORM, Wizard } from './components/Wizard';
import { getRecommendation, getStatus, refreshPrices } from './lib/api';
import { eur } from './lib/format';

export default function App() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<RecommendRequest>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [build, setBuild] = useState<Build | null>(null);
  const [prices, setPrices] = useState<Record<string, PriceResult>>({});
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [mainLaptopId, setMainLaptopId] = useState<string | null>(null);
  const [pdfDone, setPdfDone] = useState(false);
  const [status, setStatus] = useState<PriceStatus | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  // Mientras el servidor lee precios en las tiendas, mostramos el progreso.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const s = await getStatus();
      setStatus(s);
      if (s && (!s.ready || s.refreshing)) timer = setTimeout(poll, 5000);
    };
    poll();
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getRecommendation(form);
      setBuild(res.build);
      setPrices(res.prices);
      setMainLaptopId(res.build.components.find((c) => c.type === 'laptop')?.id ?? null);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      setBuild(null);
      setError(err?.message || 'Hubo un problema de conexión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setBuild(null);
    setPrices({});
    setError('');
    setStep(0);
    setForm(DEFAULT_FORM);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeComponent = (id: string) => {
    if (!build) return;
    const components = build.components.filter((c) => c.id !== id);
    setBuild({ ...build, components });
    if (id === mainLaptopId) setMainLaptopId(components.find((c) => c.type === 'laptop')?.id ?? null);
  };

  const refresh = async (id: string) => {
    const c = build?.components.find((x) => x.id === id);
    if (!c) return;
    setRefreshing((r) => ({ ...r, [id]: true }));
    try {
      const url = c.type === 'laptop' ? prices[id]?.offers[0]?.url : undefined;
      const result = await refreshPrices(c, url);
      setPrices((p) => ({ ...p, [id]: result }));
    } catch (err: any) {
      setError(err?.message || 'No se pudieron actualizar los precios.');
    } finally {
      setRefreshing((r) => ({ ...r, [id]: false }));
    }
  };

  // En portátiles solo suma el elegido (y los periféricos).
  const { counted, alternatives } = useMemo(() => {
    const comps = build?.components ?? [];
    return {
      counted: comps.filter((c) => c.type !== 'laptop' || c.id === mainLaptopId),
      alternatives: comps.filter((c) => c.type === 'laptop' && c.id !== mainLaptopId),
    };
  }, [build, mainLaptopId]);

  const totals: Totals = useMemo(() => {
    const t: Totals = { total: 0, counted: counted.length, priced: 0, missing: 0 };
    for (const c of counted) {
      const best = bestOffer(prices[c.id]?.offers);
      if (!best) {
        t.missing++;
        continue;
      }
      t.total += best.price;
      t.priced++;
      if (!t.oldestCheck || best.checkedAt < t.oldestCheck) t.oldestCheck = best.checkedAt;
    }
    t.total = Math.round(t.total * 100) / 100;
    return t;
  }, [counted, prices]);

  const checks = useMemo(() => checkCompatibility(build?.components ?? []), [build]);

  const handleExportPDF = async () => {
    if (!build) return;
    const { exportBuildPdf } = await import('./lib/pdf'); // jsPDF solo se descarga al exportar
    exportBuildPdf({ build, counted, alternatives, prices, total: totals.total, partial: totals.missing > 0 });
    setPdfDone(true);
    setTimeout(() => setPdfDone(false), 2000);
  };

  const ordered = build ? [...counted.filter((c) => c.type === 'laptop'), ...alternatives, ...counted.filter((c) => c.type !== 'laptop')] : [];
  const warming = Boolean(status && !status.ready);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#00FF66] selection:text-black">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <header className="flex justify-between items-center pb-8 border-b border-white/10 mb-10">
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic">KreaPC</h1>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#00FF66] font-bold mt-1">Motor de Selección de Alto Rendimiento</p>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-50">{build ? 'Total con precios reales' : 'Precios de tiendas españolas'}</p>
            <p className="text-5xl font-black font-mono text-[#00FF66]">{build ? eur(totals.total) : '—'}</p>
          </div>
        </header>

        {status && (warming || status.refreshing) && (
          <div className="mb-6 flex items-center gap-3 text-xs font-mono uppercase tracking-widest text-white/60 border border-white/10 px-4 py-3 bg-white/[0.03]">
            <Loader2 className="w-4 h-4 animate-spin text-[#00FF66] shrink-0" />
            {warming
              ? `Leyendo precios en las tiendas por primera vez (${status.progress.done}/${status.progress.total} productos)…`
              : `Actualizando precios en segundo plano (${status.progress.done}/${status.progress.total})`}
          </div>
        )}

        <div className="mb-12">
          <h2 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-4">00 / Configuración Inicial</h2>
          <Wizard form={form} setForm={setForm} step={step} setStep={setStep} loading={loading} onSubmit={handleSubmit} />
          {error && <p className="text-red-400 mt-4 text-xs font-mono uppercase px-1 leading-relaxed">{error}</p>}
        </div>

        <AnimatePresence>
          {build && (
            <motion.div
              ref={resultsRef}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col md:flex-row gap-10"
            >
              <Sidebar build={build} checks={checks} totals={totals} />

              <section className="flex-1 flex flex-col min-w-0">
                <div className="flex justify-between items-end mb-6 gap-4">
                  <h2 className="text-xs uppercase tracking-widest font-bold text-white/40">{checks.length ? '04' : '03'} / Componentes y tiendas</h2>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 text-right">Precios de tiendas españolas</p>
                </div>

                {build.warnings.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {build.warnings.map((w) => (
                      <p key={w} className={`flex gap-2 text-xs leading-relaxed p-3 border ${build.overBudget ? 'border-red-400/40 text-red-300' : 'border-amber-300/30 text-amber-200/90'}`}>
                        <TriangleAlert className="w-4 h-4 shrink-0 mt-px" /> {w}
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex-1 space-y-3">
                  {ordered.map((c, idx) => (
                    <ComponentCard
                      key={c.id}
                      component={c}
                      index={idx}
                      price={prices[c.id]}
                      alternative={c.type === 'laptop' && c.id !== mainLaptopId}
                      refreshing={refreshing[c.id]}
                      onRemove={() => removeComponent(c.id)}
                      onRefresh={() => refresh(c.id)}
                      onMakeMain={() => setMainLaptopId(c.id)}
                    />
                  ))}
                </div>

                <div className="mt-10 flex gap-6 flex-col sm:flex-row">
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="flex-1 bg-white text-black py-5 px-8 font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#00FF66] transition-colors"
                  >
                    <FileDown className="w-5 h-5" />
                    {pdfDone ? 'PDF Generado' : 'Exportar PDF'}
                  </button>
                  <button type="button" onClick={reset} className="px-10 py-5 border border-white/20 font-bold uppercase tracking-widest hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
                    <RotateCcw className="w-4 h-4" /> Nueva Búsqueda
                  </button>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
