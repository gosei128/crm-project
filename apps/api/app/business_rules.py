"""Shared business-rule constants (standard library only).

Lives here — NOT in ``app.jobs.scheduler`` — so request-path modules (e.g.
``app.routers.bookings``) can use these values without importing APScheduler
at app startup. The dev server is expected to boot even when ``apscheduler``
isn't installed (see the lazy import in ``app.main.lifespan``); importing
anything from ``app.jobs.scheduler`` at router module level breaks that.
Single source of truth: change the number here, both the scheduler job and
the request guards follow.
"""

# Pending bookings expire if downpayment isn't confirmed within this window.
PENDING_TTL_MINUTES = 15
# Arrivals later than this past slot_start void the booking (no refund).
LATE_THRESHOLD_MINUTES = 15
