/**
 * Homepage hero image — resolution order:
 *
 * 1. Owner upload via Shop Controls → Appearance (stored in the API,
 *    served from `/uploads/hero/`). Instant, no redeploy.
 * 2. `VITE_HERO_IMAGE_URL` env override (set in apps/web/.env).
 * 3. Bundled default below (`kabarbers.jpg`).
 *
 * TIPS:
 * - Prefer landscape, dark, high-contrast shots (clippers, chair, fade
 *   close-up). The overlay darkens the photo so text stays readable.
 * - Keep ALT text meaningful for screen readers.
 */

const ENV_HERO_IMAGE = import.meta.env?.VITE_HERO_IMAGE_URL as
  | string
  | undefined;

// Bundled local photo — Vite rewrites this to the hashed public URL.
import kabarbersPhoto from "../assets/images/kabarbers.jpg";

export const DEFAULT_HERO_IMAGE = kabarbersPhoto;

export const HERO_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=2000&auto=format&fit=crop";

export const HERO_IMAGE_ALT =
  "Barber giving a precision fade inside a dark, moody barbershop";

/** Effective hero image: env override wins, otherwise the constant above. */
export function getHeroImage(): string {
  const env = (ENV_HERO_IMAGE ?? "").trim();
  return env.length > 0 ? env : DEFAULT_HERO_IMAGE;
}

/** API-uploaded hero wins over everything when present. */
export function resolveHeroImage(
  uploadedUrl: string | null | undefined,
): string {
  if (uploadedUrl && uploadedUrl.trim()) return uploadedUrl.trim();
  return getHeroImage();
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
