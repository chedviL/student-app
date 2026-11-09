import { useLayoutEffect, useRef } from "react";

/**
 * Gives a container a short fade whenever `signature` changes (filter, sort,
 * search). Uses the Web Animations API on the existing element — nothing is
 * remounted, so it stays cheap even for long tables. Skipped on first render
 * and when the user prefers reduced motion.
 */
export function useFadeOnChange<T extends HTMLElement>(signature: string) {
  const ref = useRef<T>(null);
  const first = useRef(true);

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (!el || typeof el.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(
      [{ opacity: 0.35 }, { opacity: 1 }],
      { duration: 180, easing: "ease-out" },
    );
  }, [signature]);

  return ref;
}
