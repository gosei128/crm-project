from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, bookings, services

app = FastAPI(title="CRM Booking API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(bookings.router)
app.include_router(services.router)


app.get("/")
def root():
    return {"status" : "ok"}