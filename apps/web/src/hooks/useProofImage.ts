import { useEffect, useState } from "react";
import { fetchProofBlob } from "@/lib/api";
import { isPrivateProofUrl } from "@/lib/media";

/** Resolve a booking's proof to a viewable image src.
 *
 *  Private endpoint URLs (/bookings/{id}/proof-file) are fetched with the
 *  stored auth token into a blob object URL (revoked on cleanup); legacy
 *  external URLs render directly. Guests without a session can still view
 *  their own pending proof — the backend authorizes that case.
 */
export function useProofImage(
  bookingId: string | null | undefined,
  proofUrl: string | null | undefined,
): { src: string | null; loading: boolean; error: string | null } {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setSrc(null);
    setError(null);
    if (!bookingId || !proofUrl) return;
    if (!isPrivateProofUrl(proofUrl)) {
      setSrc(proofUrl);
      return;
    }
    setLoading(true);
    fetchProofBlob(bookingId)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setSrc(url);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load proof");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [bookingId, proofUrl]);

  return { src, loading, error };
}
