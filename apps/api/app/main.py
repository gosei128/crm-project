from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.routers import auth, bookings, services, shop

# Shop rules — editable here, or sourced from DB/env later.
# Built so the frontend can render them dynamically (PROJECT_CONTEXT.md §11).
SHOP_RULES = [
    {"id": 1, "text": "Strictly by appointment — no walk-ins accepted.", "order": 1},
    {"id": 2, "text": "First come, first served.", "order": 2},
    {
        "id": 3,
        "text": "Downpayment via GCash is required to confirm a booking — no downpayment, no appointment.",
        "order": 3,
    },
    {"id": 4, "text": "All downpayments are non-refundable.", "order": 4},
    {
        "id": 5,
        "text": "Please arrive on time. More than 15 minutes late voids the booking (no refund).",
        "order": 5,
    },
    {"id": 6, "text": "No-shows void the booking (no refund).", "order": 6},
    {"id": 7, "text": "No bookings during lunch break (12:30 PM – 1:30 PM).", "order": 7},
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
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
