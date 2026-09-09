# Kabarbers Booking System — Project Context

## Background

Kabarbers is a barbershop currently taking appointments manually through
Messenger. The owner posts booking rules as a pinned message, clients DM
their preferred date/time and number of pax, and the owner manually tracks
confirmed appointments in a calendar. Downpayment (via GCash) is required
before a slot is confirmed; no downpayment, no appointment.

This project replaces that manual flow with a booking website: clients book
a slot directly and see live availability, and the owner manages bookings
from a dashboard instead of a Messenger thread + personal calendar.

This is the developer's first freelance client project as a student
developer, so scope is intentionally kept to a lean v1: solve the core
booking + payment-confirmation loop well before adding anything extra.

## Business Rules (source of truth)

- Strictly by appointment — no walk-in booking flow needed for v1.
- No appointments during lunch break (12:30 PM – 1:30 PM).
- First come, first served.
- Downpayment required to confirm a slot — no downpayment, no appointment.
- All downpayments are non-refundable, regardless of cancellation reason.
- Clients must arrive on time; more than 15 minutes late voids the booking
  (no refund).
- No-shows void the booking (no refund).
- Shop rules must be shown to the client during the booking flow (exact
  copy to be supplied later — build the UI to render it, don't hardcode
  placeholder text as final).

## Booking Status Model

Bookings move through three owner-visible states:

1. **Pending** — slot is held, awaiting downpayment. Not yet a confirmed
   booking; the slot is not permanently reserved.
2. **Booked** — downpayment received and verified; auto-approved on
   payment confirmation. Slot is now reserved and blocks other bookings.
3. **Complete** — appointment fulfilled.

Additional terminal/cancelled states are needed even though the owner
didn't name them explicitly — these should exist in the data model:

- **Expired** — pending booking with no downpayment received within the
  payment window.
- **Cancelled (no-show)** — booked appointment where the client never
  arrived.
- **Cancelled (late)** — booked appointment where the client arrived more
  than 15 minutes after the scheduled time.

The owner controls status transitions manually from the dashboard (e.g.
marking downpayment received, marking client arrived, marking no-show) —
this is not a fully automated payment-verification system for v1 (GCash
proof of payment is uploaded/shown, owner confirms manually).

## Functional Requirements

1. Clients book one slot per transaction; a booking records number of pax.
2. Owner can view all bookings (list/calendar), filterable by status.
3. Booking is auto-approved (moves Pending → Booked) once the owner marks
   the downpayment as received/verified.
4. A booking sits in Pending while awaiting downpayment; it does not block
   the slot as fully confirmed until paid, but see the "hold" rule below.
5. Pending bookings expire automatically if downpayment isn't confirmed
   within **15 minutes** of the booking being created.
6. **Race rule:** if two clients attempt to hold the same pending slot,
   whichever client's downpayment is confirmed *first* wins the slot; the
   other pending hold on that slot is cancelled automatically, even if
   still inside its own 15-minute window.
7. Booked appointments are auto-cancelled as a no-show if the client
   hasn't been marked "arrived" by the owner within the appointment
   window.
8. Booked appointments are auto-cancelled if the client arrives more than
   15 minutes after the scheduled time (owner marks arrival time).
9. All downpayments are non-refundable in every cancellation path.
10. Shop rules/policies are displayed to the client during booking.
11. Bookings can only be created within business-defined operating hours
    and must respect the lunch break block.

## Non-Functional Requirements

1. **No double-booking** — a slot can never carry two active (Pending or
   Booked) reservations at once.
2. **Serialized slot writes** — concurrent booking attempts on the same
   slot must be processed one at a time (e.g. DB-level locking or a unique
   constraint on `(service_id/staff_id, slot_start)`), not resolved by
   application-layer race checks alone.
3. **Concurrency-safe under load** — system must behave correctly with
   multiple simultaneous users, not just multiple sequential requests.
4. Bookings are only permitted within the business's configured schedule
   (hours, days, lunch break excluded).
5. Time-based transitions (expiry, no-show, late-cancel) must be enforced
   by a background process, not only checked reactively when a page loads
   — since no one may load the page at the moment a transition should
   happen.

## Existing Codebase to Build From

There is an existing, unfinished Python (FastAPI) backend originally built
as a CMS. The plan is to reuse/extend this rather than start from scratch,
assuming its structure (auth, DB connection/migrations, project layout) is
compatible with adding booking-specific tables and logic. This needs to be
verified, not assumed — see the accompanying codebase-scan prompt.

## Explicitly Out of Scope for v1

- Automatic GCash payment verification (manual owner confirmation only)
- Client accounts/login (booking flow should not require signup)
- SMS/email reminders
- Multi-branch or multi-staff scheduling (unless confirmed otherwise)
- Loyalty/rewards features
