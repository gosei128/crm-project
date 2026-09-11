import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CircleAlert, ExternalLink, Receipt } from "lucide-react";
import { uploadPaymentProofFile, type Booking } from "@/lib/api";
import { formatSlotRange } from "@/lib/format";
import { PROOF_ACCEPT, isImageUrl, validateProofFile } from "@/lib/media";

/**
 * Customer-facing dialog to add or update the GCash payment proof on a
 * PENDING booking. Render with `key={booking?.id ?? "none"}` so the form
 * resets when switching between bookings.
 */
export default function PaymentProofDialog({
  booking,
  serviceName = "Appointment",
  durationMinutes,
  onClose,
  onSaved,
}: {
  booking: Booking | null;
  serviceName?: string;
  durationMinutes?: number;
  onClose: () => void;
  onSaved: (updated: Booking) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = booking !== null && booking.status === "pending";
  const hasProof = !!booking?.payment_proof_url?.trim();

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    const validationError = validateProofFile(selected);
    if (validationError) {
      setFile(null);
      setError(validationError);
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!booking || !file) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await uploadPaymentProofFile(booking.id, file);
      onSaved(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={booking !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-accent" aria-hidden="true" />
            {hasProof ? "Update payment proof" : "Add payment proof"}
          </SheetTitle>
          <SheetDescription>
            {booking &&
              `${serviceName} · ${formatSlotRange(booking.slot_start, durationMinutes)}`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          {booking && !editable && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="font-medium">
                This booking is {booking.status.replace(/_/g, " ")}.
              </p>
              <p className="mt-1 text-muted-foreground">
                {booking.status === "booked"
                  ? "Your downpayment was confirmed — no further action needed."
                  : "Proof can only be updated while a booking is still pending."}
              </p>
            </div>
          )}

          {booking && editable && !hasProof && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <p className="font-medium text-amber-800">
                Your slot is held, not confirmed yet
              </p>
              <p className="mt-1 text-amber-700">
                Send the downpayment via GCash, upload a photo of the receipt
                below, and the owner will confirm your booking. Pending
                bookings expire 15 minutes after creation.
              </p>
            </div>
          )}

          {hasProof && booking && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Current proof
              </p>
              {isImageUrl(booking.payment_proof_url as string) ? (
                <a
                  href={booking.payment_proof_url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={booking.payment_proof_url as string}
                    alt="Your uploaded GCash payment proof"
                    className="w-full rounded-lg border object-contain"
                    loading="lazy"
                  />
                </a>
              ) : (
                <a
                  href={booking.payment_proof_url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border p-3 text-xs break-all text-blue-600 hover:underline"
                >
                  {booking.payment_proof_url}
                </a>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                render={
                  <a
                    href={booking.payment_proof_url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Open proof
              </Button>
            </div>
          )}

          {editable && (
            <form onSubmit={(e) => void handleSave(e)} className="space-y-2">
              <div>
                <Label htmlFor="proof-file" className="text-sm font-medium">
                  {hasProof ? "Replace with a new photo" : "GCash receipt photo"}
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  JPG, PNG, or WEBP · max 5 MB
                </p>
                <Input
                  id="proof-file"
                  type="file"
                  accept={PROOF_ACCEPT}
                  onChange={handleFileSelect}
                  className="mt-1.5 cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium"
                />
                {preview && (
                  <img
                    src={preview}
                    alt="Selected GCash payment proof preview"
                    className="mt-2 max-h-48 w-full rounded-lg border object-contain"
                  />
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 active:scale-[0.98]"
                  disabled={saving || !file}
                >
                  {saving
                    ? "Saving…"
                    : hasProof
                      ? "Update proof"
                      : "Save proof"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
