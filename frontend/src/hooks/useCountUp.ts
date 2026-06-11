// useCountUp.ts — animates a number from 0 → target using rAF + ease-out cubic
import { useState, useEffect, useRef } from 'react';

/**
 * Returns an animated integer that counts from 0 to `target` over `duration` ms.
 * Re-runs whenever `target` changes.
 */
export function useCountUp(target: number, duration = 900): number {
  const [display, setDisplay] = useState(0);
  const rafRef  = useRef<number>(0);
  const prevRef = useRef(target);

  useEffect(() => {
    if (target === 0) { setDisplay(0); return; }

    const start    = prevRef.current === target ? 0 : display;
    const startAt  = performance.now();
    const delta    = target - start;

    cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const elapsed  = now - startAt;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic: decelerates into the target
      const eased    = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + eased * delta));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      else { setDisplay(target); prevRef.current = target; }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return display;
}
