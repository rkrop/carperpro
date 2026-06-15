import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Settings, Wrench, Battery, Cpu } from 'lucide-react';

export function Scene2Catalog() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 6000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const parts = [
    { icon: <Settings size="4vw" />, name: "Balatas", x: "-25vw", y: "-20vh", delay: 0 },
    { icon: <Wrench size="4vw" />, name: "Suspensión", x: "25vw", y: "-15vh", delay: 0.2 },
    { icon: <Battery size="4vw" />, name: "Baterías", x: "-20vw", y: "20vh", delay: 0.4 },
    { icon: <Cpu size="4vw" />, name: "Sensores", x: "20vw", y: "25vh", delay: 0.6 },
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.2, filter: 'blur(20px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0 flex items-center justify-center perspective-[1000px]">
        {parts.map((part, i) => (
          <motion.div
            key={i}
            className="absolute flex flex-col items-center justify-center bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0, x: 0, y: 0, rotateY: -30 }}
            animate={phase >= 2 ? { 
              opacity: 1, 
              scale: 1, 
              x: part.x, 
              rotateY: 10,
              rotateX: 10,
              y: [part.y, `calc(${part.y} - 2vh)`, part.y]
            } : { opacity: 0, scale: 0, x: 0, y: 0 }}
            transition={{ 
              duration: 1.2, 
              ease: [0.16, 1, 0.3, 1], 
              delay: part.delay,
              y: { duration: 4, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay: part.delay }
            }}
          >
            <div className="text-accent mb-3">{part.icon}</div>
            <span className="text-[1.5vw] font-medium text-white/80">{part.name}</span>
          </motion.div>
        ))}
      </div>

      <div className="text-center z-10">
        <motion.div
          className="text-[12vw] font-black tracking-tighter leading-none text-gradient mb-2"
          style={{ fontFamily: 'var(--font-display)' }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          14,000+
        </motion.div>
        <motion.p
          className="text-[3vw] font-medium text-white/80"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          refacciones a su alcance.
        </motion.p>
      </div>
    </motion.div>
  );
}
