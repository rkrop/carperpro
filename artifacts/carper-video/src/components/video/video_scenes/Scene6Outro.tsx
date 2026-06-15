import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

export function Scene6Outro() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <div className="flex flex-col items-center">
        {/* Brand Name */}
        <motion.div
          className="text-[6vw] font-black tracking-tighter text-white mb-[1vw] flex items-center gap-[2vw]"
          style={{ fontFamily: 'var(--font-display)' }}
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={phase >= 1 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 50, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div className="w-[6vw] h-[6vw] bg-accent rounded-[1vw] flex items-center justify-center shrink-0">
            <div className="w-[3vw] h-[3vw] border-4 border-white rounded-full border-t-transparent rotate-45" />
          </div>
          CARPER AUTOPARTES
        </motion.div>

        {/* Tagline */}
        <motion.div
          className="text-[2vw] text-gray-400 font-medium mb-[4vw]"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 1 }}
        >
          Su aliado en cada kilómetro.
        </motion.div>

        {/* CTA */}
        <motion.div
          className="bg-white text-black px-[3vw] py-[1.5vw] rounded-full flex items-center gap-[1vw] shadow-2xl"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <Download className="w-[2vw] h-[2vw]" />
          <span className="text-[1.8vw] font-bold">Descargue la app hoy</span>
        </motion.div>
      </div>
    </motion.div>
  );
}
