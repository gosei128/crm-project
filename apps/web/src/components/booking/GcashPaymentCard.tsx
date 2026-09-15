import { useState } from "react";
import { Check, Copy, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  GCASH_ACCOUNT_NAME,
  GCASH_NUMBER,
  formatGcashNumber,
  resolveGcashQr,
} from "@/config/site";

interface GcashPaymentCardProps {
  gcashNumber?: string | null;
  gcashAccountName?: string | null;
  gcashQrUrl?: string | null;
}

/** GCash downpayment card shown at checkout — QR (if uploaded) + copyable number. */
export default function GcashPaymentCard({
  gcashNumber,
  gcashAccountName,
  gcashQrUrl,
}: GcashPaymentCardProps) {
  const [copied, setCopied] = useState(false);
  const number = (gcashNumber ?? "").trim() || GCASH_NUMBER;
  const accountName = (gcashAccountName ?? "").trim() || GCASH_ACCOUNT_NAME;
  const qrUrl = resolveGcashQr(gcashQrUrl);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(number);
    } catch {
      // Clipboard API unavailable (older WebView) — select fallback.
      const el = document.getElementById("gcash-number-value");
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#007DFF]/30 bg-white">
      <div className="bg-[#007DFF] px-4 py-2 text-center">
        <p className="text-base font-bold tracking-wide text-white">GCash</p>
      </div>
      <div className="space-y-3 px-4 py-4 text-center">
        {qrUrl ? (
          <img
            src={qrUrl}
            alt={`GCash QR for downpayment to ${number}`}
            className="mx-auto w-full max-w-[240px] rounded-md border border-espresso/10 object-contain"
            loading="lazy"
          />
        ) : (
          <div className="mx-auto flex w-full max-w-[240px] flex-col items-center gap-1 rounded-md border border-dashed border-[#007DFF]/40 bg-[#007DFF]/[0.06] px-4 py-6">
            <QrCode className="h-8 w-8 text-[#007DFF]" aria-hidden="true" />
            <p className="text-xs text-espresso/60">
              Scan with GCash or send manually to the number below
            </p>
          </div>
        )}

        <div>
          <p className="text-sm font-semibold text-espresso">{accountName}</p>
          <p className="text-xs text-espresso/55">GCash Account Name</p>
        </div>

        <div>
          <div className="flex items-center justify-center gap-2">
            <span
              id="gcash-number-value"
              className="font-mono text-xl font-bold tracking-wider text-espresso tabular-nums"
            >
              {formatGcashNumber(number)}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleCopy()}
              className="h-7 gap-1 border-[#007DFF]/30 px-2 text-xs text-[#007DFF] hover:bg-[#007DFF]/10 hover:text-[#007DFF]"
              aria-live="polite"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy
                </>
              )}
            </Button>
          </div>
          <p className="mt-1 text-xs text-espresso/55">GCash Number — tap Copy, paste in GCash</p>
        </div>

        <p className="text-[11px] text-espresso/50">Transfer fees may apply.</p>
      </div>
    </div>
  );
}
