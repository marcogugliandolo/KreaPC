/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import { useState, useRef } from 'react';
import { Loader2, ChevronRight, Copy, ExternalLink, Check, Zap, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Component = {
  type: string;
  name: string;
  price: number;
  searchQuery: string;
};

type Recommendation = {
  explanation: string;
  components: Component[];
  totalPrice: number;
};

const IMAGE_MAP: Record<string, string> = {
  'cpu': 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&q=80&w=400',
  'gpu': 'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&q=80&w=400',
  'motherboard': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=400',
  'ram': 'https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&q=80&w=400',
  'storage': 'https://images.unsplash.com/photo-1597852074816-d933c7d2b988?auto=format&fit=crop&q=80&w=400',
  'psu': 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&q=80&w=400',
  'case': 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&q=80&w=400',
  'cooler': 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?auto=format&fit=crop&q=80&w=400',
  'laptop': 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&q=80&w=400',
  'monitor': 'https://images.unsplash.com/photo-1527443224154-c4a3942d4aff?auto=format&fit=crop&q=80&w=400',
  'keyboard': 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=400',
  'mouse': 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&q=80&w=400',
  'teclado': 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=400',
  'ratón': 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&q=80&w=400',
};

function getImageUrl(type: string) {
  const normalized = type.toLowerCase();
  return IMAGE_MAP[normalized] || 'https://images.unsplash.com/photo-15312971212e5-1d159e0007ab?auto=format&fit=crop&q=80&w=400';
}

export default function App() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    deviceType: 'Torre',
    useCase: '',
    budget: '',
    ram: 'Cualquiera',
    storage: 'Cualquiera',
    vram: 'Cualquiera',
    extraDetails: '',
    includePeripherals: false
  });
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError('');
    setRecommendation(null);

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Error al generar la recomendación.');
      }

      setRecommendation(data);
      
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      setError(err.message || 'Hubo un problema de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const removeComponent = (index: number) => {
    if (!recommendation) return;
    const newComponents = [...recommendation.components];
    const removedComp = newComponents.splice(index, 1)[0];
    setRecommendation({
      ...recommendation,
      components: newComponents,
      totalPrice: recommendation.totalPrice - removedComp.price
    });
  };

  const handleExportPDF = () => {
    if (!recommendation) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Header
    doc.setFillColor(5, 5, 5);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("KREAPC", 20, 22);
    
    doc.setTextColor(0, 255, 102);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("MOTOR DE SELECCION DE ALTO RENDIMIENTO", 20, 30);
    
    // Config info
    let yPos = 55;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Presupuesto de Hardware", 20, yPos);
    
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    const date = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Generado el: ${date}`, 20, yPos);
    
    yPos += 15;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPos, pageWidth - 20, yPos);
    
    yPos += 15;
    
    // Components
    recommendation.components.forEach((comp) => {
      // Check page break
      if (yPos > 260) {
        doc.addPage();
        yPos = 30;
      }
      
      // Component Type
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(150, 150, 150);
      doc.text(comp.type.toUpperCase(), 20, yPos);
      
      // Price
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Euro ${comp.price}`, pageWidth - 20, yPos, { align: "right" });
      
      yPos += 6;
      
      // Name
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 20, 20);
      
      // Handle long names
      const splitName = doc.splitTextToSize(comp.name, pageWidth - 60);
      doc.text(splitName, 20, yPos);
      
      yPos += (splitName.length * 6) + 10;
      
      // Line separator
      doc.setDrawColor(240, 240, 240);
      doc.line(20, yPos, pageWidth - 20, yPos);
      
      yPos += 10;
    });
    
    // Total
    yPos += 5;
    doc.setFillColor(245, 245, 245);
    doc.rect(20, yPos, pageWidth - 40, 20, 'F');
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("TOTAL ESTIMADO", 30, yPos + 13);
    
    doc.setFontSize(16);
    doc.setTextColor(0, 180, 70);
    doc.text(`Euro ${recommendation.totalPrice}`, pageWidth - 30, yPos + 14, { align: "right" });
    
    doc.save("KreaPC_Presupuesto.pdf");
    
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#00FF66] selection:text-black">
      <div className="max-w-5xl mx-auto px-6 py-8">
        
        {/* Header Section */}
        <header className="flex justify-between items-center pb-8 border-b border-white/10 mb-10">
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic">KREAPC</h1>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#00FF66] font-bold mt-1">Motor de Selección de Alto Rendimiento</p>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-50">Presupuesto Estimado</p>
            <p className="text-5xl font-black font-mono text-[#00FF66]">
              {recommendation ? `€${recommendation.totalPrice.toLocaleString('es-ES')}` : '€0.00'}
            </p>
          </div>
        </header>

        {/* Input Section */}
        <div className="mb-12">
          <h2 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-4">00 / Configuración Inicial</h2>
          
          <div className="border border-white/10 p-6 md:p-10 bg-[#080808] relative overflow-hidden">
             {/* Progress Bar */}
             <div className="absolute top-0 left-0 h-1 bg-white/10 w-full">
               <motion.div 
                 className="h-full bg-[#00FF66]"
                 initial={{ width: '0%' }}
                 animate={{ width: `${(step / 3) * 100}%` }}
               />
             </div>
             
             {step === 0 && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-2">
                 <h3 className="text-2xl font-bold uppercase italic tracking-tighter">Selecciona el Formato</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button 
                      onClick={() => { setFormData({...formData, deviceType: 'Torre'}); setStep(1); }}
                      className="border border-white/20 p-8 hover:border-[#00FF66] hover:bg-[#00FF66]/5 transition-all text-left group"
                    >
                      <span className="block text-[10px] uppercase font-bold tracking-widest text-[#00FF66] mb-2">MONTAJE A MEDIDA</span>
                      <span className="text-3xl font-black uppercase italic group-hover:text-[#00FF66] transition-colors">Torre (Sobremesa)</span>
                    </button>
                    <button 
                      onClick={() => { setFormData({...formData, deviceType: 'Portátil'}); setStep(1); }}
                      className="border border-white/20 p-8 hover:border-[#00FF66] hover:bg-[#00FF66]/5 transition-all text-left group"
                    >
                      <span className="block text-[10px] uppercase font-bold tracking-widest text-[#00FF66] mb-2">MOVILIDAD</span>
                      <span className="text-3xl font-black uppercase italic group-hover:text-[#00FF66] transition-colors">Portátil</span>
                    </button>
                 </div>
               </motion.div>
             )}

             {step === 1 && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-2">
                 <div className="flex justify-between items-center">
                   <h3 className="text-2xl font-bold uppercase italic tracking-tighter">Uso Principal</h3>
                   <button onClick={() => setStep(0)} className="text-[10px] uppercase tracking-widest hover:text-[#00FF66] transition-colors">Volver</button>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { id: 'gaming', title: 'Gaming', desc: 'Máximos FPS y Ray Tracing' },
                      { id: 'trabajo', title: 'Productividad', desc: 'Ofimática, Web y Multitarea' },
                      { id: 'edicion', title: 'Creación', desc: 'Vídeo, 3D y Diseño' },
                      { id: 'programacion', title: 'Desarrollo', desc: 'Código, VMs y Docker' }
                    ].map(workload => (
                      <button 
                        key={workload.id}
                        onClick={() => { setFormData({...formData, useCase: workload.title}); setStep(2); }}
                        className="border border-white/20 p-6 hover:border-[#00FF66] hover:bg-[#00FF66]/5 transition-all text-left group"
                      >
                        <span className="block text-xl font-bold uppercase group-hover:text-[#00FF66] transition-colors">{workload.title}</span>
                        <span className="text-[10px] uppercase font-mono text-white/40 mt-1 block">{workload.desc}</span>
                      </button>
                    ))}
                 </div>
               </motion.div>
             )}

             {step === 2 && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-2">
                 <div className="flex justify-between items-center">
                   <h3 className="text-2xl font-bold uppercase italic tracking-tighter">Presupuesto Objetivo</h3>
                   <button onClick={() => setStep(1)} className="text-[10px] uppercase tracking-widest hover:text-[#00FF66] transition-colors">Volver</button>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {['< 800€', '800€ - 1500€', '1500€ - 2500€', '> 2500€'].map(b => (
                      <button 
                        key={b}
                        onClick={() => { setFormData({...formData, budget: b}); setStep(3); }}
                        className="border border-white/20 p-6 hover:border-[#00FF66] hover:bg-[#00FF66]/5 transition-all text-center group"
                      >
                        <span className="text-xl font-bold font-mono group-hover:text-[#00FF66] transition-colors">{b}</span>
                      </button>
                    ))}
                 </div>
               </motion.div>
             )}

             {step === 3 && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-2">
                 <div className="flex justify-between items-center">
                   <h3 className="text-2xl font-bold uppercase italic tracking-tighter">Especificaciones Adicionales (Opcional)</h3>
                   <button onClick={() => setStep(2)} className="text-[10px] uppercase tracking-widest hover:text-[#00FF66] transition-colors">Volver</button>
                 </div>
                 
                 <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="flex flex-col gap-2">
                       <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Memoria RAM</label>
                       <select 
                         value={formData.ram}
                         onChange={(e) => setFormData({...formData, ram: e.target.value})}
                         className="w-full bg-[#111] border border-white/10 text-white p-4 font-mono text-sm focus:outline-none focus:border-[#00FF66] appearance-none cursor-pointer"
                         disabled={loading}
                       >
                         <option className="bg-[#111] text-white" value="Cualquiera">Cualquiera (Recomendado)</option>
                         <option className="bg-[#111] text-white" value="16GB">16GB</option>
                         <option className="bg-[#111] text-white" value="32GB">32GB</option>
                         <option className="bg-[#111] text-white" value="64GB">64GB</option>
                       </select>
                     </div>
                     <div className="flex flex-col gap-2">
                       <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Almacenamiento</label>
                       <select 
                         value={formData.storage}
                         onChange={(e) => setFormData({...formData, storage: e.target.value})}
                         className="w-full bg-[#111] border border-white/10 text-white p-4 font-mono text-sm focus:outline-none focus:border-[#00FF66] appearance-none cursor-pointer"
                         disabled={loading}
                       >
                         <option className="bg-[#111] text-white" value="Cualquiera">Cualquiera (Recomendado)</option>
                         <option className="bg-[#111] text-white" value="500GB">500GB</option>
                         <option className="bg-[#111] text-white" value="1TB">1TB</option>
                         <option className="bg-[#111] text-white" value="2TB">2TB</option>
                         <option className="bg-[#111] text-white" value="4TB+">4TB+</option>
                       </select>
                     </div>
                     <div className="flex flex-col gap-2">
                       <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">VRAM (Gráfica)</label>
                       <select 
                         value={formData.vram}
                         onChange={(e) => setFormData({...formData, vram: e.target.value})}
                         className="w-full bg-[#111] border border-white/10 text-white p-4 font-mono text-sm focus:outline-none focus:border-[#00FF66] appearance-none cursor-pointer"
                         disabled={loading}
                       >
                         <option className="bg-[#111] text-white" value="Cualquiera">Cualquiera (Recomendado)</option>
                         <option className="bg-[#111] text-white" value="8GB">8GB</option>
                         <option className="bg-[#111] text-white" value="12GB">12GB</option>
                         <option className="bg-[#111] text-white" value="16GB">16GB</option>
                         <option className="bg-[#111] text-white" value="24GB">24GB</option>
                       </select>
                     </div>
                   </div>
                   <label className="flex items-center gap-3 cursor-pointer group">
                     <div className="relative flex items-center justify-center w-6 h-6 bg-white/5 border border-white/20 group-hover:border-[#00FF66] transition-colors">
                       <input 
                         type="checkbox" 
                         className="absolute opacity-0 w-full h-full cursor-pointer"
                         checked={formData.includePeripherals}
                         onChange={(e) => setFormData({...formData, includePeripherals: e.target.checked})}
                         disabled={loading}
                       />
                       {formData.includePeripherals && <Check className="w-4 h-4 text-[#00FF66]" />}
                     </div>
                     <span className="text-sm font-bold uppercase tracking-widest text-white/80 group-hover:text-white transition-colors">
                       Incluir Periféricos (Monitor, Teclado, Ratón)
                     </span>
                   </label>
                   <textarea
                     value={formData.extraDetails}
                     onChange={(e) => setFormData({...formData, extraDetails: e.target.value})}
                     placeholder="Ej: Prefiero estética blanca, necesito mucho almacenamiento, tamaño compacto, pantalla OLED..."
                     className="w-full bg-white/5 border border-white/10 text-white p-4 font-mono text-sm placeholder-white/40 focus:outline-none focus:border-[#00FF66] resize-none h-24"
                     disabled={loading}
                   />
                   <div className="flex justify-end">
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
          {error && <p className="text-red-400 mt-4 text-xs font-mono uppercase px-4">{error}</p>}
        </div>

        {/* Results Section */}
        <AnimatePresence>
          {recommendation && (
            <motion.div 
              ref={resultsRef}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col md:flex-row gap-10"
            >
              <aside className="w-full md:w-80 flex flex-col gap-6">
                <div>
                  <h2 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-4">01 / Motor de Análisis</h2>
                  <div className="bg-white/5 p-6 border border-white/5">
                    <p className="text-xs font-mono mb-2 text-white/40">RECOMENDACIÓN DE LA IA:</p>
                    <p className="text-sm leading-relaxed italic text-white/80">"{recommendation.explanation}"</p>
                  </div>
                </div>

                <div className="border border-white/10 p-6 bg-[#080808] flex-1">
                  <h2 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-6">02 / Métricas del Sistema</h2>
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest">
                        <span>Compatibilidad</span>
                        <span className="text-[#00FF66]">100%</span>
                      </div>
                      <div className="h-1 bg-white/10 w-full">
                        <div className="h-full bg-[#00FF66]" style={{ width: '100%' }}></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest">
                        <span>Ajuste al Rendimiento</span>
                        <span className="text-[#00FF66]">96%</span>
                      </div>
                      <div className="h-1 bg-white/10 w-full">
                        <div className="h-full bg-[#00FF66]" style={{ width: '96%' }}></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-12 md:hidden">
                    <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 mb-1">Presupuesto Estimado</p>
                    <p className="text-5xl font-black font-mono text-[#00FF66]">
                      €{recommendation.totalPrice.toLocaleString('es-ES')}
                    </p>
                  </div>
                </div>
              </aside>

              <section className="flex-1 flex flex-col">
                <div className="flex justify-between items-end mb-6">
                  <h2 className="text-xs uppercase tracking-widest font-bold text-white/40">03 / Lista de Componentes</h2>
                  <p className="text-[10px] uppercase tracking-widest text-[#00FF66]">Actualizado</p>
                </div>

                <div className="flex-1 space-y-3">
                  {recommendation.components.map((comp, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + (idx * 0.1), duration: 0.5 }}
                      key={idx} 
                      className="group flex flex-col sm:flex-row sm:items-center bg-white/5 p-4 border-l-4 border-white/20 hover:border-[#00FF66] hover:bg-white/10 transition-colors"
                    >
                      <div className="w-12 h-12 bg-[#111] hidden sm:flex items-center justify-center mr-6 rounded text-xs font-mono text-white/60">
                        {comp.type.substring(0,3).toUpperCase()}
                      </div>
                      <div className="flex-1 mb-4 sm:mb-0">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-[#00FF66] sm:hidden mb-1">{comp.type}</p>
                        <h3 className="text-lg font-bold tracking-tight">{comp.name}</h3>
                        <p className="text-xs font-mono text-white/40 sm:hidden">{comp.type}</p>
                      </div>
                      <div className="text-left sm:text-right sm:mr-4">
                        <p className="text-lg font-mono font-bold mb-2">€{comp.price.toLocaleString('es-ES')}</p>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <a 
                            href={`https://www.pccomponentes.com/buscar/?query=${encodeURIComponent(comp.searchQuery)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] uppercase font-bold text-[#00FF66] underline decoration-2 underline-offset-4 hover:text-white transition-colors"
                          >
                            PcComponentes
                          </a>
                          <a 
                            href={`https://www.amazon.es/s?k=${encodeURIComponent(comp.searchQuery)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] uppercase font-bold text-[#00FF66] underline decoration-2 underline-offset-4 hover:text-white transition-colors"
                          >
                            Amazon
                          </a>
                          <a 
                            href={`https://www.coolmod.com/buscar/?search=${encodeURIComponent(comp.searchQuery)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] uppercase font-bold text-[#00FF66] underline decoration-2 underline-offset-4 hover:text-white transition-colors"
                          >
                            Coolmod
                          </a>
                          <a 
                            href={`https://www.wipoid.com/buscar?controller=search&s=${encodeURIComponent(comp.searchQuery)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] uppercase font-bold text-[#00FF66] underline decoration-2 underline-offset-4 hover:text-white transition-colors"
                          >
                            Wipoid
                          </a>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeComponent(idx)}
                        className="ml-4 p-2 text-white/40 hover:text-red-500 hover:bg-white/5 transition-colors self-start sm:self-center"
                        title="Eliminar componente"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-10 flex gap-6 flex-col sm:flex-row">
                  <button 
                    onClick={handleExportPDF}
                    className="flex-1 bg-white text-black py-5 px-8 font-black uppercase tracking-widest flex items-center justify-center hover:bg-[#00FF66] transition-colors"
                  >
                    {copied ? 'PDF Generado' : 'Exportar PDF'}
                  </button>
                  <button 
                    onClick={() => { setRecommendation(null); setStep(0); setFormData({ deviceType: 'Torre', useCase: '', budget: '', ram: 'Cualquiera', storage: 'Cualquiera', vram: 'Cualquiera', extraDetails: '', includePeripherals: false }); }}
                    className="px-10 py-5 border border-white/20 font-bold uppercase tracking-widest hover:bg-white/5 transition-colors"
                  >
                    Nueva Búsqueda
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

