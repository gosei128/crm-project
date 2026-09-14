import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  ImagePlus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteGalleryPhoto,
  getGallery,
  updateGalleryPhoto,
  uploadGalleryPhoto,
  type GalleryPhoto,
} from "@/lib/api";
import { PROOF_ACCEPT, validateImageFile } from "@/lib/media";
import { useConfirmTap } from "@/hooks/useConfirmTap";
import { cn } from "@/lib/utils";

function GalleryRow({
  photo,
  isFirst,
  isLast,
  disabled,
  onChanged,
  onFailed,
  onMove,
}: {
  photo: GalleryPhoto;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  onChanged: () => void;
  onFailed: (msg: string) => void;
  onMove: (photo: GalleryPhoto, dir: -1 | 1) => void;
}) {
  const [alt, setAlt] = useState(photo.alt);
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [saving, setSaving] = useState(false);
  const dirty =
    alt.trim() !== photo.alt || (caption.trim() || "") !== (photo.caption ?? "");

  // Reset drafts when the list refreshes underneath us.
  useEffect(() => {
    setAlt(photo.alt);
    setCaption(photo.caption ?? "");
  }, [photo.alt, photo.caption]);

  async function handleSaveText() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await updateGalleryPhoto(photo.id, {
        alt: alt.trim(),
        caption: caption.trim() || null,
      });
      onChanged();
    } catch (e: unknown) {
      onFailed(e instanceof Error ? e.message : "Failed to save caption");
    } finally {
      setSaving(false);
    }
  }

  const { armed, tap, reset } = useConfirmTap();
  useEffect(() => {
    reset();
  }, [photo.id, reset]);

  async function handleDelete() {
    try {
      await deleteGalleryPhoto(photo.id);
      onChanged();
    } catch (e: unknown) {
      onFailed(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <li className="flex gap-3 rounded-xl border border-espresso/10 bg-cream p-3">
      <img
        src={photo.image_url}
        alt={photo.alt || "Showcase photo"}
        loading="lazy"
        className="h-20 w-16 shrink-0 rounded-lg border border-espresso/10 object-cover"
        onError={(e) => {
          e.currentTarget.style.opacity = "0.25";
        }}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Input
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          placeholder="Alt text (e.g. Classic taper fade)"
          aria-label="Photo alt text"
          className="h-8 text-xs"
          disabled={disabled || saving}
        />
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption (optional)"
          aria-label="Photo caption"
          className="h-8 text-xs"
          disabled={disabled || saving}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            disabled={disabled || saving || isFirst}
            onClick={() => onMove(photo, -1)}
            aria-label="Move photo earlier"
          >
            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            disabled={disabled || saving || isLast}
            onClick={() => onMove(photo, 1)}
            aria-label="Move photo later"
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            disabled={disabled || saving || !dirty}
            onClick={() => void handleSaveText()}
          >
            {saving ? "Saving…" : "Save text"}
          </Button>
          <Button
            size="sm"
            variant={armed ? "destructive" : "ghost"}
            className="h-7 px-2 text-xs"
            disabled={disabled || saving}
            onClick={() => tap(() => void handleDelete())}
            title="Delete this photo permanently"
            aria-label={
              armed ? "Tap again to delete this photo" : "Delete photo"
            }
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            {armed ? "Sure?" : <span className="sr-only">Delete</span>}
          </Button>
        </div>
      </div>
    </li>
  );
}

export default function GalleryManager() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPhotos(await getGallery());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load showcase");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        setPhotos(await getGallery());
      } catch (e: unknown) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load showcase");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function clearSelection() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    const problem = validateImageFile(selected);
    if (problem) {
      setFile(null);
      setError(problem);
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || busy) return;
    if (!alt.trim()) {
      setError("Give the photo a short alt text first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await uploadGalleryPhoto(file, alt.trim(), caption);
      clearSelection();
      setAlt("");
      setCaption("");
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(photo: GalleryPhoto, dir: -1 | 1) {
    const idx = photos.findIndex((p) => p.id === photo.id);
    const other = photos[idx + dir];
    if (!other || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Swap display positions.
      await updateGalleryPhoto(photo.id, { sort_order: other.sort_order });
      await updateGalleryPhoto(other.id, { sort_order: photo.sort_order });
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Reorder failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="animate-enter-2">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <span
          className="rounded-lg bg-accent-deep/10 p-1.5 text-accent-deep"
          aria-hidden="true"
        >
          <Camera className="h-4 w-4" />
        </span>
        <div>
          <CardTitle className="text-sm">Work showcase</CardTitle>
          <p className="text-xs font-normal text-muted-foreground">
            Photos on the homepage and the gallery page. First photo leads.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-2" aria-label="Loading showcase">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl bg-espresso/10"
              />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-espresso/20 px-4 py-6 text-center text-xs text-muted-foreground">
            No showcase photos yet. Upload the first cut below.
          </p>
        ) : (
          <ul className="space-y-2">
            {photos.map((photo, i) => (
              <GalleryRow
                key={photo.id}
                photo={photo}
                isFirst={i === 0}
                isLast={i === photos.length - 1}
                disabled={busy}
                onChanged={() => void refresh()}
                onFailed={setError}
                onMove={(p, dir) => void handleMove(p, dir)}
              />
            ))}
          </ul>
        )}

        <form
          onSubmit={(e) => void handleUpload(e)}
          className={cn(
            "space-y-2 rounded-xl border border-dashed border-espresso/20 p-3",
          )}
        >
          <Label
            htmlFor="gallery-file"
            className="flex items-center gap-1.5 text-xs font-medium"
          >
            <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
            Add a photo (JPG, PNG, or WEBP · max 5 MB)
          </Label>
          <Input
            id="gallery-file"
            ref={fileInputRef}
            type="file"
            accept={PROOF_ACCEPT}
            onChange={handleFileSelect}
            disabled={busy}
            className="cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-espresso/10 file:px-3 file:py-1.5 file:text-xs file:font-medium"
          />
          {preview && (
            <img
              src={preview}
              alt="New showcase photo preview"
              className="max-h-40 w-full rounded-lg border border-espresso/10 object-contain"
            />
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Alt text * (e.g. Classic taper fade)"
              aria-label="New photo alt text"
              className="h-8 text-xs"
              disabled={busy}
            />
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption (optional)"
              aria-label="New photo caption"
              className="h-8 text-xs"
              disabled={busy}
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={busy || !file}
            className="w-full sm:w-auto"
          >
            {busy ? "Uploading…" : "Upload photo"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
