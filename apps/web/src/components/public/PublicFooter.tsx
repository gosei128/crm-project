import { Link } from "react-router-dom";
import { MapPin, Scissors } from "lucide-react";
import {
  SHOP_LOCATION,
  shopAddressSingleLine,
  shopDirectionsUrl,
} from "@/lib/shopLocation";

export default function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-brass/25 bg-night text-sand-muted">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 text-cream-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brass/20 text-brass-bright">
              <Scissors className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="font-display text-xl tracking-wide uppercase">
              Kabarbers
            </span>
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed">
            Strictly by appointment. Book online, lock your slot with a GCash
            downpayment, walk straight to the chair.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold tracking-wide text-cream-ink uppercase">
            Visit
          </p>
          <p className="mt-3 flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {SHOP_LOCATION.name}
              <br />
              {shopAddressSingleLine()}
            </span>
          </p>
          <a
            href={shopDirectionsUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm font-medium text-brass-bright hover:text-cream-ink hover:underline"
          >
            Get directions →
          </a>
        </div>
        <div>
          <p className="text-sm font-semibold tracking-wide text-cream-ink uppercase">
            Book
          </p>
          <nav aria-label="Footer" className="mt-3 flex flex-col gap-1 text-sm">
            <Link
              to="/schedule"
              className="w-fit rounded px-1 py-1.5 hover:text-cream-ink hover:underline"
            >
              Schedule
            </Link>
            <Link
              to="/book"
              className="w-fit rounded px-1 py-1.5 hover:text-cream-ink hover:underline"
            >
              Book Appointment
            </Link>
            <Link
              to="/login"
              className="w-fit rounded px-1 py-1.5 hover:text-cream-ink hover:underline"
            >
              Owner login
            </Link>
          </nav>
          <p className="mt-3 text-xs leading-relaxed">
            Downpayment required to confirm. No downpayment, no appointment.
            Lunch break 12:30-1:30 PM daily.
          </p>
        </div>
      </div>
      <div className="border-t border-cream-ink/10">
        <p className="mx-auto w-full max-w-6xl px-4 py-4 text-xs">
          © {year} {SHOP_LOCATION.name}. All cuts reserved.
        </p>
      </div>
    </footer>
  );
}
