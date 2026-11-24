/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useRef, useState } from 'react';
import { FileDown, Loader2, RotateCcw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { bestOffer, checkCompatibility } from '../shared/compat';
import type { Build, PriceResult, RecommendRequest, StreamEvent } from '../shared/types';
import { ComponentCard, type PriceState } from './components/ComponentCard';
import { Sidebar, type Totals } from './components/Sidebar';
import { DEFAULT_FORM, Wizard } from './components/Wizard';
import { refreshPrices, streamRecommendation } from './lib/api';
import { eur } from './lib/format';

export default function App() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<RecommendRequest>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [build, setBuild] = useState<Build | null>(null);
  const [prices, setPrices] = useState<Record<string, PriceState>>({});
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [mainLaptopId, setMainLaptopId] = useState<string | null>(null);
  const [pdfDone, setPdfDone] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleEvent = (ev: StreamEvent) => {
    switch (ev.type) {
      case 'status':
        setStatus(ev.message);
        break;
      case 'build':
        setBuild(ev.build);
        setMainLaptopId(ev.build.components.find((c) => c.type === 'laptop')?.id ?? null);
        setPrices(Object.fromEntries(ev.build.components.map((c) => [c.id, 'loading' as const])));
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        break;
      case 'prices':
        setPrices((p) => ({ ...p, [ev.componentId]: ev.result }));
        break;
      case 'error':
        setError(ev.error);
        break;
      case 'done':
        setStatus('');
        break;
    }
  };

  const handleSubmit = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError('');
    setStatus('Conectando…');
    setBuild(null);
    setPrices({});
    try {
      await streamRecommendation(form, handleEvent, ctrl.signal);
    } catch (err: any) {
      if (err?.name !== 'AbortError') setError(err?.message || 'Hubo un problema de conexión. Inténtalo de nuevo.');
    } finally {
      if (abortRef.current === ctrl) {
        setLoading(false);
        setStatus('');
        // Lo que no llegó a tener precio deja de mostrarse como "buscando".
        setPrices((p) =>
          Object.fromEntries(
            Object.entries(p).map(([id, v]) => [
              id,
              v === 'loading' ? ({ offers: [], checkedAt: new Date().toISOString(), queries: [], fromCache: false, error: 'No se pudo completar la búsqueda de precios.' } as PriceResult) : v,
            ]),
          ),
        );
      }
    }
  };

  const reset = () => {
    abortRef.current?.abort();
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
      const result = await refreshPrices(c);
      setPrices((p) => ({ ...p, [id]: result }));
    } catch (err: any) {
      setError(err?.message || 'No se pudieron actualizar los precios.');
    } finally {
      setRefreshing((r) => ({ ...r, [id]: false }));
    }
  };

  // Componentes que suman: en portátiles solo cuenta el elegido (más periféricos).
  const { counted, alternatives } = useMemo(() => {
    const comps = build?.components ?? [];
    return {
      counted: comps.filter((c) => c.type !== 'laptop' || c.id === mainLaptopId),
      alternatives: comps.filter((c) => c.type === 'laptop' && c.id !== mainLaptopId),
    };
  }, [build, mainLaptopId]);

  const totals: Totals = useMemo(() => {
    const t: Totals = { total: 0, counted: counted.length, priced: 0, pending: 0, missing: 0, missingEstimate: 0, verified: 0 };
    for (const c of counted) {
      const p = prices[c.id];
      if (p === 'loading' || p === undefined) {
        t.pending++;
        continue;
      }
      const best = bestOffer(p.offers);
      if (best) {
        t.total += best.price;
        t.priced++;
        if (best.status === 'verified') t.verified++;
      } else {
        t.missing++;
        t.missingEstimate += c.estimatedPrice;
      }
    }
    t.total = Math.round(t.total * 100) / 100;
    return t;
  }, [counted, prices]);

  const checks = useMemo(() => checkCompatibility(build?.components ?? []), [build]);

  const handleExportPDF = async () => {
    if (!build) return;
    const { exportBuildPdf } = await import('./lib/pdf'); // jsPDF solo se descarga al exportar
    exportBuildPdf({
      build,
      counted,
      alternatives,
      prices: prices as Record<string, PriceResult | 'loading' | undefined>,
      total: totals.total,
      partial: totals.missing + totals.pending > 0,
    });
    setPdfDone(true);
    setTimeout(() => setPdfDone(false), 2000);
  };

  // Orden: el portátil elegido primero, luego alternativas, luego el resto.
  const ordered = build ? [...counted.filter((c) => c.type === 'laptop'), ...alternatives, ...counted.filter((c) => c.type !== 'laptop')] : [];

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#00FF66] selection:text-black">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <header className="flex justify-between items-center pb-8 border-b border-white/10 mb-10">
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic">KreaPC</h1>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#00FF66] font-bold mt-1">Motor de Selección de Alto Rendimiento</p>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-50">{build ? 'Total con precios reales' : 'Precios en tiempo real'}</p>
            <p className="text-5xl font-black font-mono text-[#00FF66]">{build ? eur(totals.total) : '—'}</p>
          </div>
        </header>

        <div className="mb-12">
          <h2 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-4">00 / Configuración Inicial</h2>
          <Wizard form={form} setForm={setForm} step={step} setStep={setStep} loading={loading} onSubmit={handleSubmit} />

          <AnimatePresence>
            {loading && status && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 mt-4 px-1 text-xs font-mono uppercase tracking-widest text-white/60">
                <Loader2 className="w-4 h-4 animate-spin text-[#00FF66]" />
                {status}
              </motion.div>
            )}
          </AnimatePresence>
          {error && <p className="text-red-400 mt-4 text-xs font-mono uppercase px-1">{error}</p>}
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
                  <p className="text-[10px] uppercase tracking-widest text-white/40 text-right">
                    {totals.pending > 0 ? (
                      <span className="text-[#00FF66]">Consultando tiendas…</span>
                    ) : (
                      <>Precios de tiendas españolas</>
                    )}
                  </p>
                </div>

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
                    disabled={totals.pending > 0}
                    className="flex-1 bg-white text-black py-5 px-8 font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#00FF66] transition-colors disabled:opacity-40 disabled:hover:bg-white"
                  >
                    <FileDown className="w-5 h-5" />
                    {pdfDone ? 'PDF Generado' : totals.pending > 0 ? 'Esperando precios…' : 'Exportar PDF'}
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
