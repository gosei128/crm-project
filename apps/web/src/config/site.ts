/**
 * HOW TO CHANGE THE HERO IMAGE LATER (pick one):
 *
 * 1. EASIEST — edit DEFAULT_HERO_IMAGE below and redeploy. Any https URL
 *    works (Unsplash, Cloudinary, your own hosting). Keep it a moody,
 *    dark barbershop photo ~2000px wide for crisp desktop + mobile.
 *
 * 2. NO-REBUILD per environment — set VITE_HERO_IMAGE_URL in
 *    apps/web/.env (or your host's env vars). It wins over the constant
 *    below. Example:
 *      VITE_HERO_IMAGE_URL=https://images.unsplash.com/photo-...?q=80&w=2000&auto=format&fit=crop
 *
 * 3. FROM THE OWNER DASHBOARD — open Shop Controls → Appearance, paste a
 *    URL to preview it live. (Preview is instant; making it permanent for
 *    all visitors still means option 1 or 2 + redeploy — that card shows
 *    you the exact snippet to paste.)
 *
 * TIPS:
 * - Prefer landscape, dark, high-contrast shots (clippers, chair, fade
 *   close-up). The overlay darkens the left 2/3 so white text stays readable.
 * - Unsplash: append `?q=80&w=2000&auto=format&fit=crop` for optimized CDN
 *   delivery. Hotlinking Unsplash is allowed via their CDN.
 * - Keep ALT text meaningful for screen readers.
 */

const ENV_HERO_IMAGE = import.meta.env?.VITE_HERO_IMAGE_URL as
  | string
  | undefined;

export const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=2000&auto=format&fit=crop";

export const HERO_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=2000&auto=format&fit=crop";

export const HERO_IMAGE_ALT =
  "Barber giving a precision fade inside a dark, moody barbershop";

/** Effective hero image: env override wins, otherwise the constant above. */
export function getHeroImage(): string {
  const env = (ENV_HERO_IMAGE ?? "").trim();
  return env.length > 0 ? env : DEFAULT_HERO_IMAGE;
}

/** Copy-paste snippet the Appearance card shows after previewing a URL. */
export function heroImageSnippet(url: string): string {
  return `export const DEFAULT_HERO_IMAGE =\n  "${url}";`;
}

export const HERO_COPY = {
  eyebrow: "Welcome to",
  titleBrand: "Kabarbers",
  statusOpen: "Open today in Malolos",
  statusClosed: "Closed today. Bookings open again soon",
  subtitle:
    "Pick a slot online, lock it with GCash, walk straight to the chair. Strictly by appointment.",
  primaryCta: "Book Appointment",
  secondaryCta: "Schedule",
} as const;
