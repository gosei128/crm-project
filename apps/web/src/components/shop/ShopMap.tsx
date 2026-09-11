import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { SHOP_LOCATION, shopDirectionsUrl } from "@/lib/shopLocation";
import { cn } from "@/lib/utils";

/**
 * Brand pin via divIcon — sidesteps the classic Vite issue where Leaflet's
 * default marker images 404 because bundlers don't resolve its image URLs.
 */
const shopIcon = L.divIcon({
  className: "kabarbers-pin",
  html: '<span class="kabarbers-pin-dot" aria-hidden="true"></span>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

/**
 * Interactive OpenStreetMap with the shop pinned. Scroll-wheel zoom stays
 * off so page scroll is never trapped (mobile UX rule); +/- and drag work.
 * Always paired with a text address + directions link for screen readers.
 */
export default function ShopMap({ className }: { className?: string }) {
  const position: [number, number] = [
    SHOP_LOCATION.latitude,
    SHOP_LOCATION.longitude,
  ];

  return (
    <div
      role="region"
      aria-label={`Map showing the location of ${SHOP_LOCATION.name}`}
      className={cn("overflow-hidden", className)}
    >
      <MapContainer
        center={position}
        zoom={SHOP_LOCATION.mapZoom}
        scrollWheelZoom={false}
        className="z-0 h-64 w-full sm:h-80"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position} icon={shopIcon}>
          <Popup>
            <div style={{ minWidth: 160 }}>
              <p style={{ fontWeight: 600 }}>{SHOP_LOCATION.name}</p>
              <p style={{ margin: "2px 0 6px" }}>
                {SHOP_LOCATION.addressLines.join(", ")}
              </p>
              <a
                href={shopDirectionsUrl()}
                target="_blank"
                rel="noopener noreferrer"
              >
                Get Directions
              </a>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
