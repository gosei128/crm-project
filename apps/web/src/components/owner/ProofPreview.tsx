import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Check, Copy, ExternalLink, Receipt } from "lucide-react";
import type { Booking } from "@/lib/api";
import { formatDateTime, formatSlot } from "@/lib/format";
import { isImageUrl, isPrivateProofUrl } from "@/lib/media";
import { useProofImage } from "@/hooks/useProofImage";

export default function ProofPreview({
  booking,
  onClose,
  onCancel,
  actionLoading,
}: {
  booking: Booking | null;
  onClose: () => void;
  onCancel: (b: Booking) => void;
  actionLoading: string | null;
}) {
  // Track *which* booking was copied — no effect needed, resets per booking.
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copied = copiedId === booking?.id;

  // Two-tap guard for rejecting the proof (cancels the hold).
  const [confirmingReject, setConfirmingReject] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    setConfirmingReject(false);
  }, [booking?.id]);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  function handleReject() {
    if (!booking) return;
    if (confirmingReject) {
      if (timer.current !== null) window.clearTimeout(timer.current);
      setConfirmingReject(false);
      onCancel(booking);
      return;
    }
    setConfirmingReject(true);
    timer.current = window.setTimeout(() => setConfirmingReject(false), 4000);
  }

  async function handleCopy() {
    const code = booking?.reference_code ?? booking?.payment_proof_url;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(booking?.id ?? null);
    } catch {
      setCopiedId(null);
    }
  }

  function handleOpen() {
    if (src) window.open(src, "_blank", "noopener,noreferrer");
    else if (proofUrl && !isPrivateProofUrl(proofUrl))
      window.open(proofUrl, "_blank", "noopener,noreferrer");
  }

  const proofUrl = booking?.payment_proof_url ?? null;
  const { src, loading: proofLoading, error: proofError } = useProofImage(
    booking?.id,
    proofUrl,
  );

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
            <Receipt className="h-4 w-4 text-accent-deep" aria-hidden="true" />
            Payment proof
          </SheetTitle>
          <SheetDescription>
            {booking && (
              <>
                {booking.customer_name ?? "Customer"}
                {" · "}
                {formatSlot(booking.slot_start)}
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          {booking && (
            <dl className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Customer</dt>
                <dd className="mt-0.5 font-medium">{booking.customer_name ?? "Not given"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                    {booking.customer_phone ?? "Not given"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Slot</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {formatSlot(booking.slot_start)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Booked at</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {formatDateTime(booking.created_at)}
                </dd>
              </div>
              {booking.reference_code && (
                <div>
                  <dt className="text-muted-foreground">Ref code</dt>
                  <dd className="mt-0.5 font-mono font-bold tracking-wider tabular-nums">
                    {booking.reference_code}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {proofUrl ? (
            proofLoading ? (
              <div className="rounded-lg border bg-card p-6 text-center">
                <p className="animate-pulse text-sm text-muted-foreground">Loading proof…</p>
              </div>
            ) : src ? (
              <button type="button" onClick={handleOpen} className="block w-full cursor-zoom-in">
                <img
                  src={src}
                  alt="GCash payment proof uploaded by customer"
                  className="w-full rounded-lg border object-contain"
                  loading="lazy"
                />
              </button>
            ) : proofError ? (
              <div className="rounded-lg border bg-card p-4 text-center">
                <p className="text-sm font-medium">Could not load proof</p>
                <p className="mt-1 text-xs text-muted-foreground">{proofError}</p>
              </div>
            ) : isImageUrl(proofUrl) ? (
              <a href={proofUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={proofUrl}
                  alt="GCash payment proof uploaded by customer"
                  className="w-full rounded-lg border object-contain"
                  loading="lazy"
                />
              </a>
            ) : (
              <div className="rounded-lg border bg-card p-4 text-center">
                <p className="text-sm font-medium">Preview not available</p>
                <p className="mt-1 text-xs break-all text-muted-foreground">
                  {proofUrl}
                </p>
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground">No proof attached.</p>
          )}

          {proofUrl && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {copied ? "Copied" : "Copy ref code"}
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleOpen}
                disabled={proofLoading || (!src && isPrivateProofUrl(proofUrl))}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Open proof
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Verify the amount and reference number in your GCash history, then
            use Confirm Payment on the booking to approve it. If this is not
            a real payment, reject it to cancel the hold and free the slot.
          </p>

          {booking && booking.status === "pending" && (
            <Button
              variant={confirmingReject ? "destructive" : "outline"}
              size="sm"
              className="w-full"
              disabled={actionLoading !== null}
              onClick={handleReject}
              title="Reject this proof and cancel the booking"
            >
              {actionLoading === booking.id
                ? "Cancelling…"
                : confirmingReject
                  ? "Tap again to reject + cancel"
                  : "Reject proof"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
