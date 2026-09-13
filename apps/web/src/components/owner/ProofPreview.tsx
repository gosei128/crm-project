import { useState } from "react";
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
import { isImageUrl } from "@/lib/media";

export default function ProofPreview({
  booking,
  onClose,
}: {
  booking: Booking | null;
  onClose: () => void;
}) {
  // Track *which* booking was copied — no effect needed, resets per booking.
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copied = copiedId === booking?.id;

  async function handleCopy() {
    if (!booking?.payment_proof_url) return;
    try {
      await navigator.clipboard.writeText(booking.payment_proof_url);
      setCopiedId(booking.id);
    } catch {
      setCopiedId(null);
    }
  }

  const proofUrl = booking?.payment_proof_url ?? null;

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
            </dl>
          )}

          {proofUrl ? (
            isImageUrl(proofUrl) ? (
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
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button
                size="sm"
                className="flex-1"
                render={
                  <a href={proofUrl} target="_blank" rel="noopener noreferrer" />
                }
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Open proof
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Verify the amount and reference number in your GCash history, then
            use Confirm Payment on the booking to approve it.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
