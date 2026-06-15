import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';

export function Scene1Intro() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="text-center flex flex-col items-center z-10">
        <motion.div
          initial={{ opacity: 0, y: 50, rotateX: 45 }}
          animate={phase >= 1 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 50, rotateX: 45 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="mb-6 flex items-center justify-center"
        >
          <Shield className="w-[8vw] h-[8vw] text-accent mb-4" style={{ color: 'var(--color-accent)' }} />
        </motion.div>

        <h1 className="text-[6vw] font-black tracking-tight leading-[1.1]" style={{ fontFamily: 'var(--font-display)' }}>
          <span className="block overflow-hidden">
            <motion.span 
              className="block text-white"
              initial={{ y: '100%' }}
              animate={phase >= 1 ? { y: '0%' } : { y: '100%' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              El camino no se detiene.
            </motion.span>
          </span>
          <span className="block overflow-hidden mt-2">
            <motion.span 
              className="block text-gradient-accent"
              initial={{ y: '100%' }}
              animate={phase >= 2 ? { y: '0%' } : { y: '100%' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              Su vehículo tampoco.
            </motion.span>
          </span>
        </h1>
        
        <motion.div 
          className="w-[10vw] h-[4px] bg-white/20 mt-10 mx-auto overflow-hidden rounded-full"
          initial={{ opacity: 0 }}
          animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
        >
          <motion.div 
            className="h-full bg-accent"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
