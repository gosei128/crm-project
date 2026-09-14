import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Two-tap guard for destructive actions: first tap arms, second fires.
 * Auto-disarms after `timeoutMs`. Call `reset()` when context changes
 * (e.g. a different booking is shown).
 */
export function useConfirmTap(timeoutMs = 4000) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const reset = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setArmed(false);
  }, []);

  const tap = useCallback(
    (fire: () => void) => {
      if (armed) {
        reset();
        fire();
        return;
      }
      setArmed(true);
      timer.current = window.setTimeout(() => setArmed(false), timeoutMs);
    },
    [armed, reset, timeoutMs],
  );

  return { armed, tap, reset };
}
