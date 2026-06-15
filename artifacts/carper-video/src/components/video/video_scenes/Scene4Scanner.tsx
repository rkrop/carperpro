import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ScanLine, Check } from 'lucide-react';

export function Scene4Scanner() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000), // start scan
      setTimeout(() => setPhase(3), 5000), // finish scan
      setTimeout(() => setPhase(4), 6000), // identify
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-0" />

      <div className="relative z-10 w-full flex flex-col items-center">
        <motion.h2 
          className="text-[3.5vw] font-bold text-white mb-[4vw] text-center px-[10vw]"
          style={{ fontFamily: 'var(--font-display)' }}
          initial={{ opacity: 0, y: -20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
        >
          Escáner por foto. <span className="text-emerald-400">Identificación automática.</span>
        </motion.h2>

        <motion.div 
          className="relative w-[30vw] h-[30vw] border-2 border-white/20 rounded-[2vw] flex items-center justify-center overflow-hidden bg-white/5 backdrop-blur-md"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={phase >= 1 ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Scanner corners */}
          <div className="absolute top-0 left-0 w-[4vw] h-[4vw] border-t-4 border-l-4 border-emerald-400 rounded-tl-[2vw]" />
          <div className="absolute top-0 right-0 w-[4vw] h-[4vw] border-t-4 border-r-4 border-emerald-400 rounded-tr-[2vw]" />
          <div className="absolute bottom-0 left-0 w-[4vw] h-[4vw] border-b-4 border-l-4 border-emerald-400 rounded-bl-[2vw]" />
          <div className="absolute bottom-0 right-0 w-[4vw] h-[4vw] border-b-4 border-r-4 border-emerald-400 rounded-br-[2vw]" />

          {/* Abstract car part icon in center */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={phase >= 1 ? { opacity: 0.5, scale: 1 } : { opacity: 0, scale: 0.8 }}
            className="w-[15vw] h-[15vw] text-white/50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </motion.div>

          {/* Laser scanning effect */}
          {phase >= 2 && phase < 4 && (
            <motion.div 
              className="absolute top-0 left-0 w-full h-[2vw] bg-gradient-to-b from-transparent via-emerald-400/50 to-transparent"
              initial={{ y: '-10vw' }}
              animate={{ y: '30vw' }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <div className="w-full h-[2px] bg-emerald-400 absolute top-1/2 -translate-y-1/2 shadow-[0_0_15px_rgba(52,211,153,1)]" />
            </motion.div>
          )}

          {/* Success overlay */}
          <AnimatePresence>
            {phase >= 4 && (
              <motion.div 
                className="absolute inset-0 bg-emerald-500/20 backdrop-blur-sm flex flex-col items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Check className="w-[8vw] h-[8vw] text-emerald-400 mb-2" />
                <span className="text-[1.5vw] font-bold text-emerald-400 uppercase tracking-widest">Pieza Identificada</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Identified Card Result */}
        <div className="mt-[3vw] h-[8vw]">
          <AnimatePresence>
            {phase >= 4 && (
              <motion.div
                className="bg-white rounded-xl py-[1vw] px-[2vw] flex items-center gap-[1.5vw] shadow-2xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="text-gray-900">
                  <div className="text-[1.5vw] font-bold leading-tight">Alternador Bosch 12V 90A</div>
                  <div className="text-[1vw] text-gray-500">ID: BSH-0986041830</div>
                </div>
                <div className="h-full w-[2px] bg-gray-200" />
                <div className="text-emerald-500 font-bold text-[1.8vw]">$3,450 MXN</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
