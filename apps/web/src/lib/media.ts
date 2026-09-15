/** True for direct image links (GCash screenshots) vs. drive/doc links.
 *  Private proof-file endpoint URLs (/bookings/{id}/proof-file) count as
 *  images — bytes are fetched with auth (see useProofImage). */
export function isImageUrl(url: string): boolean {
  if (/\/proof-file(\?|#|$)/.test(url)) return true;
  return /\.(png|jpe?g|gif|webp|bmp)(\?|#|$)/i.test(url);
}

/** True when the URL is our private proof endpoint (needs auth to fetch). */
export function isPrivateProofUrl(url: string): boolean {
  return /\/bookings\/[^/]+\/proof-file(\?|#|$)/.test(url);
}

/** Proof upload constraints — must match the backend allow-list (JPG/PNG/WEBP). */
export const PROOF_ACCEPT = "image/jpeg,image/png,image/webp";
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

/** Client-side validation mirroring the backend. Returns an error message or null. */
export function validateProofFile(file: File): string | null {
  return validateImageFile(file);
}

/** Shared image validation (payment proofs, gallery uploads). */
export function validateImageFile(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Only JPG, PNG, or WEBP images are allowed.";
  }
  if (file.size > MAX_PROOF_BYTES) {
    return "Image must be 5 MB or smaller.";
  }
  if (file.size === 0) {
    return "That file is empty — please choose another image.";
  }
  return null;
}
