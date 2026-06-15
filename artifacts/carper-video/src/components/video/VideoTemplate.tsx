import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1Intro } from './video_scenes/Scene1Intro';
import { Scene2Catalog } from './video_scenes/Scene2Catalog';
import { Scene3Search } from './video_scenes/Scene3Search';
import { Scene4Scanner } from './video_scenes/Scene4Scanner';
import { Scene5Purchase } from './video_scenes/Scene5Purchase';
import { Scene6Outro } from './video_scenes/Scene6Outro';

export const SCENE_DURATIONS = {
  intro: 4000,
  catalog: 8000,
  search: 10000,
  scanner: 10000,
  purchase: 10000,
  outro: 6000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  intro: Scene1Intro,
  catalog: Scene2Catalog,
  search: Scene3Search,
  scanner: Scene4Scanner,
  purchase: Scene5Purchase,
  outro: Scene6Outro,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, ms] of Object.entries(SCENE_DURATIONS)) {
    out[key] = cumulativeMs / 1000;
    cumulativeMs += ms;
  }
  return out;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

// Background elements that react to scene changes
const bgOrbs = [
  // Scene 0: Intro (center focus)
  { top: '30vh', left: '40vw', scale: 1.5, opacity: 0.3, bg: '#2563EB' },
  // Scene 1: Catalog (spread out)
  { top: '10vh', left: '70vw', scale: 2.0, opacity: 0.2, bg: '#DC2626' },
  // Scene 2: Search (left focus)
  { top: '50vh', left: '10vw', scale: 1.2, opacity: 0.4, bg: '#2563EB' },
  // Scene 3: Scanner (center focus)
  { top: '40vh', left: '40vw', scale: 2.5, opacity: 0.2, bg: '#10B981' },
  // Scene 4: Purchase (right focus)
  { top: '20vh', left: '60vw', scale: 1.8, opacity: 0.3, bg: '#2563EB' },
  // Scene 5: Outro (center spread)
  { top: '35vh', left: '35vw', scale: 3.0, opacity: 0.2, bg: '#DC2626' },
];

const bgOrbsSecondary = [
  { top: '70vh', left: '60vw', scale: 1.0, opacity: 0.2, bg: '#DC2626' },
  { top: '60vh', left: '20vw', scale: 1.5, opacity: 0.3, bg: '#2563EB' },
  { top: '80vh', left: '80vw', scale: 0.8, opacity: 0.4, bg: '#10B981' },
  { top: '10vh', left: '20vw', scale: 1.2, opacity: 0.2, bg: '#2563EB' },
  { top: '70vh', left: '30vw', scale: 2.0, opacity: 0.2, bg: '#10B981' },
  { top: '60vh', left: '50vw', scale: 1.5, opacity: 0.4, bg: '#2563EB' },
];

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(
    /_r[12]$/,
    '',
  ) as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
    if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
      audio.currentTime = targetTime;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted]);

  return (
    <div
      className="w-full h-screen overflow-hidden relative"
      style={{ backgroundColor: 'var(--color-bg-light)' }}
    >
      {/* Persistent Background layer */}
      <div className="absolute inset-0 z-0">
        <motion.div 
          className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"
          animate={{ backgroundPosition: ['0px 0px', '100px 100px'] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        
        {/* Dynamic reactive orbs */}
        <motion.div
          className="absolute w-[30vw] h-[30vw] rounded-full blur-[100px] mix-blend-screen"
          animate={{
            top: bgOrbs[sceneIndex]?.top || '50vh',
            left: bgOrbs[sceneIndex]?.left || '50vw',
            scale: bgOrbs[sceneIndex]?.scale || 1,
            opacity: bgOrbs[sceneIndex]?.opacity || 0.2,
            backgroundColor: bgOrbs[sceneIndex]?.bg || '#2563EB',
          }}
          transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
        />
        
        <motion.div
          className="absolute w-[40vw] h-[40vw] rounded-full blur-[120px] mix-blend-screen"
          animate={{
            top: bgOrbsSecondary[sceneIndex]?.top || '50vh',
            left: bgOrbsSecondary[sceneIndex]?.left || '50vw',
            scale: bgOrbsSecondary[sceneIndex]?.scale || 1,
            opacity: bgOrbsSecondary[sceneIndex]?.opacity || 0.2,
            backgroundColor: bgOrbsSecondary[sceneIndex]?.bg || '#DC2626',
          }}
          transition={{ duration: 2.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
        <div className="w-full h-full" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '4vw 4vw' }}></div>
      </div>

      {/* Foreground Scenes */}
      <div className="relative z-10 w-full h-full">
        <AnimatePresence mode="popLayout">
          {SceneComponent && <SceneComponent key={currentSceneKey} />}
        </AnimatePresence>
      </div>

      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
    </div>
  );
}
