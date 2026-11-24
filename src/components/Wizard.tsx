import { useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ColorPref, RecommendRequest } from '../../shared/types';

export const DEFAULT_FORM: RecommendRequest = {
  deviceType: 'Torre',
  useCase: '',
  budget: '',
  ram: 'Cualquiera',
  storage: 'Cualquiera',
  vram: 'Cualquiera',
  color: 'Indiferente',
  includePeripherals: false,
};

const USE_CASES = [
  { title: 'Gaming', desc: 'Máximos FPS y Ray Tracing' },
  { title: 'Productividad', desc: 'Ofimática, Web y Multitarea' },
  { title: 'Creación', desc: 'Vídeo, 3D y Diseño' },
  { title: 'Desarrollo', desc: 'Código, VMs y Docker' },
];

const BUDGETS = ['< 800€', '800€ - 1500€', '1500€ - 2500€', '> 2500€'];

function CustomSelect({ value, onChange, options, disabled }: { value: string; onChange: (val: string) => void; options: string[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        className={`w-full bg-[#111] border border-white/10 text-white p-4 font-mono text-sm flex justify-between items-center transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[#00FF66]/50'}`}
      >
        <span>{value}</span>
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 mt-1 bg-[#111] border border-white/10 z-50 shadow-xl overflow-hidden"
            >
              {options.map((opt) => (
                <div
                  key={opt}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  className={`p-4 font-mono text-sm cursor-pointer transition-colors ${value === opt ? 'bg-[#00FF66]/10 text-[#00FF66]' : 'text-white hover:bg-white/5'}`}
                >
                  {opt}
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <h3 className="text-2xl font-bold uppercase italic tracking-tighter">{title}</h3>
      {onBack && (
        <button type="button" onClick={onBack} className="text-[10px] uppercase tracking-widest hover:text-[#00FF66] transition-colors shrink-0">
          Volver
        </button>
      )}
    </div>
  );
}

const optionBtn = 'border border-white/20 hover:border-[#00FF66] hover:bg-[#00FF66]/5 transition-all text-left group';

export function Wizard({
  form,
  setForm,
  step,
  setStep,
  loading,
  onSubmit,
}: {
  form: RecommendRequest;
  setForm: (f: RecommendRequest) => void;
  step: number;
  setStep: (s: number) => void;
  loading: boolean;
  onSubmit: () => void;
}) {
  const summary = [form.deviceType, form.useCase, form.budget].filter(Boolean);
  return (
    <div className="border border-white/10 p-6 md:p-10 bg-[#080808] relative overflow-hidden">
      <div className="absolute top-0 left-0 h-1 bg-white/10 w-full">
        <motion.div className="h-full bg-[#00FF66]" initial={{ width: '0%' }} animate={{ width: `${(step / 3) * 100}%` }} />
      </div>

      {step > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {summary.map((s) => (
            <span key={s} className="text-[10px] uppercase tracking-widest font-bold border border-[#00FF66]/30 text-[#00FF66] px-2 py-1">
              {s}
            </span>
          ))}
        </div>
      )}

      {step === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-2">
          <StepHeader title="Selecciona el Formato" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { value: 'Torre' as const, tag: 'Montaje a medida', title: 'Torre (Sobremesa)' },
              { value: 'Portátil' as const, tag: 'Movilidad', title: 'Portátil' },
            ].map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setForm({ ...form, deviceType: o.value });
                  setStep(1);
                }}
                className={`${optionBtn} p-8`}
              >
                <span className="block text-[10px] uppercase font-bold tracking-widest text-[#00FF66] mb-2">{o.tag}</span>
                <span className="text-3xl font-black uppercase italic group-hover:text-[#00FF66] transition-colors">{o.title}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {step === 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-2">
          <StepHeader title="Uso Principal" onBack={() => setStep(0)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {USE_CASES.map((w) => (
              <button
                key={w.title}
                type="button"
                onClick={() => {
                  setForm({ ...form, useCase: w.title });
                  setStep(2);
                }}
                className={`${optionBtn} p-6`}
              >
                <span className="block text-xl font-bold uppercase group-hover:text-[#00FF66] transition-colors">{w.title}</span>
                <span className="text-[10px] uppercase font-mono text-white/40 mt-1 block">{w.desc}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-2">
          <StepHeader title="Presupuesto Objetivo" onBack={() => setStep(1)} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {BUDGETS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => {
                  setForm({ ...form, budget: b });
                  setStep(3);
                }}
                className={`${optionBtn} p-6 text-center`}
              >
                <span className="text-xl font-bold font-mono group-hover:text-[#00FF66] transition-colors">{b}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {step === 3 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-2">
          <StepHeader title="Especificaciones Adicionales (Opcional)" onBack={() => setStep(2)} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { key: 'ram' as const, label: 'Memoria RAM', options: ['Cualquiera', '16GB', '32GB', '64GB'] },
                { key: 'storage' as const, label: 'Almacenamiento', options: ['Cualquiera', '500GB', '1TB', '2TB', '4TB+'] },
                { key: 'vram' as const, label: 'VRAM (Gráfica)', options: ['Cualquiera', '8GB', '12GB', '16GB', '32GB'] },
                { key: 'color' as const, label: 'Estética', options: ['Indiferente', 'Negro', 'Blanco'] },
              ].map((f) => (
                <div key={f.key} className="flex flex-col gap-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{f.label}</label>
                  <CustomSelect
                    value={(form[f.key] as string | undefined) ?? f.options[0]}
                    onChange={(val) => setForm({ ...form, [f.key]: f.key === 'color' ? (val as ColorPref) : val })}
                    options={f.options}
                    disabled={loading || (f.key === 'color' && form.deviceType === 'Portátil')}
                  />
                </div>
              ))}
            </div>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center w-6 h-6 bg-white/5 border border-white/20 group-hover:border-[#00FF66] transition-colors">
                <input
                  type="checkbox"
                  className="absolute opacity-0 w-full h-full cursor-pointer"
                  checked={Boolean(form.includePeripherals)}
                  onChange={(e) => setForm({ ...form, includePeripherals: e.target.checked })}
                  disabled={loading}
                />
                {form.includePeripherals && <Check className="w-4 h-4 text-[#00FF66]" />}
              </div>
              <span className="text-sm font-bold uppercase tracking-widest text-white/80 group-hover:text-white transition-colors">Incluir Periféricos (Monitor, Teclado, Ratón)</span>
            </label>
            <div className="flex flex-col-reverse md:flex-row md:items-center justify-between gap-4">
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">
                Precios leídos directamente de las fichas de las tiendas · rendimiento según Tom's Hardware
              </p>
              <button
                type="submit"
                disabled={loading}
                className="w-full md:w-auto bg-white text-black hover:bg-[#00FF66] font-black uppercase tracking-widest px-10 py-4 transition-colors flex items-center justify-center disabled:opacity-50 disabled:hover:bg-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Procesando
                  </>
                ) : (
                  'Generar Configuración'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </div>
  );
}
