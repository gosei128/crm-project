import { useEffect } from "react";

/**
 * Scroll reveal: adds `.is-visible` to every `.reveal` / `.reveal-1`
 * element as it enters the viewport (once). The fade + slide-up itself
 * lives in `index.css`, so markup just keeps the class names.
 *
 * Re-run the scan whenever `deps` change (e.g. async content like the
 * house-rules section mounting after load).
 */
export function useScrollReveal(deps: unknown[] = []) {
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(".reveal, .reveal-1"),
    );
    if (els.length === 0) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
    );
    els.forEach((el) => {
      if (!el.classList.contains("is-visible")) io.observe(el);
    });
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
