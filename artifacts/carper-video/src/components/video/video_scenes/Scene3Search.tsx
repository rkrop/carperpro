import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Search, CheckCircle, Settings } from 'lucide-react';

export function Scene3Search() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000), // start typing
      setTimeout(() => setPhase(3), 4000), // finish typing
      setTimeout(() => setPhase(4), 5000), // searching
      setTimeout(() => setPhase(5), 6500), // result
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const query = "Bomba de agua Jetta 2018";

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center px-[10vw]"
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full max-w-[60vw]">
        <motion.h2 
          className="text-[4vw] font-bold text-white mb-10 leading-[1.1] text-center"
          style={{ fontFamily: 'var(--font-display)' }}
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        >
          Búsqueda <span className="text-accent">inteligente</span>.<br />
          Encuentre la pieza exacta.
        </motion.h2>

        <motion.div 
          className="relative w-full bg-white/10 border border-white/20 rounded-full h-[6vw] flex items-center px-[2vw] shadow-2xl overflow-hidden backdrop-blur-lg"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={phase >= 1 ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <Search className="text-white/50 w-[2.5vw] h-[2.5vw] mr-[1.5vw] shrink-0" />
          
          <div className="flex-1 flex items-center h-full relative">
            <span className="text-[2vw] font-medium text-white whitespace-pre">
              {query.split('').map((char, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ delay: phase >= 2 ? i * 0.05 : 0 }}
                >
                  {char}
                </motion.span>
              ))}
            </span>
            
            {/* Cursor */}
            <motion.div 
              className="w-[2px] h-[3vw] bg-accent ml-1"
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          </div>

          <motion.div 
            className="absolute right-2 top-2 bottom-2 bg-accent rounded-full flex items-center justify-center px-[2vw]"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          >
            {phase >= 4 && phase < 5 ? (
              <motion.div 
                className="w-[2vw] h-[2vw] border-4 border-white/30 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            ) : phase >= 5 ? (
              <CheckCircle className="w-[2vw] h-[2vw] text-white" />
            ) : (
              <Search className="w-[2vw] h-[2vw] text-white" />
            )}
          </motion.div>
        </motion.div>

        {/* Result Card */}
        <div className="mt-8 relative h-[15vw] flex justify-center">
          <motion.div
            className="absolute top-0 w-full max-w-[40vw] bg-white rounded-2xl p-[2vw] flex items-center gap-[2vw] shadow-2xl"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={phase >= 5 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: "spring", damping: 20, stiffness: 200 }}
          >
            <div className="w-[8vw] h-[8vw] bg-gray-100 rounded-xl flex items-center justify-center">
              <Settings className="w-[4vw] h-[4vw] text-gray-400" />
            </div>
            <div>
              <div className="text-[0.8vw] text-gray-500 font-bold uppercase tracking-wider mb-1">COMPATIBLE - OEM 06H121026CQ</div>
              <div className="text-[1.8vw] font-bold text-gray-900 leading-tight">Bomba de Agua Completa</div>
              <div className="text-[1.2vw] text-gray-600">Volkswagen Jetta 2.0L 2018</div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
