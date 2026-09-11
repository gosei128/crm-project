/**
 * Single source of truth for the shop's physical location (client-facing).
 * Coordinates were supplied by the owner; update here if the shop moves.
 * (A backend-driven, owner-editable location is a possible follow-up —
 *  it needs a ShopSettings migration + endpoint + Controls editor.)
 */
export const SHOP_LOCATION = {
  name: "Kabarbers",
  addressLines: ["136 Sampaguita St", "Malolos, Bulacan"] as const,
  latitude: 14.856586411778645,
  longitude: 120.83490353774785,
  /** Zoom that shows the street + nearby landmarks. */
  mapZoom: 16,
} as const;

export function shopAddressSingleLine(): string {
  return SHOP_LOCATION.addressLines.join(", ");
}

/** Google Maps directions deep-link (works without any API key). */
export function shopDirectionsUrl(): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${SHOP_LOCATION.latitude},${SHOP_LOCATION.longitude}`;
}

/** OpenStreetMap link centered on the shop with a marker. */
export function shopOsmUrl(): string {
  const { latitude, longitude, mapZoom } = SHOP_LOCATION;
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${mapZoom}/${latitude}/${longitude}`;
}
