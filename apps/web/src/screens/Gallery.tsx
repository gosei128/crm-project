import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import PublicNav, { NavSentinel } from "@/components/public/PublicNav";
import PublicFooter from "@/components/public/PublicFooter";
import { getGallery, type GalleryPhoto } from "@/lib/api";
import { fallbackGallery } from "@/config/gallery";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export default function Gallery() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>(() => fallbackGallery());
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getGallery()
      .then((list) => {
        if (!cancelled && list.length > 0) setPhotos(list);
      })
      .catch(() => {
        // Offline fallback already in place.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useScrollReveal([photos.length]);

  const close = useCallback(() => setActive(null), []);
  const step = useCallback(
    (dir: -1 | 1) => {
      setActive((cur) =>
        cur === null ? cur : (cur + dir + photos.length) % photos.length,
      );
    },
    [photos.length],
  );

  const current = active !== null ? photos[active] : null;

  return (
    <div className="min-h-[100dvh] bg-parchment text-espresso">
      <PublicNav />
      <NavSentinel />
      <main className="mx-auto w-full max-w-6xl px-4 pt-24 pb-16">
        <div className="text-center">
          <p className="font-script text-2xl text-brass-deep">
            Owner&apos;s work
          </p>
          <h1 className="font-display mt-1 text-3xl tracking-wide uppercase sm:text-4xl">
            The gallery
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-espresso/65">
            Fresh cuts from the chair. Tap any photo to view it up close.
          </p>
        </div>

        {photos.length === 0 ? (
          <p className="mx-auto mt-10 max-w-md rounded-2xl border border-dashed border-espresso/20 px-4 py-10 text-center text-sm text-espresso/60">
            No showcase photos yet — check back after a busy week.
          </p>
        ) : (
          <ul className="reveal mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {photos.map((photo, i) => (
              <li key={photo.id}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`View photo: ${photo.alt || "showcase photo"}`}
                  className="group relative block h-full w-full overflow-hidden rounded-2xl border border-espresso/10 bg-cream text-left shadow-[0_2px_12px_-6px_rgb(43_33_24/0.25)] transition-transform active:scale-[0.98]"
                >
                  <img
                    src={photo.image_url}
                    alt={photo.alt || "Barbershop work photo"}
                    loading="lazy"
                    className="aspect-[4/5] h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                    onError={(e) => {
                      e.currentTarget.style.opacity = "0.25";
                    }}
                  />
                  <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-night/70 to-transparent p-3 pt-8 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <span className="min-w-0 truncate text-xs font-medium text-cream-ink">
                      {photo.caption || photo.alt}
                    </span>
                    <Expand
                      className="h-3.5 w-3.5 shrink-0 text-cream-ink"
                      aria-hidden="true"
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Dialog
        open={current !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent
          className="max-w-3xl border-espresso/15 bg-cream p-3 sm:p-4"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") step(1);
            if (e.key === "ArrowLeft") step(-1);
          }}
        >
          {current && (
            <>
              <DialogTitle className="sr-only">
                {current.alt || "Showcase photo"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {current.caption ?? current.alt} — photo {(active ?? 0) + 1} of{" "}
                {photos.length}. Use arrow keys to browse.
              </DialogDescription>
              <img
                key={current.id}
                src={current.image_url}
                alt={current.alt || "Barbershop work photo"}
                className="max-h-[70vh] w-full rounded-xl object-contain"
              />
              <div className="flex items-center justify-between gap-2 px-1 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-espresso/20 text-espresso hover:bg-espresso/5"
                  onClick={() => step(-1)}
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <p className="min-w-0 flex-1 truncate text-center text-xs text-espresso/65 tabular-nums">
                  {current.caption || current.alt} · {(active ?? 0) + 1}/
                  {photos.length}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-espresso/20 text-espresso hover:bg-espresso/5"
                  onClick={() => step(1)}
                  aria-label="Next photo"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <PublicFooter />
    </div>
  );
}
