/**
 * Owner work showcase.
 *
 * The live gallery comes from the API (`GET /gallery`) and is managed by
 * the owner in Shop Controls → Work showcase (upload, caption, reorder,
 * delete). What lives here is only the offline fallback: bundled sample
 * photos in `apps/web/public/samples/` (served as-is at `/samples/…`,
 * no import needed) shown if the API is unreachable.
 *
 * Recommended shape is portrait 4:5, around 800x1000.
 */

export interface GalleryImage {
  id: string;
  image_url: string;
  alt: string;
  caption: string | null;
  sort_order: number;
}

export const FALLBACK_GALLERY_IMAGES: GalleryImage[] = [
  { id: "sample-1", image_url: "/samples/sample-1.jpg", alt: "Classic taper fade", caption: null, sort_order: 0 },
  { id: "sample-2", image_url: "/samples/sample-2.jpg", alt: "Skin fade with textured top", caption: null, sort_order: 1 },
  { id: "sample-3", image_url: "/samples/sample-3.jpg", alt: "Scissor cut, natural finish", caption: null, sort_order: 2 },
  { id: "sample-4", image_url: "/samples/sample-4.jpg", alt: "Buzz cut with sharp lineup", caption: null, sort_order: 3 },
  { id: "sample-5", image_url: "/samples/sample-5.jpg", alt: "Pompadour with faded sides", caption: null, sort_order: 4 },
  { id: "sample-6", image_url: "/samples/sample-6.jpg", alt: "Crop cut, matte texture", caption: null, sort_order: 5 },
  { id: "sample-7", image_url: "/samples/sample-7.jpg", alt: "Beard trim and shape-up", caption: null, sort_order: 6 },
];

/**
 * Fallback list shaped like the API type (the API always returns
 * `created_at`; offline samples predate any timestamp, so empty string).
 */
export function fallbackGallery(): import("@/lib/api").GalleryPhoto[] {
  return FALLBACK_GALLERY_IMAGES.map((p) => ({ ...p, created_at: "" }));
}
