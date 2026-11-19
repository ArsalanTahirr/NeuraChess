import { useCallback, useEffect, useRef, useState } from 'react';
import moveSound from '@/assets/move.wav';
import captureSound from '@/assets/capture.wav';

export function useMoveSound(enabled: boolean) {
  const player = useRef<HTMLAudioElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    return () => {
      player.current?.pause();
      player.current = null;
    };
  }, [enabled]);

  const playClip = useCallback(async (capture: boolean) => {
    const source = capture ? captureSound : moveSound;
    const audio = (player.current ??= new Audio());
    if (audio.getAttribute('src') !== source) audio.src = source;
    audio.currentTime = 0;

    try {
      await audio.play();
      if (player.current === audio) setError(null);
    } catch (cause) {
      if (player.current !== audio || (cause as DOMException).name === 'AbortError') return;
      setError('Your browser could not play the sound. Check the site audio settings and try Test sound.');
    }
  }, []);

  const play = useCallback(async (capture: boolean) => {
    if (enabled) await playClip(capture);
  }, [enabled, playClip]);

  return { play, preview: () => { void playClip(false); }, error };
}
