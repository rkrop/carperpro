import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Real voice-to-text for the search bar, powered by `expo-speech-recognition`.
 *
 * - Native (iOS/Android): on-device / system speech recognition via the native module.
 * - Web (preview / PWA): the package's web implementation wraps the browser
 *   Web Speech API.
 *
 * The module is loaded defensively: in Expo Go the native module is not bundled,
 * so the require throws — we catch it and report `supported: false` instead of
 * crashing the whole app. Callers should fall back to typing in that case.
 */
let SpeechModule: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SpeechModule = require("expo-speech-recognition").ExpoSpeechRecognitionModule;
} catch {
  SpeechModule = null;
}

function recognitionAvailable(): boolean {
  if (!SpeechModule) return false;
  try {
    return SpeechModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export function useVoiceSearch(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => recognitionAvailable());
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // Subscribe to recognition lifecycle + result events.
  useEffect(() => {
    if (!SpeechModule) return;
    const subs: { remove: () => void }[] = [];
    try {
      subs.push(SpeechModule.addListener("start", () => setListening(true)));
      subs.push(SpeechModule.addListener("end", () => setListening(false)));
      subs.push(SpeechModule.addListener("error", () => setListening(false)));
      subs.push(
        SpeechModule.addListener("result", (e: any) => {
          const transcript: string = e?.results?.[0]?.transcript ?? "";
          const term = transcript.trim();
          if (e?.isFinal && term) onResultRef.current(term);
        }),
      );
    } catch {
      // events unavailable — leave listening untouched
    }
    return () => {
      for (const s of subs) {
        try {
          s.remove();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  /** Returns false if voice could not be started (unsupported or permission denied). */
  const start = useCallback(async (): Promise<boolean> => {
    if (!SpeechModule) return false;
    try {
      const perm = await SpeechModule.requestPermissionsAsync();
      if (!perm?.granted) {
        setListening(false);
        return false;
      }
      SpeechModule.start({
        lang: "es-MX",
        interimResults: false,
        continuous: false,
        maxAlternatives: 1,
      });
      return true;
    } catch {
      setListening(false);
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    if (!SpeechModule) return;
    try {
      SpeechModule.stop();
    } catch {
      // ignore
    }
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}
