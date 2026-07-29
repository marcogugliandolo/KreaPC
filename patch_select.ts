export function CustomSelect({ value, onChange, options, disabled }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative w-full">
      <div 
        onClick={() => !disabled && setOpen(!open)}
        className={`w-full bg-[#111] border border-white/10 text-white p-4 font-mono text-sm flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-white/30'}`}
      >
        <span>{value}</span>
        <ChevronDown className="w-4 h-4 text-white/40" />
      </div>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
              className="absolute top-full left-0 right-0 mt-1 bg-[#111] border border-white/10 z-50 shadow-xl"
            >
              {options.map(opt => (
                <div 
                  key={opt}
                  onClick={() => { onChange(opt); setOpen(false); }}
                  className={`p-4 font-mono text-sm cursor-pointer hover:bg-white/5 transition-colors ${value === opt ? 'text-[#00FF66]' : 'text-white'}`}
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
