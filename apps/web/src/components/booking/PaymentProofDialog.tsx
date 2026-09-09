import { useState } from "react";
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
import { uploadPaymentProof, type Booking } from "@/lib/api";
import { formatSlotRange } from "@/lib/format";
import { isImageUrl } from "@/lib/media";

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
  const [url, setUrl] = useState(booking?.payment_proof_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = booking !== null && booking.status === "pending";
  const hasProof = !!booking?.payment_proof_url?.trim();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!booking || !url.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await uploadPaymentProof(booking.id, url.trim());
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
                Send the downpayment via GCash, paste the screenshot link
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
                <Label htmlFor="proof-url" className="text-sm font-medium">
                  {hasProof ? "Replace with a new link" : "GCash screenshot link"}
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Paste a link to your GCash receipt (Google Drive, Imgur…)
                </p>
                <Input
                  id="proof-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…"
                  inputMode="url"
                  className="mt-1.5"
                />
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
                  disabled={saving || !url.trim()}
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
