Read PROJECT_CONTEXT.md in this repo root first — it has the full business
requirements for a barbershop booking system I'm about to build on top of
this codebase. This existing codebase started life as an unfinished CMS
project, and I want to reuse/extend it rather than start over.

Do NOT write or change any code yet. This is a scan-and-report pass only.

Go through the codebase and answer the following:

## 1. Inventory
- What's actually implemented right now (auth, models, routes, DB setup,
  migrations, anything else)?
- What ORM/migration tooling is in use (e.g. SQLAlchemy + Alembic)?
- What's the current data model / schema, in plain terms?
- Is there anything CMS-specific in the data model or auth that would
  conflict with adding booking-related tables (services, slots, bookings)?

## 2. Fit against the requirements
Compare what exists against PROJECT_CONTEXT.md and flag:
- Which required pieces already exist in some form and can be extended
  (e.g. auth for an owner/admin role)
- Which required pieces are completely missing (e.g. slot/availability
  model, booking status state machine, background job runner)
- Anything in the current code that actively works against the
  requirements (e.g. an auth model that assumes every user needs to be a
  full account holder, when the client-facing booking flow shouldn't
  require login)

## 3. Concurrency & scheduling readiness
Specifically assess whether the current setup can support:
- A unique-constraint or row-locking approach to prevent double-booking on
  the same slot under concurrent requests
- A background/scheduled job (e.g. APScheduler, Celery beat, or similar)
  for: expiring unpaid Pending bookings after 15 minutes, auto-cancelling
  no-shows, and auto-cancelling late arrivals
- If nothing exists for scheduled/background jobs, tell me what's the
  simplest option that fits a small FastAPI + Postgres project (avoid
  over-engineering — this is a small single-shop booking system, not a
  distributed system).

## 4. Proposed plan (report only, don't implement)
Based on the gaps found, propose:
- The new tables/models needed (services, slots or availability, bookings
  — with the status enum: Pending, Booked, Complete, Expired, Cancelled-
  no-show, Cancelled-late)
- Where they'd plug into the existing project structure
- Any existing CMS code/tables that should be removed or repurposed vs.
  left alone
- A rough ordered list of what to build first (e.g. schema → availability
  logic → booking creation with locking → status transitions → background
  expiry job → owner dashboard endpoints)

Give me the report as a single markdown summary, organized under the four
headings above. Be specific about file/module names from the actual
codebase, not generic advice.
