from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path

from app.config import settings
from app.routers import auth, bookings, facebook, services, shop

# Shop rules — official Kabarbers policy + operational lines.
# Displayed to clients during booking (Book flow), on the public schedule
# page, and previewed read-only in the owner Shop Controls.
# `title` is rendered bold, `text` as the body, ordered by `order`.
SHOP_RULES = [
    {
        "id": 1,
        "title": "BOOKING",
        "text": "Strictly by appointment — no walk-ins accepted. First come, first served.",
        "order": 1,
    },
    {
        "id": 2,
        "title": "DOWNPAYMENT",
        "text": "Downpayment via GCash is required to confirm a booking — no downpayment, no appointment. All downpayments are non-refundable.",
        "order": 2,
    },
    {
        "id": 3,
        "title": "LATE ARRIVAL",
        "text": "If you are 15 minutes late, your appointment will be considered cancelled.",
        "order": 3,
    },
    {
        "id": 4,
        "title": "WAITING TIME",
        "text": "If you arrive on time but the previous client's service is still ongoing, rest assured we will hold your spot. Please be patient as we prioritize quality work over speed.",
        "order": 4,
    },
    {
        "id": 5,
        "title": "NO SHOW",
        "text": "If you do not show up for your appointment, your deposit will be forfeited.",
        "order": 5,
    },
    {
        "id": 6,
        "title": "CONFIRMATION",
        "text": "A booking confirmation will be shown to you once your appointment is finalized. Please present this confirmation to us upon check-in.",
        "order": 6,
    },
    {
        "id": 7,
        "title": "LUNCH BREAK",
        "text": "No bookings during lunch break (12:30 PM – 1:30 PM).",
        "order": 7,
    },
]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Startup — seed single-shop / single-haircut invariant, then scheduler
    try:
        from app.seed import seed_all

        seed_all()
    except Exception as e:
        print(f"[seed] Failed: {e}")
    try:
        from app.jobs.scheduler import start_scheduler

        start_scheduler()
    except Exception as e:
        print(f"[scheduler] Failed to start: {e}")

    yield

    # Shutdown
    try:
        from app.jobs.scheduler import shutdown_scheduler

        shutdown_scheduler()
    except Exception as e:
        print(f"[scheduler] Shutdown error: {e}")


app = FastAPI(title="Kabarbers Booking API", lifespan=lifespan)

# Local disk storage for GCash proof images — created at import so the
# StaticFiles mount never fails on a fresh checkout. Served at /uploads
# so stored payment_proof_url values render directly in <img> tags.
_UPLOAD_DIR = Path(settings.upload_dir)
if not _UPLOAD_DIR.is_absolute():
    _UPLOAD_DIR = Path.cwd() / _UPLOAD_DIR
_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_UPLOAD_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(facebook.router)
app.include_router(bookings.router)
app.include_router(services.router)
app.include_router(shop.router)


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/shop-rules", tags=["shop"])
def shop_rules():
    """Return the shop rules/policies to display during booking."""
    return {"rules": sorted(SHOP_RULES, key=lambda r: r["order"])}
