import Lenis from "lenis";

/**
 * Lenis smooth scroll, landing page only. Single shared instance so the nav
 * can smooth-scroll to anchors through it instead of fighting it with a
 * separate native smooth scroll.
 *
 * Respects `prefers-reduced-motion`: no Lenis instance is created then, and
 * anchor jumps stay instant.
 */

let lenis: Lenis | null = null;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Start Lenis. Returns a cleanup that destroys the instance. */
export function initLenis(): () => void {
  if (lenis || prefersReducedMotion()) return () => {};
  lenis = new Lenis({
    autoRaf: true,
    duration: 1.15,
    smoothWheel: true,
  });
  return () => {
    lenis?.destroy();
    lenis = null;
  };
}

/** Smooth-scroll to a section id. Falls back to native behavior. */
export function scrollToSection(id: string): void {
  if (lenis && !prefersReducedMotion()) {
    lenis.scrollTo(`#${id}`, { offset: -72, duration: 1.2 });
    return;
  }
  document.getElementById(id)?.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}
