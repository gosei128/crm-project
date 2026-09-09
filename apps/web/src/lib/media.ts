/** True for direct image links (GCash screenshots) vs. drive/doc links. */
export function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp)(\?|#|$)/i.test(url);
}
