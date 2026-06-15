import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Smartphone, Monitor, ShoppingBag, ArrowRight } from 'lucide-react';

export function Scene5Purchase() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000), // phone appears
      setTimeout(() => setPhase(3), 3500), // monitor appears
      setTimeout(() => setPhase(4), 5500), // merge to package
      setTimeout(() => setPhase(5), 7000), // text reveal
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center px-[10vw]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -100 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.h2 
        className="text-[4vw] font-bold text-white mb-[5vw] text-center"
        style={{ fontFamily: 'var(--font-display)' }}
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      >
        Compre desde la app o sitio web.<br />
        <span className="text-gray-400 text-[2.5vw] font-normal">Fácil, rápido y seguro.</span>
      </motion.h2>

      <div className="relative w-[50vw] h-[25vw] flex items-center justify-center">
        
        {/* Phone */}
        <AnimatePresence mode="wait">
          {phase >= 2 && phase < 4 && (
            <motion.div 
              className="absolute bg-gradient-to-tr from-gray-800 to-gray-700 w-[12vw] h-[24vw] rounded-[2vw] border-4 border-gray-600 shadow-2xl flex flex-col overflow-hidden z-20"
              initial={{ x: -100, opacity: 0, rotate: -10 }}
              animate={{ x: '-12vw', opacity: 1, rotate: -5 }}
              exit={{ scale: 0, opacity: 0 }}
              key="phone"
            >
              <div className="bg-gray-900 w-full h-[15%] shrink-0 flex items-center justify-center">
                <div className="w-[3vw] h-[0.5vw] bg-gray-800 rounded-full" />
              </div>
              <div className="flex-1 p-[1vw] flex flex-col gap-[1vw]">
                <div className="w-full h-[40%] bg-gray-600 rounded-[1vw]" />
                <div className="w-[80%] h-[1vw] bg-gray-500 rounded-full" />
                <div className="w-[60%] h-[1vw] bg-gray-500 rounded-full" />
                <div className="mt-auto w-full h-[3vw] bg-accent rounded-[1vw] flex items-center justify-center">
                  <div className="w-[40%] h-[0.8vw] bg-white rounded-full" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Monitor */}
        <AnimatePresence mode="wait">
          {phase >= 3 && phase < 4 && (
            <motion.div 
              className="absolute bg-gradient-to-tr from-gray-800 to-gray-700 w-[28vw] h-[18vw] rounded-[1vw] border-[0.5vw] border-gray-600 shadow-2xl flex flex-col overflow-hidden z-10"
              initial={{ x: 100, opacity: 0, rotate: 10 }}
              animate={{ x: '10vw', opacity: 1, rotate: 5 }}
              exit={{ scale: 0, opacity: 0 }}
              key="monitor"
            >
              <div className="bg-gray-900 w-full h-[15%] shrink-0 flex items-center px-[1vw] gap-[0.5vw]">
                <div className="w-[1vw] h-[1vw] bg-red-500 rounded-full" />
                <div className="w-[1vw] h-[1vw] bg-yellow-500 rounded-full" />
                <div className="w-[1vw] h-[1vw] bg-green-500 rounded-full" />
                <div className="ml-[1vw] w-[15vw] h-[1.5vw] bg-gray-800 rounded-sm" />
              </div>
              <div className="flex-1 p-[1.5vw] flex gap-[2vw]">
                <div className="w-[40%] h-full bg-gray-600 rounded-[1vw]" />
                <div className="flex-1 flex flex-col gap-[1vw]">
                  <div className="w-[80%] h-[1.5vw] bg-gray-500 rounded-full" />
                  <div className="w-[60%] h-[1vw] bg-gray-500 rounded-full" />
                  <div className="w-[50%] h-[1vw] bg-gray-500 rounded-full" />
                  <div className="mt-auto w-[60%] h-[3vw] bg-accent rounded-[0.5vw] flex items-center justify-center">
                    <div className="w-[40%] h-[0.8vw] bg-white rounded-full" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Package delivery */}
        <AnimatePresence>
          {phase >= 4 && (
            <motion.div
              className="absolute flex flex-col items-center justify-center bg-white rounded-full w-[16vw] h-[16vw] shadow-[0_0_50px_rgba(255,255,255,0.3)] z-30"
              initial={{ scale: 0, opacity: 0, rotate: -180 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", bounce: 0.5, duration: 1 }}
            >
              <ShoppingBag className="w-[8vw] h-[8vw] text-accent mb-[1vw]" />
              <div className="text-gray-900 font-bold text-[1.8vw] uppercase tracking-wide">En Camino</div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  );
}

// Ensure AnimatePresence is available in this file scope since we use it directly
import { AnimatePresence as FramerAnimatePresence } from 'framer-motion';
const AnimatePresence = FramerAnimatePresence;
