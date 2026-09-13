/**
 * Owner work showcase. Swap any entry with a real photo later:
 *
 * 1. Put the file in `apps/web/public/` (e.g. `apps/web/public/cut-1.jpg`),
 *    then set `src` to `/cut-1.jpg`. Files in `public/` are served as-is,
 *    no import needed.
 * 2. Or paste any https image URL as `src`.
 * 3. Update `alt` to describe the actual cut (screen readers read it).
 *
 * Until then these are seeded placeholders: same seed always returns the
 * same photo, so the layout previews exactly as it will with real shots.
 * Recommended shape is portrait 4:5, around 800x1000.
 */

export interface GalleryImage {
  src: string;
  alt: string;
}

export const GALLERY_IMAGES: GalleryImage[] = [
  {
    src: "../src/assets/images/samples/sample-1.jpg",
    alt: "Haircut portfolio placeholder 1",
  },
  {
    src: "../src/assets/images/samples/sample-2.jpg",
    alt: "Haircut portfolio placeholder 2",
  },
  {
    src: "../src/assets/images/samples/sample-3.jpg",
    alt: "Haircut portfolio placeholder 3",
  },
  {
    src: "../src/assets/images/samples/sample-6.jpg",
    alt: "Haircut portfolio placeholder 4",
  },
  {
    src: "../src/assets/images/samples/sample-7.jpg",
    alt: "Haircut portfolio placeholder 5",
  },
];
